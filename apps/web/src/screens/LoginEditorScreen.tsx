import { useState } from "react";
import type { Folder, Login } from "@vault/core";
import PasswordGeneratorPanel from "../components/PasswordGeneratorPanel";

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
  defaultFolderId?: string | null;
  onSave: (values: LoginFormValues) => void;
  onCancel: () => void;
}

export default function LoginEditorScreen({ existing, folders, defaultFolderId, onSave, onCancel }: Props) {
  const [values, setValues] = useState<LoginFormValues>({
    title: existing?.title ?? "",
    url: existing?.url ?? "",
    username: existing?.username ?? "",
    password: existing?.password ?? "",
    notes: existing?.notes ?? "",
    folder_id: existing?.folder_id ?? defaultFolderId ?? null,
  });
  const [showGenerator, setShowGenerator] = useState(false);

  function update<K extends keyof LoginFormValues>(key: K, value: LoginFormValues[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  return (
    <div className="modal-backdrop">
      <div className="card" style={{ maxWidth: 480 }}>
        <h1>{existing ? "Edit login" : "Add login"}</h1>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSave(values);
          }}
        >
          <div className="field">
            <label htmlFor="title">Title</label>
            <input id="title" value={values.title} onChange={(e) => update("title", e.target.value)} required />
          </div>
          <div className="field">
            <label htmlFor="url">Website URL</label>
            <input id="url" value={values.url} onChange={(e) => update("url", e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="username">Username</label>
            <input id="username" value={values.username} onChange={(e) => update("username", e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <div className="row">
              <input
                id="password"
                type="text"
                value={values.password}
                onChange={(e) => update("password", e.target.value)}
              />
              <button type="button" className="secondary" onClick={() => setShowGenerator((s) => !s)}>
                {showGenerator ? "Hide generator" : "Generate"}
              </button>
            </div>
          </div>
          {showGenerator && (
            <div className="field" style={{ background: "var(--surface-2)", padding: "0.75rem", borderRadius: 8 }}>
              <PasswordGeneratorPanel
                onUse={(pw) => {
                  update("password", pw);
                  setShowGenerator(false);
                }}
              />
            </div>
          )}
          <div className="field">
            <label htmlFor="folder">Folder</label>
            <select
              id="folder"
              value={values.folder_id ?? ""}
              onChange={(e) => update("folder_id", e.target.value || null)}
            >
              <option value="">No folder</option>
              {folders.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="notes">Notes</label>
            <textarea id="notes" rows={3} value={values.notes} onChange={(e) => update("notes", e.target.value)} />
          </div>
          <div className="row">
            <button type="submit">Save</button>
            <button type="button" className="secondary" onClick={onCancel}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
