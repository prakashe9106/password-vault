import { useState } from "react";
import type { Folder, Login } from "@vault/core";
import { defaultGeneratorRules, generatePasswordAsync } from "@vault/core";
import Modal from "../components/Modal";

export interface LoginFormValues {
  title: string;
  url: string;
  username: string;
  password: string;
  notes: string;
  folder_id: string | null;
}

interface Props {
  existing?: Login;
  folders: readonly Folder[];
  onSave: (values: LoginFormValues) => void;
  onCancel: () => void;
}

function folderName(folders: readonly Folder[], folderId: string | null): string {
  if (folderId === null) return "No folder";
  return folders.find((f) => f.id === folderId)?.name ?? "Folder no longer exists";
}

export default function LoginEditorScreen({ existing, folders, onSave, onCancel }: Props) {
  const [values, setValues] = useState<LoginFormValues>({
    title: existing?.title ?? "",
    url: existing?.url ?? "",
    username: existing?.username ?? "",
    password: existing?.password ?? "",
    notes: existing?.notes ?? "",
    folder_id: existing?.folder_id ?? null,
  });
  const [showHistory, setShowHistory] = useState(false);

  function update<K extends keyof LoginFormValues>(key: K, value: LoginFormValues[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  async function handleGenerate() {
    const password = await generatePasswordAsync(defaultGeneratorRules());
    update("password", password);
  }

  return (
    <Modal titleId="login-editor-title" onClose={onCancel}>
      <h2 id="login-editor-title">{existing ? "Edit login" : "Add login"}</h2>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSave(values);
        }}
      >
        <label className="field-label" htmlFor="ext-title">
          Title
        </label>
        <input
          id="ext-title"
          value={values.title}
          onChange={(e) => update("title", e.target.value)}
          required
        />
        <label className="field-label" htmlFor="ext-url">
          Website URL
        </label>
        <input id="ext-url" value={values.url} onChange={(e) => update("url", e.target.value)} />
        <label className="field-label" htmlFor="ext-username">
          Username
        </label>
        <input id="ext-username" value={values.username} onChange={(e) => update("username", e.target.value)} />
        <label className="field-label" htmlFor="ext-password">
          Password
        </label>
        <div className="row">
          <input
            id="ext-password"
            value={values.password}
            onChange={(e) => update("password", e.target.value)}
          />
          <button type="button" className="secondary" onClick={handleGenerate}>
            Generate
          </button>
        </div>
        <label className="field-label" htmlFor="ext-notes">
          Notes
        </label>
        <textarea id="ext-notes" rows={2} value={values.notes} onChange={(e) => update("notes", e.target.value)} />
        {existing && existing.history.length > 0 && (
          <div>
            <button type="button" className="secondary" onClick={() => setShowHistory((s) => !s)}>
              {showHistory ? "Hide history" : `Show history (${existing.history.length})`}
            </button>
            {showHistory && (
              <div style={{ marginTop: "0.5rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                {existing.history.map((entry, i) => (
                  <div key={i} style={{ background: "var(--surface-2)", padding: "0.5rem", borderRadius: 8, fontSize: 12 }}>
                    <p style={{ margin: "0 0 0.3rem", opacity: 0.75 }}>Changed {new Date(entry.changed_at).toLocaleString()}</p>
                    <p style={{ margin: "0.15rem 0" }}>Title: {entry.title}</p>
                    <p style={{ margin: "0.15rem 0" }}>Website URL: {entry.url}</p>
                    <p style={{ margin: "0.15rem 0" }}>Username: {entry.username}</p>
                    <p style={{ margin: "0.15rem 0" }}>Password: {entry.password}</p>
                    <p style={{ margin: "0.15rem 0" }}>Folder: {folderName(folders, entry.folder_id)}</p>
                    <p style={{ margin: "0.15rem 0" }}>Notes: {entry.notes || "(none)"}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        <div className="row">
          <button type="submit">Save</button>
          <button type="button" className="secondary" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </form>
    </Modal>
  );
}
