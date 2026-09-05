import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * The RN analog of apps/web's indexedDbAdapter.ts — same role (local cache of the encrypted
 * container, plus a small index and the Drive sync link), much simpler API surface since a
 * key-value store is all a single-vault-per-device app actually needs. Never sees decrypted data.
 */

const CONTAINER_KEY_PREFIX = "vault:container:";
const INDEX_KEY = "vault:index";
const DRIVE_LINK_KEY_PREFIX = "vault:driveLink:";
const BIOMETRIC_ENABLED_KEY = "vault:biometricEnabled";

export interface VaultIndexEntry {
  vault_id: string;
  name: string;
  updated_at: string;
}

export interface DriveLink {
  vault_id: string;
  folder_id: string;
  file_id: string;
  last_known_head_revision_id: string;
  last_synced_at: string;
  pending_upload: boolean;
}

export async function saveContainer(vaultId: string, raw: string, name: string): Promise<void> {
  const index = await listVaultIndex();
  const next = index.filter((e) => e.vault_id !== vaultId);
  next.push({ vault_id: vaultId, name, updated_at: new Date().toISOString() });
  await AsyncStorage.multiSet([
    [`${CONTAINER_KEY_PREFIX}${vaultId}`, raw],
    [INDEX_KEY, JSON.stringify(next)],
  ]);
}

export async function loadContainer(vaultId: string): Promise<string | undefined> {
  const raw = await AsyncStorage.getItem(`${CONTAINER_KEY_PREFIX}${vaultId}`);
  return raw ?? undefined;
}

export async function listVaultIndex(): Promise<VaultIndexEntry[]> {
  const raw = await AsyncStorage.getItem(INDEX_KEY);
  return raw ? (JSON.parse(raw) as VaultIndexEntry[]) : [];
}

export async function deleteVault(vaultId: string): Promise<void> {
  const index = await listVaultIndex();
  await AsyncStorage.multiSet([[INDEX_KEY, JSON.stringify(index.filter((e) => e.vault_id !== vaultId))]]);
  await AsyncStorage.removeItem(`${CONTAINER_KEY_PREFIX}${vaultId}`);
}

export async function getDriveLink(vaultId: string): Promise<DriveLink | undefined> {
  const raw = await AsyncStorage.getItem(`${DRIVE_LINK_KEY_PREFIX}${vaultId}`);
  return raw ? (JSON.parse(raw) as DriveLink) : undefined;
}

export async function saveDriveLink(link: DriveLink): Promise<void> {
  await AsyncStorage.setItem(`${DRIVE_LINK_KEY_PREFIX}${link.vault_id}`, JSON.stringify(link));
}

export async function deleteDriveLink(vaultId: string): Promise<void> {
  await AsyncStorage.removeItem(`${DRIVE_LINK_KEY_PREFIX}${vaultId}`);
}

/** A UI preference only — never gates access on its own. The actual secret lives in SecureStore
 * (see storage/secureVmk.ts) and is cleared for real when this is turned off. */
export async function isBiometricEnabled(): Promise<boolean> {
  return (await AsyncStorage.getItem(BIOMETRIC_ENABLED_KEY)) === "true";
}

export async function setBiometricEnabled(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(BIOMETRIC_ENABLED_KEY, enabled ? "true" : "false");
}
