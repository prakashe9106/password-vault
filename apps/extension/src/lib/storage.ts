/**
 * The only module touching chrome.storage. `local` holds the encrypted container cache (disk-
 * persisted, analogous to the web app's IndexedDB); `session` holds only the raw VMK bytes and
 * activity timestamp — memory-only, cleared when the browser closes, never written to disk. See
 * the Phase 3 plan for why this is safe and necessary (MV3 service worker restarts).
 */

const LOCAL_CONTAINER_KEY = "vaultContainer";
const SESSION_VMK_KEY = "vmk";
const SESSION_ACTIVITY_KEY = "lastActivity";
const SESSION_PENDING_SAVE_KEY = "pendingSave";

export interface StoredContainer {
  raw: string;
  name: string;
}

export interface PendingSave {
  origin: string;
  username: string;
  password: string;
  capturedAt: number;
}

export async function getStoredContainer(): Promise<StoredContainer | null> {
  const result = await chrome.storage.local.get(LOCAL_CONTAINER_KEY);
  return (result[LOCAL_CONTAINER_KEY] as StoredContainer | undefined) ?? null;
}

export async function saveStoredContainer(container: StoredContainer): Promise<void> {
  await chrome.storage.local.set({ [LOCAL_CONTAINER_KEY]: container });
}

export async function clearStoredContainer(): Promise<void> {
  await chrome.storage.local.remove(LOCAL_CONTAINER_KEY);
}

export interface SessionVmk {
  vmkBase64: string;
  lastActivity: number;
}

export async function getSessionVmk(): Promise<SessionVmk | null> {
  const result = await chrome.storage.session.get([SESSION_VMK_KEY, SESSION_ACTIVITY_KEY]);
  const vmkBase64 = result[SESSION_VMK_KEY] as string | undefined;
  if (!vmkBase64) return null;
  return { vmkBase64, lastActivity: (result[SESSION_ACTIVITY_KEY] as number | undefined) ?? 0 };
}

export async function setSessionVmk(vmkBase64: string): Promise<void> {
  await chrome.storage.session.set({ [SESSION_VMK_KEY]: vmkBase64, [SESSION_ACTIVITY_KEY]: Date.now() });
}

export async function touchSessionActivity(): Promise<void> {
  await chrome.storage.session.set({ [SESSION_ACTIVITY_KEY]: Date.now() });
}

export async function clearSessionVmk(): Promise<void> {
  await chrome.storage.session.remove([SESSION_VMK_KEY, SESSION_ACTIVITY_KEY]);
}

export async function getPendingSave(): Promise<PendingSave | null> {
  const result = await chrome.storage.session.get(SESSION_PENDING_SAVE_KEY);
  return (result[SESSION_PENDING_SAVE_KEY] as PendingSave | undefined) ?? null;
}

export async function setPendingSave(pending: PendingSave): Promise<void> {
  await chrome.storage.session.set({ [SESSION_PENDING_SAVE_KEY]: pending });
}

export async function clearPendingSave(): Promise<void> {
  await chrome.storage.session.remove(SESSION_PENDING_SAVE_KEY);
}
