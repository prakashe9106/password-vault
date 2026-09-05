/**
 * Thin Microsoft Graph wrapper, mirroring driveClient.ts's shape exactly (see storageProvider.ts).
 * Uses the app's special "approot" folder — the OneDrive analog of Google's drive.file scope:
 * this app only ever sees its own private folder, which Graph auto-creates on first access, so
 * there's no explicit "find or create the folder" step the way Drive needs.
 */

import type { RemoteFileMeta, StorageProviderClient } from "./storageProvider";

const GRAPH_API = "https://graph.microsoft.com/v1.0";
export const VAULT_FILE_NAME = "vault.json";

export class OneDriveApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "OneDriveApiError";
  }
}

interface DriveItem {
  id: string;
  eTag: string;
  lastModifiedDateTime: string;
}

function toRemoteFileMeta(item: DriveItem): RemoteFileMeta {
  return { id: item.id, headRevisionId: item.eTag, modifiedTime: item.lastModifiedDateTime };
}

async function graphFetch(url: string, accessToken: string, init: RequestInit = {}): Promise<Response> {
  const res = await fetch(url, {
    ...init,
    headers: {
      ...(init.headers as Record<string, string> | undefined),
      Authorization: `Bearer ${accessToken}`,
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new OneDriveApiError(`Microsoft Graph error ${res.status}: ${body}`, res.status);
  }
  return res;
}

/** The approot always "exists" (Graph creates it on first access) — its id stands in for a folder id. */
export async function findVaultFolder(accessToken: string): Promise<string | null> {
  const res = await graphFetch(`${GRAPH_API}/me/drive/special/approot`, accessToken);
  const data = (await res.json()) as { id: string };
  return data.id;
}

export async function createVaultFolder(accessToken: string): Promise<string> {
  const folderId = await findVaultFolder(accessToken);
  if (!folderId) throw new OneDriveApiError("Could not resolve the app's OneDrive folder.", 500);
  return folderId;
}

export async function findVaultFile(accessToken: string, _folderId: string): Promise<RemoteFileMeta | null> {
  try {
    const res = await graphFetch(`${GRAPH_API}/me/drive/special/approot:/${VAULT_FILE_NAME}`, accessToken);
    return toRemoteFileMeta((await res.json()) as DriveItem);
  } catch (err) {
    if (err instanceof OneDriveApiError && err.status === 404) return null;
    throw err;
  }
}

/** PUT to the approot path upserts — the same call serves both the first upload and every update. */
async function putVaultFile(accessToken: string, content: string): Promise<RemoteFileMeta> {
  const res = await graphFetch(`${GRAPH_API}/me/drive/special/approot:/${VAULT_FILE_NAME}:/content`, accessToken, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: content,
  });
  return toRemoteFileMeta((await res.json()) as DriveItem);
}

export async function createVaultFile(accessToken: string, _folderId: string, content: string): Promise<RemoteFileMeta> {
  return putVaultFile(accessToken, content);
}

export async function updateFileContent(accessToken: string, _fileId: string, content: string): Promise<RemoteFileMeta> {
  return putVaultFile(accessToken, content);
}

export async function getFileContent(accessToken: string, _fileId: string): Promise<string> {
  const res = await graphFetch(`${GRAPH_API}/me/drive/special/approot:/${VAULT_FILE_NAME}:/content`, accessToken);
  return res.text();
}

export async function getFileMeta(accessToken: string, _fileId: string): Promise<RemoteFileMeta> {
  const res = await graphFetch(`${GRAPH_API}/me/drive/special/approot:/${VAULT_FILE_NAME}`, accessToken);
  return toRemoteFileMeta((await res.json()) as DriveItem);
}

export const oneDriveProvider: StorageProviderClient = {
  findVaultFolder,
  createVaultFolder,
  findVaultFile,
  createVaultFile,
  getFileContent,
  getFileMeta,
  updateFileContent,
};
