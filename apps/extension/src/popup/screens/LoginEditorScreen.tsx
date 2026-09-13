import { useState } from "react";
import type { CustomField, Folder, Login, LoginCategory } from "@vault/core";
import {
  CATEGORY_LABELS,
  LOGIN_CATEGORIES,
  defaultCustomFieldsForCategory,
  defaultGeneratorRules,
  generatePasswordAsync,
} from "@vault/core";
import Modal from "../components/Modal";

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
    category: existing?.category ?? "login",
    custom_fields: existing?.custom_fields ?? [],
  });
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
        <label className="field-label" htmlFor="ext-category">
          Category
        </label>
        <select
          id="ext-category"
          value={values.category}
          onChange={(e) => handleCategoryChange(e.target.value as LoginCategory)}
        >
          {LOGIN_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABELS[c]}
            </option>
          ))}
        </select>
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
        {values.custom_fields.map((field, i) => (
          <div key={field.label}>
            <label className="field-label" htmlFor={`ext-custom-${i}`}>
              {field.label}
            </label>
            <input id={`ext-custom-${i}`} value={field.value} onChange={(e) => updateCustomField(i, e.target.value)} />
          </div>
        ))}
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
                    <p style={{ margin: "0.15rem 0" }}>Category: {CATEGORY_LABELS[entry.category ?? "login"]}</p>
                    <p style={{ margin: "0.15rem 0" }}>Title: {entry.title}</p>
                    <p style={{ margin: "0.15rem 0" }}>Website URL: {entry.url}</p>
                    <p style={{ margin: "0.15rem 0" }}>Username: {entry.username}</p>
                    <p style={{ margin: "0.15rem 0" }}>Password: {entry.password}</p>
                    <p style={{ margin: "0.15rem 0" }}>Folder: {folderName(folders, entry.folder_id)}</p>
                    {(entry.custom_fields ?? []).map((f) => (
                      <p style={{ margin: "0.15rem 0" }} key={f.label}>
                        {f.label}: {f.value || "(empty)"}
                      </p>
                    ))}
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
