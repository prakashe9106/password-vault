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

/** Call after any mutation: re-encrypts and persists, then notifies subscribers to re-render. */
export async function persistAndNotify(): Promise<void> {
  if (state.status !== "unlocked") return;
  const container = state.unlockedVault.serialize();
  await saveContainer(state.vaultId, JSON.stringify(container), state.vaultName);
  state = { ...state, revision: state.revision + 1 };
  emit();
}

export function lockSession(): void {
  if (state.status === "unlocked") {
    state.unlockedVault.lock();
  }
  state = { status: "locked" };
  emit();
}
