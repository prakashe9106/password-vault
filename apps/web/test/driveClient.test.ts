import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DriveApiError,
  VAULT_FILE_NAME,
  VAULT_FOLDER_NAME,
  createVaultFile,
  createVaultFolder,
  findVaultFile,
  findVaultFolder,
  getFileContent,
  getFileMeta,
  updateFileContent,
} from "../src/lib/driveClient";

function mockResponse(body: unknown, ok = true, status = 200, isText = false) {
  return {
    ok,
    status,
    json: async () => body,
    text: async () => (isText ? (body as string) : JSON.stringify(body)),
  } as Response;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("findVaultFolder", () => {
  it("queries by name and mime type, returns the first match's id", async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockResponse({ files: [{ id: "folder-123" }] }));
    vi.stubGlobal("fetch", fetchMock);

    const id = await findVaultFolder("token-abc");

    expect(id).toBe("folder-123");
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toContain(encodeURIComponent(VAULT_FOLDER_NAME));
    expect(url).toContain("mimeType");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer token-abc");
  });

  it("returns null when no folder exists yet", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse({ files: [] })));
    expect(await findVaultFolder("token")).toBeNull();
  });
});

describe("createVaultFolder", () => {
  it("posts the folder name and mime type", async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockResponse({ id: "new-folder" }));
    vi.stubGlobal("fetch", fetchMock);

    const id = await createVaultFolder("token");

    expect(id).toBe("new-folder");
    const [, init] = fetchMock.mock.calls[0]!;
    expect(init.method).toBe("POST");
    const body = JSON.parse(init.body as string);
    expect(body.name).toBe(VAULT_FOLDER_NAME);
    expect(body.mimeType).toBe("application/vnd.google-apps.folder");
  });
});

describe("findVaultFile", () => {
  it("scopes the query to the given folder and file name", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(mockResponse({ files: [{ id: "file-1", headRevisionId: "r1", modifiedTime: "t" }] }));
    vi.stubGlobal("fetch", fetchMock);

    const file = await findVaultFile("token", "folder-123");

    expect(file).toEqual({ id: "file-1", headRevisionId: "r1", modifiedTime: "t" });
    const [url] = fetchMock.mock.calls[0]!;
    expect(url).toContain(encodeURIComponent(VAULT_FILE_NAME));
    expect(url).toContain(encodeURIComponent("folder-123"));
  });
});

describe("createVaultFile", () => {
  it("sends a multipart body with metadata and content parts", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(mockResponse({ id: "file-1", headRevisionId: "r1", modifiedTime: "t" }));
    vi.stubGlobal("fetch", fetchMock);

    await createVaultFile("token", "folder-123", '{"hello":"world"}');

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toContain("uploadType=multipart");
    expect((init.headers as Record<string, string>)["Content-Type"]).toMatch(/^multipart\/related; boundary=/);
    expect(init.body as string).toContain(VAULT_FILE_NAME);
    expect(init.body as string).toContain("folder-123");
    expect(init.body as string).toContain('{"hello":"world"}');
  });
});

describe("getFileContent / getFileMeta / updateFileContent", () => {
  it("getFileContent fetches with alt=media and returns raw text", async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockResponse("raw-content", true, 200, true));
    vi.stubGlobal("fetch", fetchMock);

    const content = await getFileContent("token", "file-1");

    expect(content).toBe("raw-content");
    expect(fetchMock.mock.calls[0]![0]).toContain("alt=media");
  });

  it("getFileMeta requests headRevisionId and modifiedTime fields", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(mockResponse({ id: "file-1", headRevisionId: "r2", modifiedTime: "t2" }));
    vi.stubGlobal("fetch", fetchMock);

    const meta = await getFileMeta("token", "file-1");

    expect(meta.headRevisionId).toBe("r2");
    expect(fetchMock.mock.calls[0]![0]).toContain("fields=");
  });

  it("updateFileContent PATCHes with uploadType=media and no multipart", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(mockResponse({ id: "file-1", headRevisionId: "r3", modifiedTime: "t3" }));
    vi.stubGlobal("fetch", fetchMock);

    const meta = await updateFileContent("token", "file-1", '{"a":1}');

    expect(meta.headRevisionId).toBe("r3");
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toContain("uploadType=media");
    expect(init.method).toBe("PATCH");
    expect(init.body).toBe('{"a":1}');
  });
});

describe("error handling", () => {
  it("throws DriveApiError with the response status on a non-ok response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse("nope", false, 403, true)));
    await expect(getFileMeta("token", "file-1")).rejects.toMatchObject({
      status: 403,
      name: "DriveApiError",
    });
  });

  it("DriveApiError is an instance of Error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse("nope", false, 401, true)));
    try {
      await getFileMeta("token", "file-1");
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(DriveApiError);
      expect(err).toBeInstanceOf(Error);
    }
  });
});
