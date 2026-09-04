import { useSyncExternalStore } from "react";
import { UnlockedVault } from "@vault/core";
import { saveContainer } from "../storage/indexedDbAdapter";

/**
 * Single source of truth while a vault is open. Decrypted data lives only inside `unlockedVault`,
 * in memory — it is never written to storage in decrypted form.
 */
export type SessionState =
  | { status: "locked" }
  | { status: "unlocked"; vaultId: string; vaultName: string; unlockedVault: UnlockedVault; revision: number };

type Listener = () => void;

let state: SessionState = { status: "locked" };
const listeners = new Set<Listener>();

function emit(): void {
  for (const listener of listeners) listener();
}

function getSnapshot(): SessionState {
  return state;
}

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useSession(): SessionState {
  return useSyncExternalStore(subscribe, getSnapshot);
}

export function setUnlocked(vaultId: string, vaultName: string, unlockedVault: UnlockedVault): void {
  state = { status: "unlocked", vaultId, vaultName, unlockedVault, revision: 0 };
  emit();
}

/**
 * Call after any mutation: re-encrypts and persists locally, notifies subscribers, and returns
 * the raw serialized container so the caller can hand the exact same bytes to Drive sync without
 * re-serializing (which would mint a fresh nonce/ciphertext and double-bump the revision).
 */
export async function persistAndNotify(): Promise<string> {
  if (state.status !== "unlocked") throw new Error("No vault is unlocked.");
  const container = state.unlockedVault.serialize();
  const raw = JSON.stringify(container);
  await saveContainer(state.vaultId, raw, state.vaultName);
  state = { ...state, revision: state.revision + 1 };
  emit();
  return raw;
}

export function getCurrentVaultId(): string | null {
  return state.status === "unlocked" ? state.vaultId : null;
}

export function lockSession(): void {
  if (state.status === "unlocked") {
    state.unlockedVault.lock();
  }
  state = { status: "locked" };
  emit();
}
