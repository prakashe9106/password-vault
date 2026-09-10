/** Vault data model and container types — see docs/spec/vault-protocol-v1.md */

export interface LoginHistoryEntry {
  changed_at: string;
  title: string;
  url: string;
  username: string;
  password: string;
  notes: string;
  folder_id: string | null;
}

export const MAX_LOGIN_HISTORY_ENTRIES = 20;

export interface Login {
  id: string;
  title: string;
  url: string;
  username: string;
  password: string;
  notes: string;
  folder_id: string | null;
  created_at: string;
  updated_at: string;
  /** Snapshots of prior field values, newest first, capped at MAX_LOGIN_HISTORY_ENTRIES. */
  history: LoginHistoryEntry[];
}

export interface Folder {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface GeneratorRules {
  length: number;
  useUpper: boolean;
  useLower: boolean;
  useDigits: boolean;
  useSymbols: boolean;
  excludeAmbiguous: boolean;
}

export interface VaultSettings {
  auto_lock_minutes: number;
  generator_defaults: GeneratorRules;
}

export interface SyncMetadata {
  device_id: string;
  revision: number;
  updated_at: string;
  conflict_markers: string[];
}

/** The full decrypted payload — this is what's serialized and AEAD-encrypted as `payload.ciphertext`. */
export interface VaultData {
  logins: Login[];
  folders: Folder[];
  settings: VaultSettings;
  sync_metadata: SyncMetadata;
}

export interface KdfParams {
  opslimit: number;
  memlimit: number;
}

/** One "unlock path": a KEK derived from a secret + salt wraps the Vault Master Key. */
export interface Envelope {
  salt: string; // base64
  opslimit: number;
  memlimit: number;
  nonce: string; // base64
  wrapped_key: string; // base64 — AEAD ciphertext+tag of the VMK
}

export interface ContainerHeader {
  format_version: number;
  crypto_version: number;
  vault_id: string;
}

export interface EncryptedPayload {
  nonce: string; // base64
  ciphertext: string; // base64
}

export interface VaultContainer extends ContainerHeader {
  header: {
    kdf_alg: "argon2id";
  };
  envelopes: {
    password: Envelope;
    recovery: Envelope;
  };
  payload: EncryptedPayload;
  revision: number;
  updated_at: string;
}

export const CURRENT_FORMAT_VERSION = 1;
export const CURRENT_CRYPTO_VERSION = 1;

export function defaultGeneratorRules(): GeneratorRules {
  return {
    length: 20,
    useUpper: true,
    useLower: true,
    useDigits: true,
    useSymbols: true,
    excludeAmbiguous: false,
  };
}

export function defaultVaultSettings(): VaultSettings {
  return {
    auto_lock_minutes: 5,
    generator_defaults: defaultGeneratorRules(),
  };
}

export function emptyVaultData(deviceId: string, now: string): VaultData {
  return {
    logins: [],
    folders: [],
    settings: defaultVaultSettings(),
    sync_metadata: {
      device_id: deviceId,
      revision: 1,
      updated_at: now,
      conflict_markers: [],
    },
  };
}
