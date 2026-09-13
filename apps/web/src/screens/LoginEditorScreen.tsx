import { useState } from "react";
import type { CustomField, Folder, Login, LoginCategory } from "@vault/core";
import { CATEGORY_LABELS, LOGIN_CATEGORIES, defaultCustomFieldsForCategory } from "@vault/core";
import PasswordGeneratorPanel from "../components/PasswordGeneratorPanel";
import SidePanel from "../components/SidePanel";

export interface LoginFormValues {
  title: string;
  url: string;
  username: string;
  password: string;
  notes: string;
  folder_id: string | null;
  category: LoginCategory;
  custom_fields: CustomField[];
}

interface Props {
  existing?: Login;
  folders: readonly Folder[];
  defaultFolderId?: string | null;
  onSave: (values: LoginFormValues) => void;
  onCancel: () => void;
}

function folderName(folders: readonly Folder[], folderId: string | null): string {
  if (folderId === null) return "No folder";
  return folders.find((f) => f.id === folderId)?.name ?? "Folder no longer exists";
}

export default function LoginEditorScreen({ existing, folders, defaultFolderId, onSave, onCancel }: Props) {
  const [values, setValues] = useState<LoginFormValues>({
    title: existing?.title ?? "",
    url: existing?.url ?? "",
    username: existing?.username ?? "",
    password: existing?.password ?? "",
    notes: existing?.notes ?? "",
    folder_id: existing?.folder_id ?? defaultFolderId ?? null,
    category: existing?.category ?? "login",
    custom_fields: existing?.custom_fields ?? [],
  });
  const [showGenerator, setShowGenerator] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  function update<K extends keyof LoginFormValues>(key: K, value: LoginFormValues[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  function updateCustomField(index: number, value: string) {
    setValues((v) => ({
      ...v,
      custom_fields: v.custom_fields.map((f, i) => (i === index ? { ...f, value } : f)),
    }));
  }

  function handleCategoryChange(category: LoginCategory) {
    setValues((v) => ({ ...v, category, custom_fields: defaultCustomFieldsForCategory(category) }));
  }

  const customFieldRows: CustomField[][] = [];
  for (let i = 0; i < values.custom_fields.length; i += 2) {
    customFieldRows.push(values.custom_fields.slice(i, i + 2));
  }

  return (
    <SidePanel
      titleId="login-editor-title"
      onClose={onCancel}
      header={<h1 id="login-editor-title">{existing ? "Edit login" : "Add login"}</h1>}
      footer={
        <>
          <button type="submit" form="login-editor-form">
            Save
          </button>
          <button type="button" className="secondary" onClick={onCancel}>
            Cancel
          </button>
        </>
      }
    >
      <form
        id="login-editor-form"
        onSubmit={(e) => {
          e.preventDefault();
          onSave(values);
        }}
      >
        <div className="field-row">
          <div className="field">
            <label htmlFor="category">Category</label>
            <select
              id="category"
              value={values.category}
              onChange={(e) => handleCategoryChange(e.target.value as LoginCategory)}
            >
              {LOGIN_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABELS[c]}
                </option>
              ))}
            </select>
          </div>
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
        </div>
        <div className="field">
          <label htmlFor="title">Title</label>
          <input id="title" value={values.title} onChange={(e) => update("title", e.target.value)} required />
        </div>
        <div className="field">
          <label htmlFor="url">Website URL</label>
          <input id="url" value={values.url} onChange={(e) => update("url", e.target.value)} />
        </div>
        <div className="field-row">
          <div className="field">
            <label htmlFor="username">Username</label>
            <input id="username" value={values.username} onChange={(e) => update("username", e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="text"
              value={values.password}
              onChange={(e) => update("password", e.target.value)}
            />
          </div>
        </div>
        <div className="field">
          <button type="button" className="secondary" onClick={() => setShowGenerator((s) => !s)}>
            {showGenerator ? "Hide generator" : "Generate password"}
          </button>
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
        {customFieldRows.map((row) => (
          <div className="field-row" key={row[0]!.label}>
            {row.map((field) => {
              const i = values.custom_fields.indexOf(field);
              return (
                <div className="field" key={field.label}>
                  <label htmlFor={`custom-${i}`}>{field.label}</label>
                  <input
                    id={`custom-${i}`}
                    value={field.value}
                    onChange={(e) => updateCustomField(i, e.target.value)}
                  />
                </div>
              );
            })}
          </div>
        ))}
        <div className="field">
          <label htmlFor="notes">Notes</label>
          <textarea id="notes" rows={3} value={values.notes} onChange={(e) => update("notes", e.target.value)} />
        </div>
        {existing && existing.history.length > 0 && (
          <div className="field">
            <button type="button" className="secondary" onClick={() => setShowHistory((s) => !s)}>
              {showHistory ? "Hide history" : `Show history (${existing.history.length})`}
            </button>
            {showHistory && (
              <div style={{ marginTop: "0.75rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                {existing.history.map((entry, i) => (
                  <div
                    key={i}
                    style={{ background: "var(--surface-2)", padding: "0.75rem", borderRadius: 8, fontSize: 13 }}
                  >
                    <p className="hint-text" style={{ margin: "0 0 0.5rem" }}>
                      Changed {new Date(entry.changed_at).toLocaleString()}
                    </p>
                    <p style={{ margin: "0.2rem 0" }}>Category: {CATEGORY_LABELS[entry.category ?? "login"]}</p>
                    <p style={{ margin: "0.2rem 0" }}>Title: {entry.title}</p>
                    <p style={{ margin: "0.2rem 0" }}>Website URL: {entry.url}</p>
                    <p style={{ margin: "0.2rem 0" }}>Username: {entry.username}</p>
                    <p style={{ margin: "0.2rem 0" }}>Password: {entry.password}</p>
                    <p style={{ margin: "0.2rem 0" }}>Folder: {folderName(folders, entry.folder_id)}</p>
                    {(entry.custom_fields ?? []).map((f) => (
                      <p style={{ margin: "0.2rem 0" }} key={f.label}>
                        {f.label}: {f.value || "(empty)"}
                      </p>
                    ))}
                    <p style={{ margin: "0.2rem 0" }}>Notes: {entry.notes || "(none)"}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </form>
    </SidePanel>
  );
}
