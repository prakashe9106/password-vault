import { useState } from "react";
import { parseContainer, unlockVault, unlockVaultWithRecovery } from "@vault/core";
import { loadContainer } from "../storage/indexedDbAdapter";
import { setUnlocked } from "../state/sessionStore";

interface Props {
  vaultId: string;
  vaultName: string;
  onUnlocked: () => void;
}

export default function UnlockVaultScreen({ vaultId, vaultName, onUnlocked }: Props) {
  const [mode, setMode] = useState<"password" | "recovery">("password");
  const [secret, setSecret] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);

    try {
      const raw = await loadContainer(vaultId);
      if (!raw) {
        setError("No vault found on this device.");
        return;
      }
      const container = parseContainer(raw);
      const unlockedVault =
        mode === "password" ? await unlockVault(container, secret) : await unlockVaultWithRecovery(container, secret);

      setUnlocked(vaultId, vaultName, unlockedVault);
      onUnlocked();
    } catch (err) {
      setError(mode === "password" ? "Incorrect master password." : "Invalid recovery code.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="centered-screen">
      <div className="card">
        <h1>Unlock {vaultName}</h1>
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="secret">{mode === "password" ? "Master password" : "Recovery code"}</label>
            <input
              id="secret"
              type={mode === "password" ? "password" : "text"}
              autoComplete="current-password"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              disabled={busy}
              autoFocus
            />
          </div>
          {error && (
            <p className="error-text" role="alert">
              {error}
            </p>
          )}
          <button type="submit" disabled={busy || !secret}>
            {busy ? "Unlocking…" : "Unlock"}
          </button>
        </form>
        <p className="hint-text" style={{ marginTop: "1rem" }}>
          <button
            type="button"
            className="secondary"
            onClick={() => {
              setMode(mode === "password" ? "recovery" : "password");
              setSecret("");
              setError(null);
            }}
          >
            {mode === "password" ? "Use recovery code instead" : "Use master password instead"}
          </button>
        </p>
      </div>
    </div>
  );
}
