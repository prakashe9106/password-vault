import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { ready } from "../src/crypto.js";
import { VaultError } from "../src/errors.js";
import { UnlockedVault, changeMasterPassword, createVault, unlockVault, unlockVaultWithRecovery } from "../src/vault.js";

beforeAll(async () => {
  await ready();
});

async function freshUnlockedVault(): Promise<UnlockedVault> {
  const { container } = await createVault("initial-password");
  return unlockVault(container, "initial-password");
}

describe("Login CRUD", () => {
  let vault: UnlockedVault;

  beforeEach(async () => {
    vault = await freshUnlockedVault();
  });

  it("adds a login", () => {
    const login = vault.addLogin({
      title: "GitHub",
      url: "https://github.com",
      username: "octocat",
      password: "s3cr3t",
      notes: "",
      folder_id: null,
    });
    expect(login.id).toBeTruthy();
    expect(vault.logins).toHaveLength(1);
  });

  it("edits a login", () => {
    const login = vault.addLogin({ title: "A", url: "https://a.com", username: "u", password: "p", notes: "", folder_id: null });
    const updated = vault.updateLogin(login.id, { password: "new-password" });
    expect(updated.password).toBe("new-password");
    expect(updated.id).toBe(login.id);
    expect(updated.created_at).toBe(login.created_at);
  });

  it("deletes a login", () => {
    const login = vault.addLogin({ title: "A", url: "https://a.com", username: "u", password: "p", notes: "", folder_id: null });
    vault.deleteLogin(login.id);
    expect(vault.logins).toHaveLength(0);
  });

  it("throws when updating a nonexistent login", () => {
    expect(() => vault.updateLogin("does-not-exist", { title: "x" })).toThrow(VaultError);
  });
});

describe("Search", () => {
  let vault: UnlockedVault;

  beforeEach(async () => {
    vault = await freshUnlockedVault();
    vault.addLogin({ title: "GitHub", url: "https://github.com", username: "octocat", password: "p", notes: "", folder_id: null });
    vault.addLogin({ title: "Gitlab", url: "https://gitlab.com", username: "someone", password: "p", notes: "", folder_id: null });
    vault.addLogin({ title: "Bank Portal", url: "https://mybank.example", username: "octocat", password: "p", notes: "", folder_id: null });
  });

  it("returns all logins for an empty query", () => {
    expect(vault.search("")).toHaveLength(3);
    expect(vault.search("   ")).toHaveLength(3);
  });

  it("matches by title, case-insensitively", () => {
    expect(vault.search("github")).toHaveLength(1);
    expect(vault.search("GITHUB")).toHaveLength(1);
  });

  it("matches by username across multiple logins", () => {
    expect(vault.search("octocat")).toHaveLength(2);
  });

  it("matches by url substring", () => {
    expect(vault.search("mybank")).toHaveLength(1);
  });

  it("returns nothing for a non-matching query", () => {
    expect(vault.search("nonexistent")).toHaveLength(0);
  });
});

describe("Folders", () => {
  let vault: UnlockedVault;

  beforeEach(async () => {
    vault = await freshUnlockedVault();
  });

  it("creates and renames a folder", () => {
    const folder = vault.addFolder("Work");
    expect(vault.folders).toHaveLength(1);
    const renamed = vault.renameFolder(folder.id, "Work Stuff");
    expect(renamed.name).toBe("Work Stuff");
  });

  it("moves logins to no-folder rather than deleting them when their folder is deleted", () => {
    const folder = vault.addFolder("Work");
    const login = vault.addLogin({
      title: "A",
      url: "https://a.com",
      username: "u",
      password: "p",
      notes: "",
      folder_id: folder.id,
    });

    vault.deleteFolder(folder.id);

    expect(vault.folders).toHaveLength(0);
    expect(vault.logins).toHaveLength(1);
    expect(vault.logins.find((l) => l.id === login.id)?.folder_id).toBeNull();
  });
});

describe("lock()", () => {
  it("prevents further use of the vault after locking", async () => {
    const vault = await freshUnlockedVault();
    vault.addLogin({ title: "A", url: "https://a.com", username: "u", password: "p", notes: "", folder_id: null });
    vault.lock();
    expect(() => vault.logins).toThrow(VaultError);
    expect(() => vault.search("A")).toThrow(VaultError);
  });
});

describe("changeMasterPassword", () => {
  it("unlocks with the new password and no longer with the old one", async () => {
    const { container } = await createVault("old-password");
    const unlocked = await unlockVault(container, "old-password");
    unlocked.addLogin({ title: "A", url: "https://a.com", username: "u", password: "p", notes: "", folder_id: null });
    changeMasterPassword(unlocked, "new-password");
    const reserialized = unlocked.serialize();

    await expect(unlockVault(reserialized, "old-password")).rejects.toThrow();
    const reunlocked = await unlockVault(reserialized, "new-password");
    expect(reunlocked.logins).toHaveLength(1);
  });

  it("leaves the recovery envelope usable after a password change", async () => {
    const { container, recoveryCode } = await createVault("old-password");
    const unlocked = await unlockVault(container, "old-password");
    changeMasterPassword(unlocked, "new-password");
    const reserialized = unlocked.serialize();

    const viaRecovery = await unlockVaultWithRecovery(reserialized, recoveryCode);
    expect(viaRecovery.logins).toEqual([]);
  });
});
