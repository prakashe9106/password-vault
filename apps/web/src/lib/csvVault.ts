import Papa from "papaparse";
import type { Folder, Login } from "@vault/core";
import type { LoginFormValues } from "../screens/LoginEditorScreen";

/**
 * CSV import/export, kept as pure functions (no DOM, no vault-core changes) so they're easy to
 * unit-test. Uses papaparse for RFC-4180-correct quoting/escaping rather than hand-rolling a CSV
 * parser for a security-adjacent data path (a vault's full plaintext, on both sides).
 */

const EXPORT_COLUMNS = ["title", "url", "username", "password", "notes", "folder"] as const;

export type ImportField = "title" | "url" | "username" | "password" | "notes" | "folder";

export type ColumnMapping = Partial<Record<ImportField, string>>;

/** Known aliases seen in Chrome's, Bitwarden's, and LastPass's own CSV exports. */
const FIELD_ALIASES: Record<ImportField, string[]> = {
  title: ["title", "name"],
  url: ["url", "uri", "login_uri", "website"],
  username: ["username", "login", "login_username", "user"],
  password: ["password", "login_password"],
  notes: ["notes", "note", "extra"],
  folder: ["folder", "grouping", "group"],
};

export function exportLoginsToCsv(logins: readonly Login[], folders: readonly Folder[]): string {
  const folderNameById = new Map(folders.map((f) => [f.id, f.name]));
  const rows = logins.map((login) => ({
    title: login.title,
    url: login.url,
    username: login.username,
    password: login.password,
    notes: login.notes,
    folder: login.folder_id ? (folderNameById.get(login.folder_id) ?? "") : "",
  }));
  return Papa.unparse({ fields: [...EXPORT_COLUMNS], data: rows });
}

export interface ParsedCsv {
  headers: string[];
  rows: string[][];
}

export function parseCsvFile(text: string): ParsedCsv {
  const result = Papa.parse<string[]>(text.trim(), { skipEmptyLines: true });
  const [headers, ...rows] = result.data;
  return { headers: headers ?? [], rows };
}

/** Case-insensitive, alias-based best guess — always user-correctable in the mapping UI. */
export function guessColumnMapping(headers: string[]): ColumnMapping {
  const normalized = headers.map((h) => h.trim().toLowerCase());
  const mapping: ColumnMapping = {};
  for (const field of Object.keys(FIELD_ALIASES) as ImportField[]) {
    const aliases = FIELD_ALIASES[field];
    const index = normalized.findIndex((h) => aliases.includes(h));
    if (index !== -1) mapping[field] = headers[index];
  }
  return mapping;
}

export interface ImportedLoginRow {
  values: LoginFormValues;
  /** The folder's name as text from the CSV — the caller resolves/creates the actual folder_id. */
  folderName: string | null;
}

export function rowsToImportedLogins(rows: string[][], headers: string[], mapping: ColumnMapping): ImportedLoginRow[] {
  const indexOf = (field: ImportField): number => {
    const column = mapping[field];
    return column === undefined ? -1 : headers.indexOf(column);
  };
  const indices: Record<ImportField, number> = {
    title: indexOf("title"),
    url: indexOf("url"),
    username: indexOf("username"),
    password: indexOf("password"),
    notes: indexOf("notes"),
    folder: indexOf("folder"),
  };
  const cell = (row: string[], index: number): string => (index >= 0 ? (row[index] ?? "") : "");

  return rows.map((row) => {
    const folderName = cell(row, indices.folder).trim();
    return {
      values: {
        title: cell(row, indices.title),
        url: cell(row, indices.url),
        username: cell(row, indices.username),
        password: cell(row, indices.password),
        notes: cell(row, indices.notes),
        folder_id: null,
      },
      folderName: folderName ? folderName : null,
    };
  });
}
