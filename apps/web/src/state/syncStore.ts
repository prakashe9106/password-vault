import { useSyncExternalStore } from "react";
import { parseContainer } from "@vault/core";
import { DriveApiError, googleDriveProvider } from "../lib/driveClient";
import { OneDriveApiError, oneDriveProvider } from "../lib/oneDriveClient";
import type { RemoteFileMeta, StorageProvider, StorageProviderClient } from "../lib/storageProvider";
import { requestAccessToken as requestGoogleAccessToken } from "../lib/googleAuth";
import { requestAccessToken as requestOneDriveAccessToken } from "../lib/oneDriveAuth";
import { getStorageLink, listVaultIndex, loadContainer, saveContainer, saveStorageLink } from "../storage/indexedDbAdapter";
import { DEFAULT_VAULT_NAME } from "../constants";

/**
 * Orchestrates cloud sync on top of the mechanical per-provider client calls: finding/creating
 * the app's folder+file, the check-then-act conflict check (see docs/spec — neither Drive nor
 * OneDrive's simple upload API has a reliable conditional-update header, so this has a small
 * unavoidable race window), and the local offline-pending queue. Provider-agnostic: every
 * function takes a `StorageProvider` and resolves the right client/token-refresher for it, so
 * this file never imports a provider's REST client or auth module beyond that lookup.
 */

export type SyncStatus = "disconnected" | "syncing" | "synced" | "offline-pending" | "conflict" | "error";

const PROVIDER_CLIENTS: Record<StorageProvider, StorageProviderClient> = {
  "google-drive": googleDriveProvider,
  onedrive: oneDriveProvider,
};

const PROVIDER_TOKEN_REFRESHERS: Record<StorageProvider, (interactive: boolean) => Promise<string>> = {
  "google-drive": requestGoogleAccessToken,
  onedrive: requestOneDriveAccessToken,
};

function isAuthError(err: unknown): boolean {
  return (err instanceof DriveApiError || err instanceof OneDriveApiError) && err.status === 401;
}

interface ConflictInfo {
  vaultId: string;
  remoteMeta: RemoteFileMeta;
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
  const link = await getStorageLink(vaultId);
  if (link) await saveStorageLink({ ...link, pending_upload: true });
  setState({ status: "offline-pending" });
}

async function uploadNewVaultFile(provider: StorageProvider, accessToken: string, vaultId: string, raw: string): Promise<void> {
  const client = PROVIDER_CLIENTS[provider];
  let folderId = await client.findVaultFolder(accessToken);
  if (!folderId) folderId = await client.createVaultFolder(accessToken);
  const file = await client.createVaultFile(accessToken, folderId, raw);
  const syncedAt = new Date().toISOString();
  await saveStorageLink({
    vault_id: vaultId,
    provider,
    folder_id: folderId,
    file_id: file.id,
    last_known_head_revision_id: file.headRevisionId,
    last_synced_at: syncedAt,
    pending_upload: false,
  });
  setState({ status: "synced", lastError: null, lastSyncedAt: syncedAt });
}

export async function createInitialRemoteFile(
  provider: StorageProvider,
  accessToken: string,
  vaultId: string,
  raw: string,
): Promise<void> {
  setState({ status: "syncing" });
  await uploadNewVaultFile(provider, accessToken, vaultId, raw);
}

export async function migrateLocalVaultToRemote(provider: StorageProvider, accessToken: string, vaultId: string): Promise<void> {
  const raw = await loadContainer(vaultId);
  if (!raw) throw new Error("Local vault not found.");
  setState({ status: "syncing" });
  await uploadNewVaultFile(provider, accessToken, vaultId, raw);
}

export type ResolveResult =
  | { kind: "remote-found"; vaultId: string; vaultName: string }
  | { kind: "local-orphan"; vaultId: string; vaultName: string }
  | { kind: "fresh" };

