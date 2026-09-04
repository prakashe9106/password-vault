import { beforeAll, describe, expect, it } from "vitest";
import { parseContainer, serializeContainer } from "../src/container.js";
import { ready } from "../src/crypto.js";
import { CorruptContainerError, VersionUnsupportedError, WrongPasswordError } from "../src/errors.js";
import { createVault, unlockVault, unlockVaultWithRecovery } from "../src/vault.js";

beforeAll(async () => {
  await ready();
});

describe("createVault -> serialize -> parse -> unlock round trip", () => {
  it("unlocks with the master password and returns the vault created", async () => {
    const { container, recoveryCode } = await createVault("correct horse battery staple");
    const raw = serializeContainer(container);
    const parsed = parseContainer(raw);

    const unlocked = await unlockVault(parsed, "correct horse battery staple");
    expect(unlocked.logins).toEqual([]);
    expect(unlocked.folders).toEqual([]);
    expect(recoveryCode).toMatch(/^[0-9A-Z-]+$/);
  });

  it("also unlocks with the recovery code independently of the master password", async () => {
    const { container, recoveryCode } = await createVault("correct horse battery staple");
    const unlocked = await unlockVaultWithRecovery(container, recoveryCode);
    expect(unlocked.logins).toEqual([]);
  });

  it("rejects the wrong master password", async () => {
    const { container } = await createVault("correct horse battery staple");
    await expect(unlockVault(container, "wrong password")).rejects.toThrow(WrongPasswordError);
  });

  it("rejects a wrong recovery code", async () => {
    const { container } = await createVault("correct horse battery staple");
    await expect(unlockVaultWithRecovery(container, "0000000000000000000000000000000000")).rejects.toThrow(
      WrongPasswordError,
    );
  });

  it("preserves data added before serialize() across a reload", async () => {
    const { container } = await createVault("correct horse battery staple");
    const unlocked = await unlockVault(container, "correct horse battery staple");
    unlocked.addLogin({ title: "Example", url: "https://example.com", username: "me", password: "p", notes: "", folder_id: null });

    const reserialized = unlocked.serialize();
    const raw = serializeContainer(reserialized);
    const reloaded = await unlockVault(parseContainer(raw), "correct horse battery staple");

    expect(reloaded.logins).toHaveLength(1);
    expect(reloaded.logins[0]?.title).toBe("Example");
  });
});

describe("parseContainer version handling", () => {
  it("throws CorruptContainerError on invalid JSON", () => {
    expect(() => parseContainer("not json")).toThrow(CorruptContainerError);
  });

  it("throws VersionUnsupportedError on an unknown format_version", async () => {
    const { container } = await createVault("pw");
    const raw = serializeContainer({ ...container, format_version: 999 });
    expect(() => parseContainer(raw)).toThrow(VersionUnsupportedError);
  });

  it("throws VersionUnsupportedError on an unknown crypto_version", async () => {
    const { container } = await createVault("pw");
    const raw = serializeContainer({ ...container, crypto_version: 999 });
    expect(() => parseContainer(raw)).toThrow(VersionUnsupportedError);
  });
});

describe("tamper resistance via AAD binding", () => {
  it("fails to unlock if vault_id is altered after creation", async () => {
    const { container } = await createVault("correct horse battery staple");
    const tampered = { ...container, vault_id: "00000000-0000-0000-0000-000000000000" };
    await expect(unlockVault(tampered, "correct horse battery staple")).rejects.toThrow();
  });
});
