import { useState } from "react";
import type { Login } from "@vault/core";
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
  onSave: (values: LoginFormValues) => void;
  onCancel: () => void;
}

export default function LoginEditorScreen({ existing, onSave, onCancel }: Props) {
  const [values, setValues] = useState<LoginFormValues>({
    title: existing?.title ?? "",
    url: existing?.url ?? "",
    username: existing?.username ?? "",
    password: existing?.password ?? "",
    notes: existing?.notes ?? "",
    folder_id: existing?.folder_id ?? null,
  });

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
