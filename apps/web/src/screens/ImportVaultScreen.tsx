import { useState } from "react";
import Modal from "../components/Modal";
import {
  guessColumnMapping,
  parseCsvFile,
  rowsToImportedLogins,
  type ColumnMapping,
  type ImportField,
  type ImportedLoginRow,
} from "../lib/csvVault";

interface Props {
  onImport: (rows: ImportedLoginRow[]) => Promise<void>;
  onCancel: () => void;
}

const FIELD_LABELS: Record<ImportField, string> = {
  title: "Title",
  url: "Website URL",
  username: "Username",
  password: "Password",
  notes: "Notes",
  folder: "Folder",
};

const FIELDS = Object.keys(FIELD_LABELS) as ImportField[];

interface ParsedState {
  headers: string[];
  rows: string[][];
  mapping: ColumnMapping;
}

export default function ImportVaultScreen({ onImport, onCancel }: Props) {
  const [parsed, setParsed] = useState<ParsedState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    try {
      const text = await file.text();
      const { headers, rows } = parseCsvFile(text);
      if (headers.length === 0 || rows.length === 0) {
        setError("That file doesn't look like a CSV with any rows.");
        return;
      }
      setParsed({ headers, rows, mapping: guessColumnMapping(headers) });
    } catch {
      setError("Couldn't read that file.");
    }
  }

  function updateMapping(field: ImportField, column: string) {
    if (!parsed) return;
    setParsed({ ...parsed, mapping: { ...parsed.mapping, [field]: column || undefined } });
  }

  async function handleConfirm() {
    if (!parsed) return;
    if (!parsed.mapping.password) {
      setError("Choose which column holds the password before importing.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const imported = rowsToImportedLogins(parsed.rows, parsed.headers, parsed.mapping);
      await onImport(imported);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal titleId="import-vault-title" onClose={onCancel} maxWidth={520}>
      <h1 id="import-vault-title">Import from CSV</h1>
      <p className="hint-text">
        Works with exports from this app, Chrome, Bitwarden, LastPass, and most other password
        managers — pick the file, then check the column guesses below.
      </p>

      {!parsed && (
        <div className="field">
          <label className="field-label" htmlFor="import-file">
            CSV file
          </label>
          <input id="import-file" type="file" accept=".csv,text/csv" onChange={handleFileChange} />
        </div>
      )}

      {parsed && (
        <>
          <p className="hint-text">{parsed.rows.length} rows found. Match each field to a column:</p>
          {FIELDS.map((field) => (
            <div className="field" key={field}>
              <label className="field-label" htmlFor={`map-${field}`}>
                {FIELD_LABELS[field]}
                {field === "password" ? " (required)" : ""}
              </label>
              <select
                id={`map-${field}`}
                value={parsed.mapping[field] ?? ""}
                onChange={(e) => updateMapping(field, e.target.value)}
              >
                <option value="">— none —</option>
                {parsed.headers.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </>
      )}

      {error && (
        <p className="error-text" role="alert">
          {error}
        </p>
      )}

      <div className="row" style={{ marginTop: "1rem" }}>
        {parsed && (
          <button onClick={handleConfirm} disabled={busy}>
            {busy ? "Importing…" : `Import ${parsed.rows.length} logins`}
          </button>
        )}
        <button type="button" className="secondary" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
      </div>
    </Modal>
  );
}
