// @vitest-environment node
//
// libsodium-wrappers-sumo's browser-detection path (triggered by jsdom's `window` global, the
// suite's default environment for DOM-based form-detection tests) hits an "unsupported input
// type for password" error under jsdom specifically — a jsdom-emulation artifact, not a real
// bug: vault-core's own Node-environment tests and the actual extension running in a real
// browser both work correctly. Run this crypto-heavy file under plain Node instead.
import { beforeAll, describe, expect, it, vi } from "vitest";
import { installChromeMock } from "./chromeMock";

beforeAll(() => {
  installChromeMock();
});

/**
 * `vi.resetModules()` + re-import gives us a genuinely fresh module instance — i.e. `liveVault`
 * reset to null — while chrome.storage's mocked backing data (set up once via installChromeMock)
 * persists, exactly mirroring what a real MV3 service worker restart looks like.
 */
async function freshModule() {
  vi.resetModules();
  return import("../src/background/vaultSession");
}

describe("createNewVault", () => {
  it("creates a vault and leaves it live and unlocked", async () => {
    const mod = await freshModule();
    const recoveryCode = await mod.createNewVault("correct horse battery staple", "My Vault");
    expect(recoveryCode).toMatch(/^[0-9A-Z-]+$/);
    expect(mod.getLiveVault()).not.toBeNull();
    expect(mod.getLiveVault()!.logins).toEqual([]);
  });
});

describe("service worker restart survival", () => {
  it("rehydrates a live session on a fresh module instance without the master password", async () => {
    const mod1 = await freshModule();
    await mod1.createNewVault("correct horse battery staple", "My Vault");
    mod1.getLiveVault()!.addLogin({
      title: "A",
      url: "https://a.com",
      username: "u",
      password: "p",
      notes: "",
      folder_id: null,
      category: "login",
      custom_fields: [],
    });
    await mod1.persistLiveVault();

    const mod2 = await freshModule();
    expect(mod2.getLiveVault()).toBeNull(); // confirms this really is fresh module state

    const rehydrated = await mod2.rehydrateFromSession();
    expect(rehydrated).not.toBeNull();
    expect(rehydrated!.logins).toHaveLength(1);
    expect(rehydrated!.logins[0]?.title).toBe("A");
  });

  it("treats an expired auto-lock timeout as locked on rehydrate", async () => {
    const mod1 = await freshModule();
    await mod1.createNewVault("correct horse battery staple", "My Vault");
    mod1.getLiveVault()!.updateSettings({ auto_lock_minutes: 1 });
    await mod1.persistLiveVault();

    // Simulate 5 minutes of elapsed time against a 1-minute auto-lock setting.
    await chrome.storage.session.set({ lastActivity: Date.now() - 5 * 60_000 });

    const mod2 = await freshModule();
    expect(await mod2.rehydrateFromSession()).toBeNull();
  });

  it("does not treat 'never' (0 minutes) auto-lock as expired", async () => {
    const mod1 = await freshModule();
    await mod1.createNewVault("correct horse battery staple", "My Vault");
    mod1.getLiveVault()!.updateSettings({ auto_lock_minutes: 0 });
    await mod1.persistLiveVault();

    await chrome.storage.session.set({ lastActivity: Date.now() - 24 * 60 * 60_000 });

    const mod2 = await freshModule();
    expect(await mod2.rehydrateFromSession()).not.toBeNull();
  });
});

describe("lock / unlock", () => {
  it("clears the session on lock, so rehydrate returns null afterward", async () => {
    const mod = await freshModule();
    await mod.createNewVault("correct horse battery staple", "My Vault");
    await mod.lockVault();
    expect(await mod.rehydrateFromSession()).toBeNull();
  });

  it("unlocks again with the correct master password after a lock", async () => {
    const mod = await freshModule();
    await mod.createNewVault("correct horse battery staple", "My Vault");
    await mod.lockVault();
    await mod.unlockWithPassword("correct horse battery staple");
    expect(mod.getLiveVault()).not.toBeNull();
  });

  it("rejects the wrong master password", async () => {
    const mod = await freshModule();
    await mod.createNewVault("correct horse battery staple", "My Vault");
    await mod.lockVault();
    await expect(mod.unlockWithPassword("wrong password")).rejects.toThrow();
  });

  it("unlocks with the recovery code independently of the master password", async () => {
    const mod = await freshModule();
    const recoveryCode = await mod.createNewVault("correct horse battery staple", "My Vault");
    await mod.lockVault();
    await mod.unlockWithRecoveryCode(recoveryCode);
    expect(mod.getLiveVault()).not.toBeNull();
  });
});

describe("no plaintext leakage to chrome.storage.local", () => {
  // The PRD's Definition of Done requires "No secret leakage in logs/network telemetry" — this
  // makes that an explicit, checkable regression test for the extension's on-disk cache.
  it("never persists the plaintext title, username, or password of a saved login", async () => {
    const PLAINTEXT_TITLE = "My Secret Bank";
    const PLAINTEXT_USERNAME = "definitely-not-encrypted-user";
    const PLAINTEXT_PASSWORD = "hunter2-super-secret-password";

    const mod = await freshModule();
    await mod.createNewVault("correct horse battery staple", "My Vault");
    mod.getLiveVault()!.addLogin({
      title: PLAINTEXT_TITLE,
      url: "https://example.com",
      username: PLAINTEXT_USERNAME,
      password: PLAINTEXT_PASSWORD,
      notes: "",
      folder_id: null,
      category: "login",
      custom_fields: [],
    });
    await mod.persistLiveVault();

    const stored = (await chrome.storage.local.get("vaultContainer")) as {
      vaultContainer?: { raw: string };
    };
    const raw = stored.vaultContainer?.raw;
    expect(raw).toBeDefined();
    expect(raw).not.toContain(PLAINTEXT_TITLE);
    expect(raw).not.toContain(PLAINTEXT_USERNAME);
    expect(raw).not.toContain(PLAINTEXT_PASSWORD);
  });
});
