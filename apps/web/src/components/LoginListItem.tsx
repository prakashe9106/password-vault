import { useState } from "react";
import type { Login } from "@vault/core";

const CLIPBOARD_CLEAR_MS = 20_000;

interface Props {
  login: Login;
  onEdit: () => void;
  onDelete: () => void;
}

async function copyAndAutoClear(value: string, setStatus: (s: string | null) => void): Promise<void> {
  await navigator.clipboard.writeText(value);
  setStatus("Copied — clipboard clears in 20s");
  setTimeout(async () => {
    try {
      const current = await navigator.clipboard.readText();
      if (current === value) {
        await navigator.clipboard.writeText("");
      }
    } catch {
      // Clipboard read permission may be unavailable; nothing more we can safely do.
    }
    setStatus(null);
  }, CLIPBOARD_CLEAR_MS);
}

export default function LoginListItem({ login, onEdit, onDelete }: Props) {
  const [revealed, setRevealed] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  return (
    <li className="login-item">
      <div>
        <div className="login-item-title">{login.title}</div>
        <div className="login-item-meta">
          {login.username} · {login.url}
        </div>
        {revealed && <div className="login-item-meta">{login.password}</div>}
        {status && (
          <div className="hint-text" role="status" aria-live="polite">
            {status}
          </div>
        )}
      </div>
      <div className="row">
        <button className="secondary" onClick={() => setRevealed((r) => !r)}>
          {revealed ? "Hide" : "Show"}
        </button>
        <button className="secondary" onClick={() => copyAndAutoClear(login.password, setStatus)}>
          Copy password
        </button>
        <button className="secondary" onClick={onEdit}>
          Edit
        </button>
        <button className="danger" onClick={onDelete}>
          Delete
        </button>
      </div>
    </li>
  );
}
