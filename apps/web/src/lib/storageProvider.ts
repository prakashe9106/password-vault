/**
 * The shape every cloud storage backend (Google Drive, OneDrive) implements. `syncStore.ts`
 * orchestrates conflict detection and the offline queue purely against this interface — it never
 * calls a provider's REST API directly.
 */

export type StorageProvider = "google-drive" | "onedrive";

export const PROVIDER_LABELS: Record<StorageProvider, string> = {
  "google-drive": "Google Drive",
  onedrive: "OneDrive",
};

export interface RemoteFileMeta {
  id: string;
  /** A value that changes every time the file's content changes (Drive's headRevisionId, OneDrive's eTag). */
  headRevisionId: string;
  modifiedTime: string;
}

export interface StorageProviderClient {
  findVaultFolder(accessToken: string): Promise<string | null>;
  createVaultFolder(accessToken: string): Promise<string>;
  findVaultFile(accessToken: string, folderId: string): Promise<RemoteFileMeta | null>;
  createVaultFile(accessToken: string, folderId: string, content: string): Promise<RemoteFileMeta>;
  getFileContent(accessToken: string, fileId: string): Promise<string>;
  getFileMeta(accessToken: string, fileId: string): Promise<RemoteFileMeta>;
  updateFileContent(accessToken: string, fileId: string, content: string): Promise<RemoteFileMeta>;
}
