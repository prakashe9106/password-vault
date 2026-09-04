import { useState } from "react";
import type { Login } from "@vault/core";
import { defaultGeneratorRules, generatePasswordAsync } from "@vault/core";

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
    <div className="modal-backdrop">
      <div className="screen modal">
        <h2>{existing ? "Edit login" : "Add login"}</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSave(values);
          }}
        >
          <input placeholder="Title" value={values.title} onChange={(e) => update("title", e.target.value)} required />
          <input placeholder="Website URL" value={values.url} onChange={(e) => update("url", e.target.value)} />
          <input placeholder="Username" value={values.username} onChange={(e) => update("username", e.target.value)} />
          <div className="row">
            <input placeholder="Password" value={values.password} onChange={(e) => update("password", e.target.value)} />
            <button type="button" className="secondary" onClick={handleGenerate}>
              Generate
            </button>
          </div>
          <textarea placeholder="Notes" rows={2} value={values.notes} onChange={(e) => update("notes", e.target.value)} />
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
