import { beforeEach, describe, expect, it, vi } from "vitest";
import type { StorageProvider } from "../src/lib/storageProvider";

const PROVIDER: StorageProvider = "google-drive";

// syncStore.ts calls through the `googleDriveProvider` object, not the bare named exports, so
// that's the only thing that needs mocking here.
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

vi.mock("../src/lib/googleAuth", () => ({
  requestAccessToken: vi.fn(),
}));

const driveClientModule = await import("../src/lib/driveClient");
const googleAuthModule = await import("../src/lib/googleAuth");
const { DriveApiError } = driveClientModule; // spread from the real module inside the factory above

const mockFindVaultFolder = vi.mocked(driveClientModule.googleDriveProvider.findVaultFolder);
const mockCreateVaultFolder = vi.mocked(driveClientModule.googleDriveProvider.createVaultFolder);
const mockFindVaultFile = vi.mocked(driveClientModule.googleDriveProvider.findVaultFile);
const mockCreateVaultFile = vi.mocked(driveClientModule.googleDriveProvider.createVaultFile);
const mockGetFileContent = vi.mocked(driveClientModule.googleDriveProvider.getFileContent);
const mockGetFileMeta = vi.mocked(driveClientModule.googleDriveProvider.getFileMeta);
const mockUpdateFileContent = vi.mocked(driveClientModule.googleDriveProvider.updateFileContent);
const mockRequestAccessToken = vi.mocked(googleAuthModule.requestAccessToken);

// Imported after the mocks above so syncStore picks up the mocked modules.
const {
  resolveRemoteState,
  uploadNow,
  resolveConflictKeepMine,
  resolveConflictUseTheirs,
  createInitialRemoteFile,
  getSyncSnapshot,
} = await import("../src/state/syncStore");
const { saveContainer, saveStorageLink, getStorageLink, listVaultIndex, loadContainer } = await import(
  "../src/storage/indexedDbAdapter"
);

