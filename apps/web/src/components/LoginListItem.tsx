import { useState } from "react";
import type { Login } from "@vault/core";
import { CATEGORY_LABELS } from "@vault/core";
import { copyAndAutoClear } from "../lib/clipboard";

interface Props {
  login: Login;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export default function LoginListItem({ login, onView, onEdit, onDelete }: Props) {
  const [revealed, setRevealed] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  return (
    <li className="login-item">
      <div>
        <div className="login-item-title">
          {login.title}
          {login.category && login.category !== "login" && (
            <span className="hint-text" style={{ marginLeft: "0.5rem", fontSize: "0.75rem" }}>
              {CATEGORY_LABELS[login.category]}
            </span>
          )}
        </div>
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
        <button className="secondary" onClick={onView}>
          View
        </button>
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
