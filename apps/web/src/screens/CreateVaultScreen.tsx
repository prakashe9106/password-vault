import { useState } from "react";
import { createVault, serializeContainer, unlockVault } from "@vault/core";
import { saveContainer } from "../storage/indexedDbAdapter";
import { setUnlocked } from "../state/sessionStore";
import { createInitialRemoteFile } from "../state/syncStore";
import type { StorageProvider } from "../lib/storageProvider";
import { DEFAULT_VAULT_NAME } from "../constants";
import PasswordStrengthMeter from "../components/PasswordStrengthMeter";

interface Props {
  accessToken: string;
  provider: StorageProvider;
  onCreated: (vaultId: string, vaultName: string, recoveryCode: string) => void;
}

export default function CreateVaultScreen({ accessToken, provider, onCreated }: Props) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Master password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }

    setBusy(true);
    try {
      const { container, recoveryCode } = await createVault(password);
      const unlockedVault = await unlockVault(container, password);
      const raw = serializeContainer(container);

      await saveContainer(container.vault_id, raw, DEFAULT_VAULT_NAME);
      await createInitialRemoteFile(provider, accessToken, container.vault_id, raw);
      setUnlocked(container.vault_id, DEFAULT_VAULT_NAME, unlockedVault);

      onCreated(container.vault_id, DEFAULT_VAULT_NAME, recoveryCode);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create vault.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="centered-screen">
      <div className="card">
        <h1>Create your vault</h1>
        <p className="hint-text">
          Your master password never leaves this device. Choose something strong you'll remember —
          it can't be recovered by anyone but you.
        </p>
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="password">Master password</label>
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={busy}
            />
            <PasswordStrengthMeter password={password} />
          </div>
          <div className="field">
            <label htmlFor="confirm">Confirm master password</label>
            <input
              id="confirm"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              disabled={busy}
            />
          </div>
          {error && (
            <p className="error-text" role="alert">
              {error}
            </p>
          )}
          <button type="submit" disabled={busy}>
            {busy ? "Creating vault…" : "Create vault"}
          </button>
        </form>
      </div>
    </div>
  );
}
