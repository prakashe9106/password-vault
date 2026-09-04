import { useState } from "react";
import type { VaultSettings } from "@vault/core";

interface Props {
  settings: VaultSettings;
  onUpdateSettings: (patch: Partial<VaultSettings>) => void;
  onChangePassword: (newPassword: string) => Promise<void>;
  onClose: () => void;
  driveEmail: string | null;
  lastSyncedAt: string | null;
  onDisconnectDrive: () => void;
}

const AUTO_LOCK_OPTIONS = [1, 5, 15, 30, 0];

export default function SettingsScreen({
  settings,
  onUpdateSettings,
  onChangePassword,
  onClose,
  driveEmail,
  lastSyncedAt,
  onDisconnectDrive,
}: Props) {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setStatus(null);
    if (newPassword.length < 8) {
      setStatus("New password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setStatus("Passwords don't match.");
      return;
    }
    await onChangePassword(newPassword);
    setNewPassword("");
    setConfirmPassword("");
    setStatus("Master password updated.");
  }

  return (
    <div className="modal-backdrop">
      <div className="card" style={{ maxWidth: 480 }}>
        <h1>Settings</h1>

        <div className="field">
          <label htmlFor="auto-lock">Auto-lock after inactivity</label>
          <select
            id="auto-lock"
            value={settings.auto_lock_minutes}
            onChange={(e) => onUpdateSettings({ auto_lock_minutes: Number(e.target.value) })}
          >
            {AUTO_LOCK_OPTIONS.map((minutes) => (
              <option key={minutes} value={minutes}>
                {minutes === 0 ? "Never" : `${minutes} minute${minutes === 1 ? "" : "s"}`}
              </option>
            ))}
          </select>
        </div>

        <h1 style={{ fontSize: "1rem", marginTop: "1.5rem" }}>Change master password</h1>
        <form onSubmit={handleChangePassword}>
          <div className="field">
            <label htmlFor="new-password">New master password</label>
            <input
              id="new-password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="confirm-password">Confirm new password</label>
            <input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>
          {status && <p className="hint-text">{status}</p>}
          <button type="submit">Update password</button>
        </form>

        <h1 style={{ fontSize: "1rem", marginTop: "1.5rem" }}>Storage</h1>
        <p className="hint-text">
          {driveEmail ? `Connected as ${driveEmail}` : "Not connected"}
          {lastSyncedAt && <> · last synced {new Date(lastSyncedAt).toLocaleString()}</>}
        </p>
        <button className="secondary" onClick={onDisconnectDrive}>
          Disconnect Google Drive
        </button>

        <div className="row" style={{ marginTop: "1.5rem" }}>
          <button className="secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
