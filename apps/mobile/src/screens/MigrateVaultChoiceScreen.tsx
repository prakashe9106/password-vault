import { useState } from "react";
import { View } from "react-native";
import AppButton from "../components/AppButton";
import CenteredCard from "../components/CenteredCard";
import { ErrorText, Heading, Hint } from "../components/Typography";

interface Props {
  vaultName: string;
  onUploadExisting: () => Promise<void>;
  onStartFresh: () => void;
}

export default function MigrateVaultChoiceScreen({ vaultName, onUploadExisting, onStartFresh }: Props) {
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
    <CenteredCard>
      <Heading>Existing vault found</Heading>
      <Hint>
        This device already has a local vault ("{vaultName}") that isn't in Google Drive yet.
        Upload it now, or start a brand new vault instead.
      </Hint>
      {error && <ErrorText>{error}</ErrorText>}
      <View style={{ gap: 10 }}>
        <AppButton title="Upload this vault to Drive" onPress={handleUpload} busy={busy} />
        <AppButton title="Start fresh instead" variant="secondary" onPress={onStartFresh} disabled={busy} />
      </View>
    </CenteredCard>
  );
}
