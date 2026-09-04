import { useState } from "react";
import type { VaultSettings } from "@vault/core";

interface Props {
  settings: VaultSettings;
  onUpdateSettings: (patch: Partial<VaultSettings>) => void;
  onChangePassword: (newPassword: string) => Promise<void>;
  onClose: () => void;
}

const AUTO_LOCK_OPTIONS = [1, 5, 15, 30, 0];

export default function SettingsScreen({ settings, onUpdateSettings, onChangePassword, onClose }: Props) {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setStatus(null);
    if (newPassword.length < 8) return setStatus("New password must be at least 8 characters.");
    if (newPassword !== confirmPassword) return setStatus("Passwords don't match.");
    await onChangePassword(newPassword);
    setNewPassword("");
    setConfirmPassword("");
    setStatus("Master password updated.");
  }

  return (
    <div className="modal-backdrop">
      <div className="screen modal">
        <h2>Settings</h2>

        <label className="field-label">Auto-lock after inactivity</label>
        <select
          value={settings.auto_lock_minutes}
          onChange={(e) => onUpdateSettings({ auto_lock_minutes: Number(e.target.value) })}
        >
          {AUTO_LOCK_OPTIONS.map((minutes) => (
            <option key={minutes} value={minutes}>
              {minutes === 0 ? "Never" : `${minutes} minute${minutes === 1 ? "" : "s"}`}
            </option>
          ))}
        </select>

        <h3>Change master password</h3>
        <form onSubmit={handleChangePassword}>
          <input
            type="password"
            placeholder="New master password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
          <input
            type="password"
            placeholder="Confirm new password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
          {status && <p className="hint">{status}</p>}
          <button type="submit">Update password</button>
        </form>

        <div className="row">
          <button className="secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
