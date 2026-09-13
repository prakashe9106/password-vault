import { useState } from "react";
import { beginSignIn as beginGoogleSignIn, isGoogleDriveConfigured } from "../lib/googleAuth";
import { isOneDriveConfigured, requestAccessToken as requestOneDriveAccessToken } from "../lib/oneDriveAuth";
import type { StorageProvider } from "../lib/storageProvider";

interface Props {
  onConnected: (accessToken: string, provider: StorageProvider) => void;
}

export default function ConnectStorageScreen({ onConnected }: Props) {
  const [busy, setBusy] = useState<StorageProvider | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleConnect(provider: StorageProvider) {
    setBusy(provider);
    setError(null);
    try {
      if (provider === "google-drive") {
        // Navigates away — the result comes back via App.tsx's redirect-callback handling on
        // the next page load, not from this call.
        beginGoogleSignIn();
        return;
      }
      const token = await requestOneDriveAccessToken(true);
      onConnected(token, provider);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="centered-screen">
      <div className="card">
        <h1>Connect your cloud storage</h1>
        <p className="hint-text">
          Your vault is encrypted on this device and stored in your own cloud storage — we only
          ever see the encrypted file, never your passwords or master password.
        </p>
        {error && (
          <p className="error-text" role="alert">
            {error}
          </p>
        )}
        <div className="row">
          {isGoogleDriveConfigured() && (
            <button onClick={() => handleConnect("google-drive")} disabled={busy !== null}>
              {busy === "google-drive" ? "Connecting…" : "Sign in with Google"}
            </button>
          )}
          {isOneDriveConfigured() && (
            <button onClick={() => handleConnect("onedrive")} disabled={busy !== null}>
              {busy === "onedrive" ? "Connecting…" : "Sign in with Microsoft"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