function fakeContainerJson(vaultId: string): string {
  return JSON.stringify({
    format_version: 1,
    crypto_version: 1,
    vault_id: vaultId,
    header: { kdf_alg: "argon2id" },
    envelopes: {
      password: { salt: "s", opslimit: 3, memlimit: 1, nonce: "n", wrapped_key: "w" },
      recovery: { salt: "s", opslimit: 3, memlimit: 1, nonce: "n", wrapped_key: "w" },
    },
    payload: { nonce: "n", ciphertext: "c" },
    revision: 1,
    updated_at: new Date().toISOString(),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("resolveRemoteState", () => {
  it("returns 'fresh' when there's no remote folder and no local vault", async () => {
    mockFindVaultFolder.mockResolvedValue(null);
    const result = await resolveRemoteState(PROVIDER, "token");
    expect(result).toEqual({ kind: "fresh" });
  });

  it("returns 'local-orphan' when a local vault exists with no storage link yet", async () => {
    mockFindVaultFolder.mockResolvedValue(null);
    await saveContainer("vault-orphan", fakeContainerJson("vault-orphan"), "Orphan Vault");

    const result = await resolveRemoteState(PROVIDER, "token");

    expect(result).toEqual({ kind: "local-orphan", vaultId: "vault-orphan", vaultName: "Orphan Vault" });
  });

  it("downloads and caches the remote file when found, returning 'remote-found'", async () => {
    mockFindVaultFolder.mockResolvedValue("folder-1");
    mockFindVaultFile.mockResolvedValue({ id: "file-1", headRevisionId: "r1", modifiedTime: "t" });
    const remoteRaw = fakeContainerJson("vault-remote");
    mockGetFileContent.mockResolvedValue(remoteRaw);

    const result = await resolveRemoteState(PROVIDER, "token");

    expect(result).toEqual({ kind: "remote-found", vaultId: "vault-remote", vaultName: "My Vault" });
    const link = await getStorageLink("vault-remote");
    expect(link).toMatchObject({ provider: PROVIDER, folder_id: "folder-1", file_id: "file-1", last_known_head_revision_id: "r1" });
    expect(getSyncSnapshot().status).toBe("synced");
  });
});

describe("uploadNow", () => {
  it("marks the vault pending and does not call the provider when there is no access token", async () => {
    await saveContainer("vault-a", fakeContainerJson("vault-a"), "A");
    await saveStorageLink({
      vault_id: "vault-a",
      provider: PROVIDER,
      folder_id: "f",
      file_id: "file-a",
      last_known_head_revision_id: "r1",
      last_synced_at: "t",
      pending_upload: false,
    });

    await uploadNow(PROVIDER, null, "vault-a", fakeContainerJson("vault-a"));

    expect(mockGetFileMeta).not.toHaveBeenCalled();
    const link = await getStorageLink("vault-a");
    expect(link?.pending_upload).toBe(true);
    expect(getSyncSnapshot().status).toBe("offline-pending");
  });

  it("uploads a brand new file when no storage link exists yet for this vault", async () => {
    mockFindVaultFolder.mockResolvedValue("folder-1");
    mockCreateVaultFile.mockResolvedValue({ id: "file-new", headRevisionId: "r1", modifiedTime: "t" });
    const raw = fakeContainerJson("vault-new");

    await uploadNow(PROVIDER, "token", "vault-new", raw);

    expect(mockCreateVaultFile).toHaveBeenCalledWith("token", "folder-1", raw);
    const link = await getStorageLink("vault-new");
    expect(link?.file_id).toBe("file-new");
  });

  it("updates the file when the remote revision matches what we last saw", async () => {
    await saveStorageLink({
      vault_id: "vault-b",
      provider: PROVIDER,
      folder_id: "f",
      file_id: "file-b",
      last_known_head_revision_id: "r1",
      last_synced_at: "t",
      pending_upload: false,
    });
    mockGetFileMeta.mockResolvedValue({ id: "file-b", headRevisionId: "r1", modifiedTime: "t" });
    mockUpdateFileContent.mockResolvedValue({ id: "file-b", headRevisionId: "r2", modifiedTime: "t2" });

    await uploadNow(PROVIDER, "token", "vault-b", "new-raw-content");

    expect(mockUpdateFileContent).toHaveBeenCalledWith("token", "file-b", "new-raw-content");
    const link = await getStorageLink("vault-b");
    expect(link?.last_known_head_revision_id).toBe("r2");
    expect(getSyncSnapshot().status).toBe("synced");
  });

  it("flags a conflict instead of overwriting when the remote revision has moved on", async () => {
    await saveStorageLink({
      vault_id: "vault-c",
      provider: PROVIDER,
      folder_id: "f",
      file_id: "file-c",
      last_known_head_revision_id: "r1",
      last_synced_at: "t",
      pending_upload: false,
    });
    mockGetFileMeta.mockResolvedValue({ id: "file-c", headRevisionId: "r-changed", modifiedTime: "t2" });

    await uploadNow(PROVIDER, "token", "vault-c", "my-local-content");

    expect(mockUpdateFileContent).not.toHaveBeenCalled();
    expect(getSyncSnapshot()).toMatchObject({ status: "conflict" });
  });

  it("silently refreshes an expired token (401) once and retries", async () => {
    await saveStorageLink({
      vault_id: "vault-d",
      provider: PROVIDER,
      folder_id: "f",
      file_id: "file-d",
      last_known_head_revision_id: "r1",
      last_synced_at: "t",
      pending_upload: false,
    });
    mockGetFileMeta
      .mockRejectedValueOnce(new DriveApiError("expired", 401))
      .mockResolvedValueOnce({ id: "file-d", headRevisionId: "r1", modifiedTime: "t" });
    mockRequestAccessToken.mockResolvedValue("fresh-token");
    mockUpdateFileContent.mockResolvedValue({ id: "file-d", headRevisionId: "r2", modifiedTime: "t2" });

    await uploadNow(PROVIDER, "stale-token", "vault-d", "content");

    expect(mockRequestAccessToken).toHaveBeenCalledWith(false);
    expect(mockUpdateFileContent).toHaveBeenCalledWith("fresh-token", "file-d", "content");
    expect(getSyncSnapshot().status).toBe("synced");
  });

  it("falls back to offline-pending when the provider call fails for a non-auth reason", async () => {
    await saveStorageLink({
      vault_id: "vault-e",
      provider: PROVIDER,
      folder_id: "f",
      file_id: "file-e",
      last_known_head_revision_id: "r1",
      last_synced_at: "t",
      pending_upload: false,
    });
    mockGetFileMeta.mockRejectedValue(new Error("network down"));

    await uploadNow(PROVIDER, "token", "vault-e", "content");

    const link = await getStorageLink("vault-e");
    expect(link?.pending_upload).toBe(true);
    expect(getSyncSnapshot().status).toBe("offline-pending");
  });
});

describe("conflict resolution", () => {
  it("resolveConflictKeepMine force-uploads and clears the conflict", async () => {
    await saveStorageLink({
      vault_id: "vault-f",
      provider: PROVIDER,
      folder_id: "f",
      file_id: "file-f",
      last_known_head_revision_id: "r1",
      last_synced_at: "t",
      pending_upload: false,
    });
    mockUpdateFileContent.mockResolvedValue({ id: "file-f", headRevisionId: "r-new", modifiedTime: "t2" });

    await resolveConflictKeepMine(PROVIDER, "token", "vault-f", "my-content");

    expect(mockUpdateFileContent).toHaveBeenCalledWith("token", "file-f", "my-content");
    expect(getSyncSnapshot()).toMatchObject({ status: "synced", conflict: null });
  });

  it("resolveConflictUseTheirs overwrites the local cache with the remote content", async () => {
    await saveStorageLink({
      vault_id: "vault-g",
      provider: PROVIDER,
      folder_id: "f",
      file_id: "file-g",
      last_known_head_revision_id: "r1",
      last_synced_at: "t",
      pending_upload: false,
    });
    const remoteRaw = fakeContainerJson("vault-g");
    mockGetFileContent.mockResolvedValue(remoteRaw);
    mockGetFileMeta.mockResolvedValue({ id: "file-g", headRevisionId: "r-remote", modifiedTime: "t2" });

    await resolveConflictUseTheirs(PROVIDER, "token", "vault-g");

    expect(await loadContainer("vault-g")).toBe(remoteRaw);
    const link = await getStorageLink("vault-g");
    expect(link?.last_known_head_revision_id).toBe("r-remote");
  });
});

describe("createInitialRemoteFile", () => {
  it("creates the folder if it doesn't exist yet, then the file", async () => {
    mockFindVaultFolder.mockResolvedValue(null);
    mockCreateVaultFolder.mockResolvedValue("new-folder");
    mockCreateVaultFile.mockResolvedValue({ id: "file-h", headRevisionId: "r1", modifiedTime: "t" });

    await createInitialRemoteFile(PROVIDER, "token", "vault-h", "raw");

    expect(mockCreateVaultFolder).toHaveBeenCalled();
    expect(mockCreateVaultFile).toHaveBeenCalledWith("token", "new-folder", "raw");
    const link = await getStorageLink("vault-h");
    expect(link?.folder_id).toBe("new-folder");
  });
});

// Sanity check that listVaultIndex is usable in this fake-indexeddb environment (used implicitly
// by resolveRemoteState/retryPendingUploads above).
describe("environment sanity", () => {
  it("listVaultIndex reflects saved containers", async () => {
    await saveContainer("vault-sanity", fakeContainerJson("vault-sanity"), "Sanity");
    const entries = await listVaultIndex();
    expect(entries.some((e) => e.vault_id === "vault-sanity")).toBe(true);
  });
});
