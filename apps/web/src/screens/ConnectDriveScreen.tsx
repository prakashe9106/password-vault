import { useState } from "react";
import { requestAccessToken } from "../lib/googleAuth";

interface Props {
  onConnected: (accessToken: string) => void;
}

export default function ConnectDriveScreen({ onConnected }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConnect() {
    setBusy(true);
    setError(null);
    try {
      const token = await requestAccessToken(true);
      onConnected(token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="centered-screen">
      <div className="card">
        <h1>Connect Google Drive</h1>
        <p className="hint-text">
          Your vault is encrypted on this device and stored in your own Google Drive — we only
          ever see the encrypted file, never your passwords or master password.
        </p>
        {error && <p className="error-text">{error}</p>}
        <button onClick={handleConnect} disabled={busy}>
          {busy ? "Connecting…" : "Sign in with Google"}
        </button>
      </div>
    </div>
  );
}