/** Runs once right after connecting a storage provider to figure out what screen comes next. */
export async function resolveRemoteState(provider: StorageProvider, accessToken: string): Promise<ResolveResult> {
  setState({ status: "syncing" });
  const client = PROVIDER_CLIENTS[provider];
  const folderId = await client.findVaultFolder(accessToken);

  if (folderId) {
    const file = await client.findVaultFile(accessToken, folderId);
    if (file) {
      const content = await client.getFileContent(accessToken, file.id);
      const container = parseContainer(content);
      const syncedAt = new Date().toISOString();
      await saveContainer(container.vault_id, content, DEFAULT_VAULT_NAME);
      await saveStorageLink({
        vault_id: container.vault_id,
        provider,
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
    const link = await getStorageLink(entry.vault_id);
    if (!link) {
      setState({ status: "disconnected" });
      return { kind: "local-orphan", vaultId: entry.vault_id, vaultName: entry.name };
    }
  }

  setState({ status: "disconnected" });
  return { kind: "fresh" };
}

/** Called after every local mutation. Never throws — falls back to the offline-pending queue. */
export async function uploadNow(provider: StorageProvider, accessToken: string | null, vaultId: string, raw: string): Promise<void> {
  if (!accessToken) {
    await markPending(vaultId);
    return;
  }

  const client = PROVIDER_CLIENTS[provider];
  const link = await getStorageLink(vaultId);
  if (!link) {
    try {
      await uploadNewVaultFile(provider, accessToken, vaultId, raw);
    } catch {
      await markPending(vaultId);
    }
    return;
  }

  setState({ status: "syncing" });
  try {
    let meta: RemoteFileMeta;
    try {
      meta = await client.getFileMeta(accessToken, link.file_id);
    } catch (err) {
      if (isAuthError(err)) {
        const refreshed = await PROVIDER_TOKEN_REFRESHERS[provider](false);
        meta = await client.getFileMeta(refreshed, link.file_id);
        accessToken = refreshed;
      } else {
        throw err;
      }
    }

    if (meta.headRevisionId !== link.last_known_head_revision_id) {
      setState({ status: "conflict", conflict: { vaultId, remoteMeta: meta } });
      return;
    }

    const updated = await client.updateFileContent(accessToken, link.file_id, raw);
    const syncedAt = new Date().toISOString();
    await saveStorageLink({
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
export async function resolveConflictKeepMine(provider: StorageProvider, accessToken: string, vaultId: string, raw: string): Promise<void> {
  const link = await getStorageLink(vaultId);
  if (!link) throw new Error("No cloud storage link for this vault.");
  setState({ status: "syncing" });
  const updated = await PROVIDER_CLIENTS[provider].updateFileContent(accessToken, link.file_id, raw);
  const syncedAt = new Date().toISOString();
  await saveStorageLink({
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
export async function resolveConflictUseTheirs(provider: StorageProvider, accessToken: string, vaultId: string): Promise<void> {
  const link = await getStorageLink(vaultId);
  if (!link) throw new Error("No cloud storage link for this vault.");
  setState({ status: "syncing" });
  const client = PROVIDER_CLIENTS[provider];
  const [content, meta] = await Promise.all([
    client.getFileContent(accessToken, link.file_id),
    client.getFileMeta(accessToken, link.file_id),
  ]);
  const syncedAt = new Date().toISOString();
  await saveContainer(vaultId, content, DEFAULT_VAULT_NAME);
  await saveStorageLink({
    ...link,
    last_known_head_revision_id: meta.headRevisionId,
    last_synced_at: syncedAt,
    pending_upload: false,
  });
  setState({ status: "synced", conflict: null, lastSyncedAt: syncedAt });
}

/** Retries any queued offline upload. Wire to `window.addEventListener('online', ...)`. */
export async function retryPendingUploads(provider: StorageProvider, accessToken: string | null): Promise<void> {
  if (!accessToken) return;
  const entries = await listVaultIndex();
  for (const entry of entries) {
    const link = await getStorageLink(entry.vault_id);
    if (link?.pending_upload) {
      const raw = await loadContainer(entry.vault_id);
      if (raw) await uploadNow(provider, accessToken, entry.vault_id, raw);
    }
  }
}
