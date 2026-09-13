import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { ready } from "../src/crypto.js";
import { VaultError } from "../src/errors.js";
import type { Login } from "../src/schema.js";
import { UnlockedVault, changeMasterPassword, createVault, unlockVault, unlockVaultWithRecovery } from "../src/vault.js";

beforeAll(async () => {
  await ready();
});

async function freshUnlockedVault(): Promise<UnlockedVault> {
  const { container } = await createVault("initial-password");
  return unlockVault(container, "initial-password");
}

type NewLoginInput = Partial<Omit<Login, "id" | "created_at" | "updated_at" | "history">>;

function newLogin(overrides: NewLoginInput = {}): Omit<Login, "id" | "created_at" | "updated_at" | "history"> {
  return {
    title: "A",
    url: "https://a.com",
    username: "u",
    password: "p",
    notes: "",
    folder_id: null,
    category: "login",
    custom_fields: [],
    ...overrides,
  };
}

describe("Login CRUD", () => {
  let vault: UnlockedVault;

  beforeEach(async () => {
    vault = await freshUnlockedVault();
  });

  it("adds a login", () => {
    const login = vault.addLogin(newLogin({ title: "GitHub", url: "https://github.com", username: "octocat", password: "s3cr3t" }));
    expect(login.id).toBeTruthy();
    expect(vault.logins).toHaveLength(1);
  });

  it("edits a login", () => {
    const login = vault.addLogin(newLogin());
    const updated = vault.updateLogin(login.id, { password: "new-password" });
    expect(updated.password).toBe("new-password");
    expect(updated.id).toBe(login.id);
    expect(updated.created_at).toBe(login.created_at);
  });

  it("starts with empty history", () => {
    const login = vault.addLogin(newLogin());
    expect(login.history).toEqual([]);
  });

  it("records a history entry with the old values when a tracked field changes", () => {
    const login = vault.addLogin(newLogin({ password: "old-password" }));
    const updated = vault.updateLogin(login.id, { password: "new-password" });
    expect(updated.history).toHaveLength(1);
    expect(updated.history[0]!.password).toBe("old-password");
    expect(updated.history[0]!.title).toBe("A");
  });

  it("does not add a history entry when nothing actually changes", () => {
    const login = vault.addLogin(newLogin());
    const updated = vault.updateLogin(login.id, { password: "p" });
    expect(updated.history).toEqual([]);
  });

  it("accumulates history entries newest-first across multiple edits", () => {
    const login = vault.addLogin(newLogin({ password: "p1" }));
    vault.updateLogin(login.id, { password: "p2" });
    const updated = vault.updateLogin(login.id, { password: "p3" });
    expect(updated.history).toHaveLength(2);
    expect(updated.history[0]!.password).toBe("p2");
    expect(updated.history[1]!.password).toBe("p1");
  });

  it("caps history at MAX_LOGIN_HISTORY_ENTRIES", () => {
    const login = vault.addLogin(newLogin({ password: "p0" }));
    const id = login.id;
    let updated = login;
    for (let i = 1; i <= 25; i++) {
      updated = vault.updateLogin(id, { password: `p${i}` });
    }
    expect(updated.history).toHaveLength(20);
    expect(updated.history[0]!.password).toBe("p24");
  });

  it("records a history entry when the category changes", () => {
    const login = vault.addLogin(newLogin({ category: "login", custom_fields: [] }));
    const updated = vault.updateLogin(login.id, {
      category: "bank",
      custom_fields: [{ label: "Account number", value: "12345" }],
    });
    expect(updated.category).toBe("bank");
    expect(updated.history).toHaveLength(1);
    expect(updated.history[0]!.category).toBe("login");
    expect(updated.history[0]!.custom_fields).toEqual([]);
  });

  it("records a history entry when a custom field value changes, compared by value not reference", () => {
    const login = vault.addLogin(newLogin({ category: "bank", custom_fields: [{ label: "Account number", value: "111" }] }));
    const noOp = vault.updateLogin(login.id, { custom_fields: [{ label: "Account number", value: "111" }] });
    expect(noOp.history).toEqual([]);

    const updated = vault.updateLogin(login.id, { custom_fields: [{ label: "Account number", value: "222" }] });
    expect(updated.history).toHaveLength(1);
    expect(updated.history[0]!.custom_fields).toEqual([{ label: "Account number", value: "111" }]);
  });

  it("deletes a login", () => {
    const login = vault.addLogin(newLogin());
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
    vault.addLogin(newLogin({ title: "GitHub", url: "https://github.com", username: "octocat" }));
    vault.addLogin(newLogin({ title: "Gitlab", url: "https://gitlab.com", username: "someone" }));
    vault.addLogin(newLogin({ title: "Bank Portal", url: "https://mybank.example", username: "octocat" }));
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
    const login = vault.addLogin(newLogin({ folder_id: folder.id }));

    vault.deleteFolder(folder.id);

    expect(vault.folders).toHaveLength(0);
    expect(vault.logins).toHaveLength(1);
    expect(vault.logins.find((l) => l.id === login.id)?.folder_id).toBeNull();
  });
});

describe("lock()", () => {
  it("prevents further use of the vault after locking", async () => {
    const vault = await freshUnlockedVault();
    vault.addLogin(newLogin());
    vault.lock();
    expect(() => vault.logins).toThrow(VaultError);
    expect(() => vault.search("A")).toThrow(VaultError);
  });
});

describe("changeMasterPassword", () => {
  it("unlocks with the new password and no longer with the old one", async () => {
    const { container } = await createVault("old-password");
    const unlocked = await unlockVault(container, "old-password");
    unlocked.addLogin(newLogin());
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
