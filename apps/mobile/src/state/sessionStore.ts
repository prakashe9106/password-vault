import { useSyncExternalStore } from "react";
import {
  UnlockedVault,
  createVault,
  decryptVaultData,
  fromBase64,
  openEnvelope,
  parseContainer,
  parseRecoveryCode,
  ready,
  serializeContainer,
  toBase64,
  utf8ToBytes,
  wipe,
  type ContainerHeader,
  type VaultContainer,
} from "@vault/core";
import { loadContainer, saveContainer, setBiometricEnabled } from "../storage/vaultStorage";
import { cacheVmk, clearCachedVmk, getCachedVmkWithBiometric, touchActivity } from "../storage/secureVmk";

/**
 * Owns the one live `UnlockedVault` instance for the app's lifetime, mirroring the extension's
 * apps/extension/src/background/vaultSession.ts: deliberately bypasses `unlockVault`/`createVault`
 * (which wipe the VMK before returning) so the raw bytes can be cached for biometric unlock,
 * reusing vault-core's already-public primitives (`openEnvelope`, `decryptVaultData`,
 * `UnlockedVault`) — no vault-core changes.
 *
 * Unlike the extension, "Lock now" and auto-lock never clear the SecureStore-cached VMK — only
 * disabling the biometric-unlock preference does. A cold-started app is expected to unlock again
 * via fingerprint/face, not the master password, once biometric unlock has been turned on; that
 * cache is protected by the OS keystore, not by this app re-deriving anything.
 */

type SessionState =
  | { status: "locked" }
  | { status: "unlocked"; vaultId: string; vaultName: string; unlockedVault: UnlockedVault; revision: number };

let state: SessionState = { status: "locked" };
const listeners = new Set<() => void>();

function setState(next: SessionState): void {
  state = next;
  for (const l of listeners) l();
}

export function useSession(): SessionState {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => state,
  );
}

export function getSessionSnapshot(): SessionState {
  return state;
}

function headerOf(container: VaultContainer): ContainerHeader {
  return { format_version: container.format_version, crypto_version: container.crypto_version, vault_id: container.vault_id };
}

export async function createAndUnlock(
  masterPassword: string,
  vaultName: string,
): Promise<{ vaultId: string; recoveryCode: string }> {
  await ready();
  const { container, recoveryCode } = await createVault(masterPassword);
  const header = headerOf(container);
  const vmk = openEnvelope(utf8ToBytes(masterPassword), container.envelopes.password, header);
  const data = decryptVaultData(container.payload, vmk, header);
  const unlockedVault = new UnlockedVault(container, vmk, data);

  await saveContainer(container.vault_id, serializeContainer(container), vaultName);
  await cacheVmk(toBase64(vmk));
  setState({ status: "unlocked", vaultId: container.vault_id, vaultName, unlockedVault, revision: 0 });
  return { vaultId: container.vault_id, recoveryCode };
}

export async function unlockWithPassword(vaultId: string, vaultName: string, masterPassword: string): Promise<void> {
  await ready();
  const raw = await loadContainer(vaultId);
  if (!raw) throw new Error("No vault found on this device.");
  const container = parseContainer(raw);
  const header = headerOf(container);
  const vmk = openEnvelope(utf8ToBytes(masterPassword), container.envelopes.password, header); // throws WrongPasswordError
  const data = decryptVaultData(container.payload, vmk, header);
  const unlockedVault = new UnlockedVault(container, vmk, data);

  await cacheVmk(toBase64(vmk));
  setState({ status: "unlocked", vaultId, vaultName, unlockedVault, revision: 0 });
}

export async function unlockWithRecoveryCode(vaultId: string, vaultName: string, recoveryCode: string): Promise<void> {
  await ready();
  const raw = await loadContainer(vaultId);
  if (!raw) throw new Error("No vault found on this device.");
  const container = parseContainer(raw);
  const header = headerOf(container);
  const vmk = openEnvelope(parseRecoveryCode(recoveryCode), container.envelopes.recovery, header);
  const data = decryptVaultData(container.payload, vmk, header);
  const unlockedVault = new UnlockedVault(container, vmk, data);

  await cacheVmk(toBase64(vmk));
  setState({ status: "unlocked", vaultId, vaultName, unlockedVault, revision: 0 });
}

/**
 * Returns false (never throws) if biometric auth isn't available, is cancelled, or nothing is
 * cached. The auto-lock setting lives inside the encrypted vault data, so it's only known after
 * decrypting — there's no way to check it beforehand the way the caller checks it for an
 * already-unlocked session elsewhere.
 */
export async function unlockWithBiometric(vaultId: string, vaultName: string): Promise<boolean> {
  await ready();
  const cached = await getCachedVmkWithBiometric();
  if (!cached) return false;
  const raw = await loadContainer(vaultId);
  if (!raw) return false;

  const container = parseContainer(raw);
  const header = headerOf(container);
  const vmk = fromBase64(cached.vmkBase64);

  let data;
  try {
    data = decryptVaultData(container.payload, vmk, header);
  } catch {
    await clearCachedVmk();
    return false;
  }

  const elapsedMinutes = (Date.now() - cached.lastActivity) / 60_000;
  if (data.settings.auto_lock_minutes > 0 && elapsedMinutes > data.settings.auto_lock_minutes) {
    wipe(vmk);
    return false;
  }

  const unlockedVault = new UnlockedVault(container, vmk, data);
  await touchActivity();
  setState({ status: "unlocked", vaultId, vaultName, unlockedVault, revision: 0 });
  return true;
}

/** Re-encrypts and persists locally; returns the raw serialized container for Drive sync. */
export async function persistAndNotify(): Promise<string> {
  if (state.status !== "unlocked") throw new Error("No vault is unlocked.");
  const container = state.unlockedVault.serialize();
  const raw = serializeContainer(container);
  await saveContainer(state.vaultId, raw, state.vaultName);
  setState({ ...state, revision: state.revision + 1 });
  return raw;
}

export function getCurrentVaultId(): string | null {
  return state.status === "unlocked" ? state.vaultId : null;
}

/** Locks the live session only — the biometric-unlock cache (if enabled) survives this. */
export function lockSession(): void {
  if (state.status === "unlocked") state.unlockedVault.lock();
  setState({ status: "locked" });
}

/** Turning biometric unlock off must actually remove the cached key, not just hide the button. */
export async function disableBiometricUnlock(): Promise<void> {
  await setBiometricEnabled(false);
  await clearCachedVmk();
}

/**
 * The raw VMK is only ever in hand at the moment of a password/recovery unlock (UnlockedVault
 * never exposes it afterward, by design), so turning this on while already unlocked doesn't
 * populate the cache immediately — it takes effect from the next full password/recovery unlock
 * onward. The Settings screen's copy says this explicitly.
 */
export async function enableBiometricUnlock(): Promise<void> {
  await setBiometricEnabled(true);
}
