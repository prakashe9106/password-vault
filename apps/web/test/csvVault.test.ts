import { describe, expect, it } from "vitest";
import type { Folder, Login } from "@vault/core";
import { exportLoginsToCsv, guessColumnMapping, parseCsvFile, rowsToImportedLogins } from "../src/lib/csvVault";

function login(overrides: Partial<Login> = {}): Login {
  return {
    id: "id-1",
    title: "Example",
    url: "https://example.com",
    username: "user@example.com",
    password: "hunter2",
    notes: "some notes",
    folder_id: null,
    category: "login",
    custom_fields: [],
    created_at: "2024-01-01T00:00:00.000Z",
    updated_at: "2024-01-01T00:00:00.000Z",
    history: [],
    ...overrides,
  };
}

function folder(overrides: Partial<Folder> = {}): Folder {
  return {
    id: "folder-1",
    name: "Work",
    created_at: "2024-01-01T00:00:00.000Z",
    updated_at: "2024-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("exportLoginsToCsv / round trip", () => {
  it("exports and re-imports a login losslessly, including its folder name", () => {
    const folders = [folder()];
    const logins = [login({ folder_id: "folder-1" }), login({ id: "id-2", title: "No folder", folder_id: null })];

    const csv = exportLoginsToCsv(logins, folders);
    const { headers, rows } = parseCsvFile(csv);
    const mapping = guessColumnMapping(headers);
    const imported = rowsToImportedLogins(rows, headers, mapping);

    expect(imported).toHaveLength(2);
    expect(imported[0]?.values).toMatchObject({
      title: "Example",
      url: "https://example.com",
      username: "user@example.com",
      password: "hunter2",
      notes: "some notes",
    });
    expect(imported[0]?.folderName).toBe("Work");
    expect(imported[1]?.folderName).toBeNull();
  });

  it("correctly escapes values containing commas and quotes", () => {
    const csv = exportLoginsToCsv([login({ notes: 'has a "quote", and a comma' })], []);
    const { headers, rows } = parseCsvFile(csv);
    const mapping = guessColumnMapping(headers);
    const imported = rowsToImportedLogins(rows, headers, mapping);
    expect(imported[0]?.values.notes).toBe('has a "quote", and a comma');
  });
});

describe("guessColumnMapping", () => {
  it("recognizes our own export headers", () => {
    const mapping = guessColumnMapping(["title", "url", "username", "password", "notes", "folder"]);
    expect(mapping).toEqual({
      title: "title",
      url: "url",
      username: "username",
      password: "password",
      notes: "notes",
      folder: "folder",
    });
  });

  it("recognizes Chrome's export headers", () => {
    const mapping = guessColumnMapping(["name", "url", "username", "password", "note"]);
    expect(mapping).toMatchObject({ title: "name", url: "url", username: "username", password: "password", notes: "note" });
  });

  it("recognizes LastPass's export headers", () => {
    const mapping = guessColumnMapping(["url", "username", "password", "extra", "name", "grouping", "fav"]);
    expect(mapping).toMatchObject({
      url: "url",
      username: "username",
      password: "password",
      notes: "extra",
      title: "name",
      folder: "grouping",
    });
  });

  it("recognizes Bitwarden-style login column names", () => {
    const mapping = guessColumnMapping(["name", "login_uri", "login_username", "login_password"]);
    expect(mapping).toMatchObject({ title: "name", url: "login_uri", username: "login_username", password: "login_password" });
  });

  it("leaves a field unmapped when no header matches", () => {
    const mapping = guessColumnMapping(["title", "url"]);
    expect(mapping.password).toBeUndefined();
  });

  it("is case-insensitive", () => {
    const mapping = guessColumnMapping(["Title", "URL", "Username", "Password"]);
    expect(mapping).toMatchObject({ title: "Title", url: "URL", username: "Username", password: "Password" });
  });
});

describe("rowsToImportedLogins", () => {
  it("fills missing/unmapped fields with empty strings rather than throwing", () => {
    const { headers, rows } = parseCsvFile("title,password\nSite A,pw123");
    const mapping = guessColumnMapping(headers);
    const imported = rowsToImportedLogins(rows, headers, mapping);
    expect(imported).toEqual([
      {
        values: {
          title: "Site A",
          url: "",
          username: "",
          password: "pw123",
          notes: "",
          folder_id: null,
          category: "login",
          custom_fields: [],
        },
        folderName: null,
      },
    ]);
  });
});
