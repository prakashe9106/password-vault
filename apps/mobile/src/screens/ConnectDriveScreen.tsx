import { useState } from "react";
import AppButton from "../components/AppButton";
import CenteredCard from "../components/CenteredCard";
import { ErrorText, Heading, Hint } from "../components/Typography";
import { useGoogleAuthRequest, type GoogleAuthResult } from "../lib/googleAuth";

interface Props {
  onConnected: (result: GoogleAuthResult) => void;
}

export default function ConnectDriveScreen({ onConnected }: Props) {
  const { ready, connect } = useGoogleAuthRequest();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConnect() {
    setBusy(true);
    setError(null);
    try {
      const result = await connect();
      onConnected(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <CenteredCard>
      <Heading>Connect Google Drive</Heading>
      <Hint>
        Your vault is encrypted on this device and stored in your own Google Drive — we only ever
        see the encrypted file, never your passwords or master password.
      </Hint>
      {error && <ErrorText>{error}</ErrorText>}
      <AppButton title="Sign in with Google" onPress={handleConnect} disabled={!ready} busy={busy} />
    </CenteredCard>
  );
}
