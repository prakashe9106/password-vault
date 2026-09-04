import { useState } from "react";

interface Props {
  onKeepMine: () => Promise<void>;
  onUseTheirs: () => Promise<void>;
}

/**
 * Simple two-choice conflict UI — no field-level merge (explicit non-goal in
 * docs/spec/vault-protocol-v1.md). Shown when this device's last-known Drive revision doesn't
 * match what's actually there, meaning another device changed the vault since.
 */
export default function ConflictResolutionScreen({ onKeepMine, onUseTheirs }: Props) {
  const [busy, setBusy] = useState<"mine" | "theirs" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handle(choice: "mine" | "theirs", action: () => Promise<void>) {
    setBusy(choice);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to resolve conflict.");
      setBusy(null);
    }
  }

  return (
    <div className="modal-backdrop">
      <div className="card">
        <h1>This vault changed on another device</h1>
        <p className="hint-text">
          Your vault was updated somewhere else since this device last synced. Choose which
          version to keep — this can't automatically merge changes from both.
        </p>
        {error && <p className="error-text">{error}</p>}
        <div className="row">
          <button disabled={busy !== null} onClick={() => handle("mine", onKeepMine)}>
            {busy === "mine" ? "Keeping mine…" : "Keep my changes"}
          </button>
          <button className="secondary" disabled={busy !== null} onClick={() => handle("theirs", onUseTheirs)}>
            {busy === "theirs" ? "Loading…" : "Use the other device's version"}
          </button>
        </div>
      </div>
    </div>
  );
}
