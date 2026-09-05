/**
 * Thin Drive REST v3 wrapper. Every call takes the access token explicitly (no hidden global
 * state) so this module stays easy to unit-test against a mocked fetch. Only ever touches the
 * one folder/file this app creates for itself (drive.file scope).
 */

import type { StorageProviderClient } from "./storageProvider";

const DRIVE_API = "https://www.googleapis.com/drive/v3/files";
const DRIVE_UPLOAD_API = "https://www.googleapis.com/upload/drive/v3/files";

export const VAULT_FOLDER_NAME = "Privacy-First Password Vault";
export const VAULT_FILE_NAME = "vault.json";
const FOLDER_MIME_TYPE = "application/vnd.google-apps.folder";

export class DriveApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "DriveApiError";
  }
}

export interface DriveFileMeta {
  id: string;
  headRevisionId: string;
  modifiedTime: string;
}

async function driveFetch(url: string, accessToken: string, init: RequestInit = {}): Promise<Response> {
  const res = await fetch(url, {
    ...init,
    headers: {
      ...(init.headers as Record<string, string> | undefined),
      Authorization: `Bearer ${accessToken}`,
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new DriveApiError(`Drive API error ${res.status}: ${body}`, res.status);
  }
  return res;
}

export async function findVaultFolder(accessToken: string): Promise<string | null> {
  const q = encodeURIComponent(`name='${VAULT_FOLDER_NAME}' and mimeType='${FOLDER_MIME_TYPE}' and trashed=false`);
  const res = await driveFetch(`${DRIVE_API}?q=${q}&fields=files(id,name)`, accessToken);
  const data = (await res.json()) as { files: { id: string }[] };
  return data.files[0]?.id ?? null;
}

export async function createVaultFolder(accessToken: string): Promise<string> {
  const res = await driveFetch(DRIVE_API, accessToken, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: VAULT_FOLDER_NAME, mimeType: FOLDER_MIME_TYPE }),
  });
  const data = (await res.json()) as { id: string };
  return data.id;
}

export async function findVaultFile(accessToken: string, folderId: string): Promise<DriveFileMeta | null> {
  const q = encodeURIComponent(`name='${VAULT_FILE_NAME}' and '${folderId}' in parents and trashed=false`);
  const res = await driveFetch(`${DRIVE_API}?q=${q}&fields=files(id,headRevisionId,modifiedTime)`, accessToken);
  const data = (await res.json()) as { files: DriveFileMeta[] };
  return data.files[0] ?? null;
}

/** Multipart upload — only needed here because we're setting metadata (name/parent) at creation time. */
export async function createVaultFile(accessToken: string, folderId: string, content: string): Promise<DriveFileMeta> {
  const boundary = `vault_boundary_${Math.random().toString(36).slice(2)}`;
  const metadata = JSON.stringify({ name: VAULT_FILE_NAME, parents: [folderId] });
  const body =
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: application/json\r\n\r\n${content}\r\n` +
    `--${boundary}--`;

  const res = await driveFetch(
    `${DRIVE_UPLOAD_API}?uploadType=multipart&fields=id,headRevisionId,modifiedTime`,
    accessToken,
    {
      method: "POST",
      headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
      body,
    },
  );
  return (await res.json()) as DriveFileMeta;
}

export async function getFileContent(accessToken: string, fileId: string): Promise<string> {
  const res = await driveFetch(`${DRIVE_API}/${fileId}?alt=media`, accessToken);
  return res.text();
}

export async function getFileMeta(accessToken: string, fileId: string): Promise<DriveFileMeta> {
  const res = await driveFetch(`${DRIVE_API}/${fileId}?fields=id,headRevisionId,modifiedTime`, accessToken);
  return (await res.json()) as DriveFileMeta;
}

/**
 * Simple (non-multipart) media upload — only the content changes on every sync, never the
 * metadata, so this is the cheap path used for all but the very first upload.
 */
export async function updateFileContent(accessToken: string, fileId: string, content: string): Promise<DriveFileMeta> {
  const res = await driveFetch(
    `${DRIVE_UPLOAD_API}/${fileId}?uploadType=media&fields=id,headRevisionId,modifiedTime`,
    accessToken,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: content,
    },
  );
  return (await res.json()) as DriveFileMeta;
}

export const googleDriveProvider: StorageProviderClient = {
  findVaultFolder,
  createVaultFolder,
  findVaultFile,
  createVaultFile,
  getFileContent,
  getFileMeta,
  updateFileContent,
};
