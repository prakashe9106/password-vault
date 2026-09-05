import { useEffect, useState } from "react";
import { View } from "react-native";
import AppButton from "../components/AppButton";
import CenteredCard from "../components/CenteredCard";
import FormField from "../components/FormField";
import { ErrorText, Heading } from "../components/Typography";
import { unlockWithBiometric, unlockWithPassword, unlockWithRecoveryCode } from "../state/sessionStore";
import { isBiometricEnabled } from "../storage/vaultStorage";

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
  const [biometricAvailable, setBiometricAvailable] = useState(false);

  useEffect(() => {
    let cancelled = false;
    isBiometricEnabled().then((enabled) => {
      if (cancelled) return;
      setBiometricAvailable(enabled);
      if (enabled) void handleBiometric();
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleBiometric() {
    setError(null);
    const ok = await unlockWithBiometric(vaultId, vaultName);
    if (ok) onUnlocked();
  }

  async function handleSubmit() {
    setError(null);
    setBusy(true);
    try {
      if (mode === "password") {
        await unlockWithPassword(vaultId, vaultName, secret);
      } else {
        await unlockWithRecoveryCode(vaultId, vaultName, secret);
      }
      onUnlocked();
    } catch {
      setError(mode === "password" ? "Incorrect master password." : "Invalid recovery code.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <CenteredCard>
      <Heading>Unlock {vaultName}</Heading>
      <FormField
        label={mode === "password" ? "Master password" : "Recovery code"}
        secureTextEntry={mode === "password"}
        autoComplete={mode === "password" ? "current-password" : "off"}
        autoCapitalize="none"
        value={secret}
        onChangeText={setSecret}
        editable={!busy}
        autoFocus
      />
      {error && <ErrorText>{error}</ErrorText>}
      <View style={{ gap: 10 }}>
        <AppButton title="Unlock" onPress={handleSubmit} busy={busy} disabled={!secret} />
        {biometricAvailable && (
          <AppButton title="Unlock with biometrics" variant="secondary" onPress={handleBiometric} disabled={busy} />
        )}
        <AppButton
          title={mode === "password" ? "Use recovery code instead" : "Use master password instead"}
          variant="secondary"
          onPress={() => {
            setMode(mode === "password" ? "recovery" : "password");
            setSecret("");
            setError(null);
          }}
          disabled={busy}
        />
      </View>
    </CenteredCard>
  );
}
