import { v4 as uuidv4 } from "uuid";
import type { ContainerHeader, Folder, Login, LoginHistoryEntry, VaultContainer, VaultData, VaultSettings } from "./schema.js";
import { CURRENT_CRYPTO_VERSION, CURRENT_FORMAT_VERSION, MAX_LOGIN_HISTORY_ENTRIES, emptyVaultData } from "./schema.js";
import { generateVmk, ready, utf8ToBytes, wipe } from "./crypto.js";
import { createEnvelope, generateRecoveryCode, openEnvelope, parseRecoveryCode } from "./recovery.js";
import { decryptVaultData, encryptVaultData } from "./container.js";
import { VaultError } from "./errors.js";

export interface CreateVaultResult {
  container: VaultContainer;
  /** Dash-grouped recovery code — show once, force user acknowledgement, never persist in plaintext. */
  recoveryCode: string;
}

export async function createVault(
  masterPassword: string,
  initialSettings?: Partial<VaultSettings>,
): Promise<CreateVaultResult> {
  await ready();

  const vaultId = uuidv4();
  const deviceId = uuidv4();
  const now = new Date().toISOString();
  const header: ContainerHeader = {
    format_version: CURRENT_FORMAT_VERSION,
    crypto_version: CURRENT_CRYPTO_VERSION,
    vault_id: vaultId,
  };

  const vmk = generateVmk();
  const recovery = await generateRecoveryCode();

  const passwordEnvelope = createEnvelope(utf8ToBytes(masterPassword), vmk, header);
  const recoveryEnvelope = createEnvelope(recovery.raw, vmk, header);
  wipe(recovery.raw);

  let data = emptyVaultData(deviceId, now);
  if (initialSettings) {
    data = { ...data, settings: { ...data.settings, ...initialSettings } };
  }

  const payload = encryptVaultData(data, vmk, header);
  wipe(vmk);

  const container: VaultContainer = {
    ...header,
    header: { kdf_alg: "argon2id" },
    envelopes: { password: passwordEnvelope, recovery: recoveryEnvelope },
    payload,
    revision: 1,
    updated_at: now,
  };

  return { container, recoveryCode: recovery.formatted };
}

export async function unlockVault(container: VaultContainer, masterPassword: string): Promise<UnlockedVault> {
  await ready();
  const header = headerOf(container);
  const vmk = openEnvelope(utf8ToBytes(masterPassword), container.envelopes.password, header);
  const data = decryptVaultData(container.payload, vmk, header);
  return new UnlockedVault(container, vmk, data);
}

export async function unlockVaultWithRecovery(container: VaultContainer, recoveryCode: string): Promise<UnlockedVault> {
  await ready();
  const header = headerOf(container);
  const vmk = openEnvelope(parseRecoveryCode(recoveryCode), container.envelopes.recovery, header);
  const data = decryptVaultData(container.payload, vmk, header);
  return new UnlockedVault(container, vmk, data);
}

export function changeMasterPassword(unlocked: UnlockedVault, newPassword: string): void {
  unlocked.changeMasterPassword(newPassword);
}

function headerOf(container: VaultContainer): ContainerHeader {
  return {
    format_version: container.format_version,
    crypto_version: container.crypto_version,
    vault_id: container.vault_id,
  };
}

/**
 * A decrypted, in-memory vault session. Nothing here ever touches disk or network directly —
 * the host application (web app, extension) owns persistence via `serialize()`'s output.
 */
export class UnlockedVault {
  private vmk: Uint8Array;
  private readonly header: ContainerHeader;
  private envelopes: VaultContainer["envelopes"];
  private data: VaultData;
  private revision: number;
  private locked = false;

  constructor(container: VaultContainer, vmk: Uint8Array, data: VaultData) {
    this.header = headerOf(container);
    this.envelopes = container.envelopes;
    this.vmk = vmk;
    this.data = data;
    this.revision = container.revision;
  }

  private assertUnlocked(): void {
    if (this.locked) {
      throw new VaultError("This vault session is locked and can no longer be used.");
    }
  }

  get logins(): readonly Login[] {
    this.assertUnlocked();
    return this.data.logins;
  }

  get folders(): readonly Folder[] {
    this.assertUnlocked();
    return this.data.folders;
  }

  get settings(): VaultSettings {
    this.assertUnlocked();
    return this.data.settings;
  }

