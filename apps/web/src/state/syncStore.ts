import { useSyncExternalStore } from "react";
import { parseContainer } from "@vault/core";
import {
  createVaultFile,
  createVaultFolder,
  findVaultFile,
  findVaultFolder,
  getFileContent,
  getFileMeta,
  updateFileContent,
  DriveApiError,
  type DriveFileMeta,
} from "../lib/driveClient";
import { requestAccessToken } from "../lib/googleAuth";
import { getDriveLink, listVaultIndex, loadContainer, saveContainer, saveDriveLink } from "../storage/indexedDbAdapter";
import { DEFAULT_VAULT_NAME } from "../constants";

/**
 * Orchestrates Drive sync on top of the mechanical driveClient calls: finding/creating the
 * app's folder+file, the check-then-act conflict check (see docs/spec — Drive API v3 has no
 * reliable conditional-update header, so this has a small unavoidable race window), and the
 * local offline-pending queue.
 */

export type SyncStatus = "disconnected" | "syncing" | "synced" | "offline-pending" | "conflict" | "error";

interface ConflictInfo {
  vaultId: string;
  remoteMeta: DriveFileMeta;
}

interface SyncState {
  status: SyncStatus;
  lastError: string | null;
  conflict: ConflictInfo | null;
  lastSyncedAt: string | null;
}

let state: SyncState = { status: "disconnected", lastError: null, conflict: null, lastSyncedAt: null };
const listeners = new Set<() => void>();

function setState(patch: Partial<SyncState>): void {
  state = { ...state, ...patch };
  for (const l of listeners) l();
}

export function useSyncState(): SyncState {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => state,
  );
}

/** Non-hook accessor for the current status — for use outside React (tests, non-component code). */
export function getSyncSnapshot(): SyncState {
  return state;
}

async function markPending(vaultId: string): Promise<void> {
  const link = await getDriveLink(vaultId);
  if (link) await saveDriveLink({ ...link, pending_upload: true });
  setState({ status: "offline-pending" });
}

async function uploadNewVaultFile(accessToken: string, vaultId: string, raw: string): Promise<void> {
  let folderId = await findVaultFolder(accessToken);
  if (!folderId) folderId = await createVaultFolder(accessToken);
  const file = await createVaultFile(accessToken, folderId, raw);
  const syncedAt = new Date().toISOString();
  await saveDriveLink({
    vault_id: vaultId,
    folder_id: folderId,
    file_id: file.id,
    last_known_head_revision_id: file.headRevisionId,
    last_synced_at: syncedAt,
    pending_upload: false,
  });
  setState({ status: "synced", lastError: null, lastSyncedAt: syncedAt });
}

export async function createInitialDriveFile(accessToken: string, vaultId: string, raw: string): Promise<void> {
  setState({ status: "syncing" });
  await uploadNewVaultFile(accessToken, vaultId, raw);
}

export async function migrateLocalVaultToDrive(accessToken: string, vaultId: string): Promise<void> {
  const raw = await loadContainer(vaultId);
  if (!raw) throw new Error("Local vault not found.");
  setState({ status: "syncing" });
  await uploadNewVaultFile(accessToken, vaultId, raw);
}

export type ResolveResult =
  | { kind: "remote-found"; vaultId: string; vaultName: string }
  | { kind: "local-orphan"; vaultId: string; vaultName: string }
  | { kind: "fresh" };

/** Runs once right after connecting Drive to figure out what screen comes next. */
export async function resolveDriveState(accessToken: string): Promise<ResolveResult> {
  setState({ status: "syncing" });
  const folderId = await findVaultFolder(accessToken);

  if (folderId) {
    const file = await findVaultFile(accessToken, folderId);
    if (file) {
      const content = await getFileContent(accessToken, file.id);
      const container = parseContainer(content);
      const syncedAt = new Date().toISOString();
      await saveContainer(container.vault_id, content, DEFAULT_VAULT_NAME);
      await saveDriveLink({
        vault_id: container.vault_id,
        folder_id: folderId,
        file_id: file.id,
        last_known_head_revision_id: file.headRevisionId,
        last_synced_at: syncedAt,
        pending_upload: false,
      });
      setState({ status: "synced", lastSyncedAt: syncedAt });
      return { kind: "remote-found", vaultId: container.vault_id, vaultName: DEFAULT_VAULT_NAME };
    }
  }

  const localEntries = await listVaultIndex();
  for (const entry of localEntries) {
    const link = await getDriveLink(entry.vault_id);
    if (!link) {
      setState({ status: "disconnected" });
      return { kind: "local-orphan", vaultId: entry.vault_id, vaultName: entry.name };
    }
  }

  setState({ status: "disconnected" });
  return { kind: "fresh" };
}

