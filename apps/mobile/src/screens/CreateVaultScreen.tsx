import { useState } from "react";
import AppButton from "../components/AppButton";
import CenteredCard from "../components/CenteredCard";
import FormField from "../components/FormField";
import PasswordStrengthMeter from "../components/PasswordStrengthMeter";
import { ErrorText, Heading, Hint } from "../components/Typography";
import { createAndUnlock } from "../state/sessionStore";
import { createInitialDriveFile } from "../state/syncStore";
import { loadContainer } from "../storage/vaultStorage";
import { DEFAULT_VAULT_NAME } from "../constants";

interface Props {
  accessToken: string;
  onCreated: (vaultId: string, vaultName: string, recoveryCode: string) => void;
}

export default function CreateVaultScreen({ accessToken, onCreated }: Props) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
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
      const { vaultId, recoveryCode } = await createAndUnlock(password, DEFAULT_VAULT_NAME);
      const raw = await loadContainer(vaultId);
      if (raw) await createInitialDriveFile(accessToken, vaultId, raw);
      onCreated(vaultId, DEFAULT_VAULT_NAME, recoveryCode);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create vault.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <CenteredCard>
      <Heading>Create your vault</Heading>
      <Hint>
        Your master password never leaves this device. Choose something strong you'll remember —
        it can't be recovered by anyone but you.
      </Hint>
      <FormField
        label="Master password"
        secureTextEntry
        autoComplete="new-password"
        value={password}
        onChangeText={setPassword}
        editable={!busy}
      />
      <PasswordStrengthMeter password={password} />
      <FormField
        label="Confirm master password"
        secureTextEntry
        autoComplete="new-password"
        value={confirm}
        onChangeText={setConfirm}
        editable={!busy}
      />
      {error && <ErrorText>{error}</ErrorText>}
      <AppButton title="Create vault" onPress={handleSubmit} busy={busy} />
    </CenteredCard>
  );
}
