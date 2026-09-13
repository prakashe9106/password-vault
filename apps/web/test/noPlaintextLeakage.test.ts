import { beforeEach, describe, expect, it, vi } from "vitest";
import { createVault, serializeContainer, unlockVault } from "@vault/core";

// The PRD's Definition of Done requires "No secret leakage in logs/network telemetry" — this
// file makes that an explicit, checkable regression test rather than an implicit architectural
// guarantee. It uses the real crypto path (not mocked) so the assertion means something.

vi.mock("../src/lib/driveClient", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/lib/driveClient")>();
  return {
    ...actual,
    googleDriveProvider: {
      findVaultFolder: vi.fn(),
      createVaultFolder: vi.fn(),
      findVaultFile: vi.fn(),
      createVaultFile: vi.fn(),
      getFileContent: vi.fn(),
      getFileMeta: vi.fn(),
      updateFileContent: vi.fn(),
    },
  };
});

const driveClientModule = await import("../src/lib/driveClient");
const mockFindVaultFolder = vi.mocked(driveClientModule.googleDriveProvider.findVaultFolder);
const mockCreateVaultFolder = vi.mocked(driveClientModule.googleDriveProvider.createVaultFolder);
const mockCreateVaultFile = vi.mocked(driveClientModule.googleDriveProvider.createVaultFile);

const { createInitialRemoteFile } = await import("../src/state/syncStore");

const PLAINTEXT_TITLE = "My Secret Bank";
const PLAINTEXT_USERNAME = "definitely-not-encrypted-user";
const PLAINTEXT_PASSWORD = "hunter2-super-secret-password";
const MASTER_PASSWORD = "correct horse battery staple";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("no plaintext leakage to Drive", () => {
  // Real Argon2id derivations (createVault + unlockVault) — same order-of-magnitude timing as
  // packages/vault-core's own crypto tests, well past vitest's 5s default.
  it("never sends the plaintext title, username, or password in the uploaded container body", async () => {
    const { container } = await createVault(MASTER_PASSWORD);
    const unlockedVault = await unlockVault(container, MASTER_PASSWORD);
    unlockedVault.addLogin({
      title: PLAINTEXT_TITLE,
      url: "https://example.com",
      username: PLAINTEXT_USERNAME,
      password: PLAINTEXT_PASSWORD,
      notes: "",
      folder_id: null,
      category: "login",
      custom_fields: [],
    });
    const raw = serializeContainer(unlockedVault.serialize());

    mockFindVaultFolder.mockResolvedValue(null);
    mockCreateVaultFolder.mockResolvedValue("folder-1");
    mockCreateVaultFile.mockResolvedValue({ id: "file-1", headRevisionId: "r1", modifiedTime: "t" });

    await createInitialRemoteFile("google-drive", "token", container.vault_id, raw);

    expect(mockCreateVaultFile).toHaveBeenCalledTimes(1);
    const [, , uploadedBody] = mockCreateVaultFile.mock.calls[0]!;
    expect(uploadedBody).not.toContain(PLAINTEXT_TITLE);
    expect(uploadedBody).not.toContain(PLAINTEXT_USERNAME);
    expect(uploadedBody).not.toContain(PLAINTEXT_PASSWORD);
    // Sanity: the body really is the serialized container, not an empty/wrong string.
    expect(uploadedBody).toBe(raw);
    expect(JSON.parse(uploadedBody).vault_id).toBe(container.vault_id);
  }, 60_000);
});