  addLogin(input: Omit<Login, "id" | "created_at" | "updated_at" | "history">): Login {
    this.assertUnlocked();
    const now = new Date().toISOString();
    const login: Login = { ...input, id: uuidv4(), created_at: now, updated_at: now, history: [] };
    this.data.logins.push(login);
    this.touch();
    return login;
  }

  updateLogin(id: string, patch: Partial<Omit<Login, "id" | "created_at" | "history">>): Login {
    this.assertUnlocked();
    const idx = this.data.logins.findIndex((l) => l.id === id);
    if (idx === -1) throw new VaultError(`Login not found: ${id}`);
    const current = this.data.logins[idx]!;
    const next: Login = { ...current, ...patch, updated_at: new Date().toISOString() };

    const trackedFields = ["title", "url", "username", "password", "notes", "folder_id"] as const;
    const changed = trackedFields.some((field) => next[field] !== current[field]);
    if (changed) {
      const snapshot: LoginHistoryEntry = {
        changed_at: next.updated_at,
        title: current.title,
        url: current.url,
        username: current.username,
        password: current.password,
        notes: current.notes,
        folder_id: current.folder_id,
      };
      next.history = [snapshot, ...current.history].slice(0, MAX_LOGIN_HISTORY_ENTRIES);
    }

    this.data.logins[idx] = next;
    this.touch();
    return next;
  }

  deleteLogin(id: string): void {
    this.assertUnlocked();
    this.data.logins = this.data.logins.filter((l) => l.id !== id);
    this.touch();
  }

  addFolder(name: string): Folder {
    this.assertUnlocked();
    const now = new Date().toISOString();
    const folder: Folder = { id: uuidv4(), name, created_at: now, updated_at: now };
    this.data.folders.push(folder);
    this.touch();
    return folder;
  }

  renameFolder(id: string, name: string): Folder {
    this.assertUnlocked();
    const idx = this.data.folders.findIndex((f) => f.id === id);
    if (idx === -1) throw new VaultError(`Folder not found: ${id}`);
    const updated: Folder = { ...this.data.folders[idx]!, name, updated_at: new Date().toISOString() };
    this.data.folders[idx] = updated;
    this.touch();
    return updated;
  }

  /** Deletes the folder; its logins move to "no folder" rather than being deleted (safer default). */
  deleteFolder(id: string): void {
    this.assertUnlocked();
    this.data.folders = this.data.folders.filter((f) => f.id !== id);
    const now = new Date().toISOString();
    this.data.logins = this.data.logins.map((l) =>
      l.folder_id === id ? { ...l, folder_id: null, updated_at: now } : l,
    );
    this.touch();
  }

  /** Case-insensitive substring match over title/url/username. Empty query returns everything. */
  search(query: string): Login[] {
    this.assertUnlocked();
    const q = query.trim().toLowerCase();
    if (!q) return [...this.data.logins];
    return this.data.logins.filter(
      (l) =>
        l.title.toLowerCase().includes(q) ||
        l.url.toLowerCase().includes(q) ||
        l.username.toLowerCase().includes(q),
    );
  }

  updateSettings(patch: Partial<VaultSettings>): VaultSettings {
    this.assertUnlocked();
    this.data.settings = { ...this.data.settings, ...patch };
    this.touch();
    return this.data.settings;
  }

  /** Re-wraps the VMK under a new master password. The recovery envelope is untouched. */
  changeMasterPassword(newPassword: string): void {
    this.assertUnlocked();
    this.envelopes = {
      ...this.envelopes,
      password: createEnvelope(utf8ToBytes(newPassword), this.vmk, this.header),
    };
    this.touch();
  }

  private touch(): void {
    this.data.sync_metadata = {
      ...this.data.sync_metadata,
      revision: this.data.sync_metadata.revision + 1,
      updated_at: new Date().toISOString(),
    };
  }

  /** Re-encrypts current state under a fresh nonce and returns the new container revision to persist. */
  serialize(): VaultContainer {
    this.assertUnlocked();
    const payload = encryptVaultData(this.data, this.vmk, this.header);
    this.revision += 1;
    return {
      ...this.header,
      header: { kdf_alg: "argon2id" },
      envelopes: this.envelopes,
      payload,
      revision: this.revision,
      updated_at: new Date().toISOString(),
    };
  }

  /** Zeroizes the in-memory VMK. The instance must not be used after calling this. */
  lock(): void {
    if (this.locked) return;
    wipe(this.vmk);
    this.data = emptyVaultData(this.data.sync_metadata.device_id, new Date().toISOString());
    this.locked = true;
  }
}
