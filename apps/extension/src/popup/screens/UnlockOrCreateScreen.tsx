import { useState } from "react";
import { sendToBackground } from "../../lib/messaging";

interface Props {
  vaultExists: boolean;
  onReady: () => void;
}

interface OkOrError {
  ok: boolean;
  error?: string;
  recoveryCode?: string;
}

export default function UnlockOrCreateScreen({ vaultExists, onReady }: Props) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [mode, setMode] = useState<"password" | "recovery">("password");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recoveryCode, setRecoveryCode] = useState<string | null>(null);
  const [ackRecovery, setAckRecovery] = useState(false);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) return setError("Master password must be at least 8 characters.");
    if (password !== confirm) return setError("Passwords don't match.");

    setBusy(true);
    const result = await sendToBackground<OkOrError>({
      type: "CREATE_VAULT",
      masterPassword: password,
      vaultName: "My Vault",
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.error ?? "Failed to create vault.");
      return;
    }
    setRecoveryCode(result.recoveryCode ?? null);
  }

  async function handleUnlock(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const result =
      mode === "password"
        ? await sendToBackground<OkOrError>({ type: "UNLOCK", masterPassword: password })
        : await sendToBackground<OkOrError>({ type: "UNLOCK_WITH_RECOVERY", recoveryCode: password });
    setBusy(false);
    if (!result.ok) {
      setError(result.error ?? "Unlock failed.");
      return;
    }
    onReady();
  }

  if (recoveryCode) {
    return (
      <div className="screen">
        <h2>Save your recovery key</h2>
        <p className="hint">This is the only other way to unlock this vault — it can't be recovered otherwise.</p>
        <div className="recovery-code">{recoveryCode}</div>
        <label className="checkbox-row">
          <input type="checkbox" checked={ackRecovery} onChange={(e) => setAckRecovery(e.target.checked)} />
          I've saved it somewhere safe
        </label>
        <button disabled={!ackRecovery} onClick={onReady}>
          Continue
        </button>
      </div>
    );
  }

  if (!vaultExists) {
    return (
      <form className="screen" onSubmit={handleCreate}>
        <h2>Create your vault</h2>
        <p className="hint">Local to this browser for now — Google Drive sync is coming in a follow-up.</p>
        <input
          type="password"
          placeholder="Master password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={busy}
        />
        <input
          type="password"
          placeholder="Confirm master password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          disabled={busy}
        />
        {error && <p className="error">{error}</p>}
        <button type="submit" disabled={busy}>
          {busy ? "Creating…" : "Create vault"}
        </button>
      </form>
    );
  }

  return (
    <form className="screen" onSubmit={handleUnlock}>
      <h2>Unlock vault</h2>
      <input
        type={mode === "password" ? "password" : "text"}
        placeholder={mode === "password" ? "Master password" : "Recovery code"}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        disabled={busy}
        autoFocus
      />
      {error && <p className="error">{error}</p>}
      <button type="submit" disabled={busy || !password}>
        {busy ? "Unlocking…" : "Unlock"}
      </button>
      <button
        type="button"
        className="secondary"
        onClick={() => {
          setMode(mode === "password" ? "recovery" : "password");
          setPassword("");
          setError(null);
        }}
      >
        {mode === "password" ? "Use recovery code" : "Use master password"}
      </button>
    </form>
  );
}