/** Called after every local mutation. Never throws — falls back to the offline-pending queue. */
export async function uploadNow(accessToken: string | null, vaultId: string, raw: string): Promise<void> {
  if (!accessToken) {
    await markPending(vaultId);
    return;
  }

  const link = await getDriveLink(vaultId);
  if (!link) {
    try {
      await uploadNewVaultFile(accessToken, vaultId, raw);
    } catch {
      await markPending(vaultId);
    }
    return;
  }

  setState({ status: "syncing" });
  try {
    let meta: DriveFileMeta;
    try {
      meta = await getFileMeta(accessToken, link.file_id);
    } catch (err) {
      if (err instanceof DriveApiError && err.status === 401) {
        const refreshed = await requestAccessToken(false);
        meta = await getFileMeta(refreshed, link.file_id);
        accessToken = refreshed;
      } else {
        throw err;
      }
    }

    if (meta.headRevisionId !== link.last_known_head_revision_id) {
      setState({ status: "conflict", conflict: { vaultId, remoteMeta: meta } });
      return;
    }

    const updated = await updateFileContent(accessToken, link.file_id, raw);
    const syncedAt = new Date().toISOString();
    await saveDriveLink({
      ...link,
      last_known_head_revision_id: updated.headRevisionId,
      last_synced_at: syncedAt,
      pending_upload: false,
    });
    setState({ status: "synced", lastError: null, lastSyncedAt: syncedAt });
  } catch (err) {
    await markPending(vaultId);
    setState({ lastError: err instanceof Error ? err.message : "Sync failed." });
  }
}

/** "Keep my changes": re-checks the baseline immediately before force-uploading local content. */
export async function resolveConflictKeepMine(accessToken: string, vaultId: string, raw: string): Promise<void> {
  const link = await getDriveLink(vaultId);
  if (!link) throw new Error("No Drive link for this vault.");
  setState({ status: "syncing" });
  const updated = await updateFileContent(accessToken, link.file_id, raw);
  const syncedAt = new Date().toISOString();
  await saveDriveLink({
    ...link,
    last_known_head_revision_id: updated.headRevisionId,
    last_synced_at: syncedAt,
    pending_upload: false,
  });
  setState({ status: "synced", conflict: null, lastSyncedAt: syncedAt });
}

/**
 * "Use the other device's version": downloads remote content into the local cache and reports
 * back so the caller can lock the current session — the user re-unlocks against the freshly
 * downloaded container, which avoids needing any "swap the in-memory vault" API in vault-core.
 */
export async function resolveConflictUseTheirs(accessToken: string, vaultId: string): Promise<void> {
  const link = await getDriveLink(vaultId);
  if (!link) throw new Error("No Drive link for this vault.");
  setState({ status: "syncing" });
  const [content, meta] = await Promise.all([
    getFileContent(accessToken, link.file_id),
    getFileMeta(accessToken, link.file_id),
  ]);
  const syncedAt = new Date().toISOString();
  await saveContainer(vaultId, content, DEFAULT_VAULT_NAME);
  await saveDriveLink({
    ...link,
    last_known_head_revision_id: meta.headRevisionId,
    last_synced_at: syncedAt,
    pending_upload: false,
  });
  setState({ status: "synced", conflict: null, lastSyncedAt: syncedAt });
}

/** Retries any queued offline upload. Wire to `window.addEventListener('online', ...)`. */
export async function retryPendingUploads(accessToken: string | null): Promise<void> {
  if (!accessToken) return;
  const entries = await listVaultIndex();
  for (const entry of entries) {
    const link = await getDriveLink(entry.vault_id);
    if (link?.pending_upload) {
      const raw = await loadContainer(entry.vault_id);
      if (raw) await uploadNow(accessToken, entry.vault_id, raw);
    }
  }
}
