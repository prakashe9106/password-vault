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
  type Envelope,
  type VaultContainer,
} from "@vault/core";
import {
  clearSessionVmk,
  clearStoredContainer,
  getSessionVmk,
  getStoredContainer,
  saveStoredContainer,
  setSessionVmk,
  touchSessionActivity,
  type StoredContainer,
} from "../lib/storage";

/**
 * Owns the one live `UnlockedVault` instance for this service worker's lifetime, and the
 * rehydrate-from-chrome.storage.session logic that survives MV3 service worker restarts without
 * re-deriving Argon2id or re-asking for the master password (see the Phase 3 plan).
 *
 * Deliberately does NOT call vault-core's `unlockVault`/`createVault` unlock helpers for the
 * actual unlock step — those intentionally wipe the VMK before returning, so the raw bytes are
 * never exposed. We need the raw VMK ourselves (to cache in session storage), so we reproduce
 * the same few steps manually using already-public primitives (`openEnvelope`,
 * `decryptVaultData`, `UnlockedVault`) — no vault-core changes required.
 */

let liveVault: UnlockedVault | null = null;

function headerOf(container: VaultContainer): ContainerHeader {
  return { format_version: container.format_version, crypto_version: container.crypto_version, vault_id: container.vault_id };
}

function unlockWithEnvelope(
  container: VaultContainer,
  envelope: Envelope,
  secret: Uint8Array,
): { unlocked: UnlockedVault; vmk: Uint8Array } {
  const header = headerOf(container);
  const vmk = openEnvelope(secret, envelope, header); // throws WrongPasswordError on mismatch
  const data = decryptVaultData(container.payload, vmk, header);
  return { unlocked: new UnlockedVault(container, vmk, data), vmk };
}

export function getLiveVault(): UnlockedVault | null {
  return liveVault;
}

export async function hasStoredVault(): Promise<boolean> {
  return (await getStoredContainer()) !== null;
}

export async function createNewVault(masterPassword: string, vaultName: string): Promise<string> {
  await ready();
  const { container, recoveryCode } = await createVault(masterPassword);
  const { unlocked, vmk } = unlockWithEnvelope(container, container.envelopes.password, utf8ToBytes(masterPassword));

  await saveStoredContainer({ raw: serializeContainer(container), name: vaultName });
  await setSessionVmk(toBase64(vmk));
  liveVault = unlocked;
  return recoveryCode;
}

export async function unlockWithPassword(masterPassword: string): Promise<void> {
  await ready();
  const stored = await requireStoredContainer();
  const container = parseContainer(stored.raw);
  const { unlocked, vmk } = unlockWithEnvelope(container, container.envelopes.password, utf8ToBytes(masterPassword));

  await setSessionVmk(toBase64(vmk));
  liveVault = unlocked;
}

export async function unlockWithRecoveryCode(recoveryCode: string): Promise<void> {
  await ready();
  const stored = await requireStoredContainer();
  const container = parseContainer(stored.raw);
  const { unlocked, vmk } = unlockWithEnvelope(container, container.envelopes.recovery, parseRecoveryCode(recoveryCode));

  await setSessionVmk(toBase64(vmk));
  liveVault = unlocked;
}

/** Reconstructs the session on a fresh service worker instance, without the master password. */
export async function rehydrateFromSession(): Promise<UnlockedVault | null> {
  if (liveVault) return liveVault;

  const sessionVmk = await getSessionVmk();
  const stored = await getStoredContainer();
  if (!sessionVmk || !stored) return null;

  await ready();
  const container = parseContainer(stored.raw);
  const header = headerOf(container);
  const vmk = fromBase64(sessionVmk.vmkBase64);

  let data;
  try {
    data = decryptVaultData(container.payload, vmk, header);
  } catch {
    await clearSessionVmk();
    return null;
  }

  const autoLockMinutes = data.settings.auto_lock_minutes;
  const elapsedMinutes = (Date.now() - sessionVmk.lastActivity) / 60_000;
  if (autoLockMinutes > 0 && elapsedMinutes > autoLockMinutes) {
    wipe(vmk);
    await clearSessionVmk();
    return null;
  }

  liveVault = new UnlockedVault(container, vmk, data);
  await touchSessionActivity();
  return liveVault;
}

/** Call after any mutation on the live vault: re-encrypts and persists, keeping the cache fresh. */
export async function persistLiveVault(): Promise<void> {
  if (!liveVault) throw new Error("No vault is unlocked.");
  const stored = await requireStoredContainer();
  const container = liveVault.serialize();
  await saveStoredContainer({ raw: serializeContainer(container), name: stored.name });
  await touchSessionActivity();
}

export async function lockVault(): Promise<void> {
  liveVault?.lock();
  liveVault = null;
  await clearSessionVmk();
}

export async function deleteVaultEntirely(): Promise<void> {
  liveVault?.lock();
  liveVault = null;
  await clearSessionVmk();
  await clearStoredContainer();
}

async function requireStoredContainer(): Promise<StoredContainer> {
  const stored = await getStoredContainer();
  if (!stored) throw new Error("No vault found on this device.");
  return stored;
}
