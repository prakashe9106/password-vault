import { useState } from "react";
import type { VaultSettings } from "@vault/core";
import Modal from "../components/Modal";
import PasswordStrengthMeter from "../components/PasswordStrengthMeter";

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
    <Modal titleId="ext-settings-title" onClose={onClose}>
      <h2 id="ext-settings-title">Settings</h2>

      <label className="field-label" htmlFor="ext-auto-lock">
        Auto-lock after inactivity
      </label>
      <select
        id="ext-auto-lock"
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
        <label className="field-label" htmlFor="ext-new-password">
          New master password
        </label>
        <input
          id="ext-new-password"
          type="password"
          autoComplete="new-password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
        />
        <PasswordStrengthMeter password={newPassword} />
        <label className="field-label" htmlFor="ext-confirm-password">
          Confirm new password
        </label>
        <input
          id="ext-confirm-password"
          type="password"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
        />
        {status && (
          <p className="hint" role="status" aria-live="polite">
            {status}
          </p>
        )}
        <button type="submit">Update password</button>
      </form>

      <div className="row">
        <button className="secondary" onClick={onClose}>
          Close
        </button>
      </div>
    </Modal>
  );
}
