import { useState } from "react";
import type { Folder, Login } from "@vault/core";
import { CATEGORY_LABELS } from "@vault/core";
import { copyAndAutoClear } from "../lib/clipboard";
import Modal from "../components/Modal";

interface Props {
  login: Login;
  folders: readonly Folder[];
  onEdit: () => void;
  onClose: () => void;
}

function folderName(folders: readonly Folder[], folderId: string | null): string {
  if (folderId === null) return "No folder";
  return folders.find((f) => f.id === folderId)?.name ?? "Folder no longer exists";
}

function withScheme(url: string): string {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

function CopyableField({ label, value }: { label: string; value: string }) {
  const [status, setStatus] = useState<string | null>(null);
  return (
    <div>
      <label className="field-label">{label}</label>
      <div className="row">
        <input value={value} readOnly />
        <button type="button" className="secondary" onClick={() => copyAndAutoClear(value, setStatus)}>
          Copy
        </button>
      </div>
      {status && (
        <p className="hint" role="status" aria-live="polite">
          {status}
        </p>
      )}
    </div>
  );
}

export default function LoginDetailScreen({ login, folders, onEdit, onClose }: Props) {
  const [revealed, setRevealed] = useState(false);
  const [passwordStatus, setPasswordStatus] = useState<string | null>(null);

  return (
    <Modal titleId="login-detail-title" onClose={onClose}>
      <h2 id="login-detail-title">
        {login.title}
        {login.category && login.category !== "login" && (
          <span className="hint" style={{ marginLeft: "0.4rem", fontSize: "0.7rem" }}>
            {CATEGORY_LABELS[login.category]}
          </span>
        )}
      </h2>
      {login.url && (
        <div>
          <label className="field-label">Website URL</label>
          <p style={{ margin: "0 0 0.5rem" }}>
            <a href={withScheme(login.url)} target="_blank" rel="noopener noreferrer">
              {login.url}
            </a>
          </p>
        </div>
      )}
      <CopyableField label="Username" value={login.username} />
      <div>
        <label className="field-label">Password</label>
        <div className="row">
          <input value={login.password} readOnly type={revealed ? "text" : "password"} />
          <button type="button" className="secondary" onClick={() => setRevealed((r) => !r)}>
            {revealed ? "Hide" : "Show"}
          </button>
          <button type="button" className="secondary" onClick={() => copyAndAutoClear(login.password, setPasswordStatus)}>
            Copy
          </button>
        </div>
        {passwordStatus && (
          <p className="hint" role="status" aria-live="polite">
            {passwordStatus}
          </p>
        )}
      </div>
      {login.custom_fields.map((field) => (
        <CopyableField key={field.label} label={field.label} value={field.value} />
      ))}
      <div>
        <label className="field-label">Folder</label>
        <p style={{ margin: "0 0 0.5rem" }}>{folderName(folders, login.folder_id)}</p>
      </div>
      {login.notes && (
        <div>
          <label className="field-label">Notes</label>
          <p style={{ margin: "0 0 0.5rem", whiteSpace: "pre-wrap" }}>{login.notes}</p>
        </div>
      )}
      <div className="row">
        <button type="button" onClick={onEdit}>
          Edit
        </button>
        <button type="button" className="secondary" onClick={onClose}>
          Close
        </button>
      </div>
    </Modal>
  );
}
