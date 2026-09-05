import { useState } from "react";

interface Props {
  vaultName: string;
  providerLabel: string;
  onUploadExisting: () => Promise<void>;
  onStartFresh: () => void;
}

/**
 * Shown when the connected storage provider has no vault file yet but this browser already has a
 * local vault from before it was connected — avoids silently orphaning it.
 */
export default function MigrateVaultChoiceScreen({ vaultName, providerLabel, onUploadExisting, onStartFresh }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleUpload() {
    setBusy(true);
    setError(null);
    try {
      await onUploadExisting();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
      setBusy(false);
    }
  }

  return (
    <div className="centered-screen">
      <div className="card">
        <h1>Existing vault found</h1>
        <p className="hint-text">
          This device already has a local vault ("{vaultName}") that isn't in {providerLabel} yet.
          Upload it now, or start a brand new vault instead.
        </p>
        {error && (
          <p className="error-text" role="alert">
            {error}
          </p>
        )}
        <div className="row">
          <button onClick={handleUpload} disabled={busy}>
            {busy ? "Uploading…" : `Upload this vault to ${providerLabel}`}
          </button>
          <button className="secondary" onClick={onStartFresh} disabled={busy}>
            Start fresh instead
          </button>
        </div>
      </div>
    </div>
  );
}
