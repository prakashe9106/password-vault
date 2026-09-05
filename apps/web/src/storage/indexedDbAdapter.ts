import { openDB, type DBSchema, type IDBPDatabase } from "idb";

/**
 * The only module in this app that touches browser storage. Persists the encrypted container
 * blob exactly as vault-core produces it (serializeContainer output) as the local cache backing
 * cloud sync (Google Drive or OneDrive); nothing here ever sees decrypted vault data.
 */

export interface VaultIndexEntry {
  vault_id: string;
  name: string;
  updated_at: string;
}

/** Local-only metadata linking a vault to its cloud storage file. Never holds tokens or secrets. */
export interface StorageLink {
  vault_id: string;
  provider: "google-drive" | "onedrive";
  folder_id: string;
  file_id: string;
  last_known_head_revision_id: string;
  last_synced_at: string;
  pending_upload: boolean;
}

interface VaultDB extends DBSchema {
  containers: {
    key: string;
    value: { vault_id: string; raw: string };
  };
  index: {
    key: string;
    value: VaultIndexEntry;
  };
  driveLinks: {
    key: string;
    value: StorageLink;
  };
}

const DB_NAME = "privacy-first-vault";
const DB_VERSION = 2;

let dbPromise: Promise<IDBPDatabase<VaultDB>> | null = null;

function getDb(): Promise<IDBPDatabase<VaultDB>> {
  if (!dbPromise) {
    dbPromise = openDB<VaultDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("containers")) {
          db.createObjectStore("containers", { keyPath: "vault_id" });
        }
        if (!db.objectStoreNames.contains("index")) {
          db.createObjectStore("index", { keyPath: "vault_id" });
        }
        if (!db.objectStoreNames.contains("driveLinks")) {
          db.createObjectStore("driveLinks", { keyPath: "vault_id" });
        }
      },
    });
  }
  return dbPromise;
}

export async function saveContainer(vaultId: string, raw: string, name: string): Promise<void> {
  const db = await getDb();
  const tx = db.transaction(["containers", "index"], "readwrite");
  await Promise.all([
    tx.objectStore("containers").put({ vault_id: vaultId, raw }),
    tx.objectStore("index").put({ vault_id: vaultId, name, updated_at: new Date().toISOString() }),
    tx.done,
  ]);
}

export async function loadContainer(vaultId: string): Promise<string | undefined> {
  const db = await getDb();
  const record = await db.get("containers", vaultId);
  return record?.raw;
}

export async function listVaultIndex(): Promise<VaultIndexEntry[]> {
  const db = await getDb();
  return db.getAll("index");
}

export async function deleteVault(vaultId: string): Promise<void> {
  const db = await getDb();
  const tx = db.transaction(["containers", "index"], "readwrite");
  await Promise.all([
    tx.objectStore("containers").delete(vaultId),
    tx.objectStore("index").delete(vaultId),
    tx.done,
  ]);
}

export async function getStorageLink(vaultId: string): Promise<StorageLink | undefined> {
  const db = await getDb();
  return db.get("driveLinks", vaultId);
}

export async function saveStorageLink(link: StorageLink): Promise<void> {
  const db = await getDb();
  await db.put("driveLinks", link);
}

export async function deleteStorageLink(vaultId: string): Promise<void> {
  const db = await getDb();
  await db.delete("driveLinks", vaultId);
}
