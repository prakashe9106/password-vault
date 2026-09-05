import { afterEach, describe, expect, it, vi } from "vitest";
import {
  OneDriveApiError,
  VAULT_FILE_NAME,
  createVaultFile,
  createVaultFolder,
  findVaultFile,
  findVaultFolder,
  getFileContent,
  getFileMeta,
  updateFileContent,
} from "../src/lib/oneDriveClient";

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
  it("resolves the app's approot id", async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockResponse({ id: "approot-1" }));
    vi.stubGlobal("fetch", fetchMock);

    const id = await findVaultFolder("token-abc");

    expect(id).toBe("approot-1");
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toContain("/me/drive/special/approot");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer token-abc");
  });
});

describe("createVaultFolder", () => {
  it("also just resolves the approot id — Graph auto-creates it", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse({ id: "approot-1" })));
    expect(await createVaultFolder("token")).toBe("approot-1");
  });
});

describe("findVaultFile", () => {
  it("returns file metadata mapped from eTag/lastModifiedDateTime", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(mockResponse({ id: "file-1", eTag: "etag-1", lastModifiedDateTime: "t" }));
    vi.stubGlobal("fetch", fetchMock);

    const file = await findVaultFile("token", "approot-1");

    expect(file).toEqual({ id: "file-1", headRevisionId: "etag-1", modifiedTime: "t" });
    const [url] = fetchMock.mock.calls[0]!;
    expect(url).toContain(VAULT_FILE_NAME);
  });

  it("returns null when the vault file doesn't exist yet (404)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse("not found", false, 404, true)));
    expect(await findVaultFile("token", "approot-1")).toBeNull();
  });

  it("rethrows non-404 errors", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse("nope", false, 403, true)));
    await expect(findVaultFile("token", "approot-1")).rejects.toMatchObject({ status: 403 });
  });
});

describe("createVaultFile / updateFileContent", () => {
  it("createVaultFile PUTs the content to the approot path", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(mockResponse({ id: "file-1", eTag: "etag-1", lastModifiedDateTime: "t" }));
    vi.stubGlobal("fetch", fetchMock);

    const meta = await createVaultFile("token", "approot-1", '{"hello":"world"}');

    expect(meta).toEqual({ id: "file-1", headRevisionId: "etag-1", modifiedTime: "t" });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toContain(`${VAULT_FILE_NAME}:/content`);
    expect(init.method).toBe("PUT");
    expect(init.body).toBe('{"hello":"world"}');
  });

  it("updateFileContent PUTs to the same path — one call serves both create and update", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(mockResponse({ id: "file-1", eTag: "etag-2", lastModifiedDateTime: "t2" }));
    vi.stubGlobal("fetch", fetchMock);

    const meta = await updateFileContent("token", "file-1", '{"a":1}');

    expect(meta.headRevisionId).toBe("etag-2");
    const [, init] = fetchMock.mock.calls[0]!;
    expect(init.method).toBe("PUT");
    expect(init.body).toBe('{"a":1}');
  });
});

describe("getFileContent / getFileMeta", () => {
  it("getFileContent fetches the content path and returns raw text", async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockResponse("raw-content", true, 200, true));
    vi.stubGlobal("fetch", fetchMock);

    const content = await getFileContent("token", "file-1");

    expect(content).toBe("raw-content");
    expect(fetchMock.mock.calls[0]![0]).toContain(":/content");
  });

  it("getFileMeta returns metadata mapped from eTag", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(mockResponse({ id: "file-1", eTag: "etag-3", lastModifiedDateTime: "t3" }));
    vi.stubGlobal("fetch", fetchMock);

    const meta = await getFileMeta("token", "file-1");

    expect(meta).toEqual({ id: "file-1", headRevisionId: "etag-3", modifiedTime: "t3" });
  });
});

describe("error handling", () => {
  it("throws OneDriveApiError with the response status on a non-ok response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse("nope", false, 403, true)));
    await expect(getFileMeta("token", "file-1")).rejects.toMatchObject({
      status: 403,
      name: "OneDriveApiError",
    });
  });

  it("OneDriveApiError is an instance of Error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse("nope", false, 401, true)));
    try {
      await getFileMeta("token", "file-1");
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(OneDriveApiError);
      expect(err).toBeInstanceOf(Error);
    }
  });
});
