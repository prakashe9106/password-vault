import { useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { VaultSettings } from "@vault/core";
import AppButton from "../components/AppButton";
import FormField from "../components/FormField";
import PasswordStrengthMeter from "../components/PasswordStrengthMeter";
import { Heading } from "../components/Typography";
import { colors } from "../theme";
import { disableBiometricUnlock, enableBiometricUnlock } from "../state/sessionStore";
import { isBiometricAvailable } from "../storage/secureVmk";
import { isBiometricEnabled } from "../storage/vaultStorage";

interface Props {
  settings: VaultSettings;
  onUpdateSettings: (patch: Partial<VaultSettings>) => void;
  onChangePassword: (newPassword: string) => Promise<void>;
  onClose: () => void;
  driveEmail: string | null;
  lastSyncedAt: string | null;
  onDisconnectDrive: () => void;
}

const AUTO_LOCK_OPTIONS = [1, 5, 15, 30, 0];

export default function SettingsScreen({
  settings,
  onUpdateSettings,
  onChangePassword,
  onClose,
  driveEmail,
  lastSyncedAt,
  onDisconnectDrive,
}: Props) {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [biometricOn, setBiometricOn] = useState(false);
  const [biometricHardwareOk, setBiometricHardwareOk] = useState(false);

  useEffect(() => {
    isBiometricEnabled().then(setBiometricOn);
    isBiometricAvailable().then(setBiometricHardwareOk);
  }, []);

  async function handleChangePassword() {
    setStatus(null);
    if (newPassword.length < 8) {
      setStatus("New password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setStatus("Passwords don't match.");
      return;
    }
    await onChangePassword(newPassword);
    setNewPassword("");
    setConfirmPassword("");
    setStatus("Master password updated.");
  }

  async function toggleBiometric() {
    if (biometricOn) {
      await disableBiometricUnlock();
      setBiometricOn(false);
    } else {
      await enableBiometricUnlock();
      setBiometricOn(true);
    }
  }

  return (
    <Modal animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <Heading>Settings</Heading>

        <Text style={styles.label}>Auto-lock after inactivity</Text>
        <View style={styles.chipRow}>
          {AUTO_LOCK_OPTIONS.map((minutes) => (
            <Pressable
              key={minutes}
              style={[styles.chip, settings.auto_lock_minutes === minutes && styles.chipActive]}
              onPress={() => onUpdateSettings({ auto_lock_minutes: minutes })}
            >
              <Text style={styles.chipText}>{minutes === 0 ? "Never" : `${minutes} min`}</Text>
            </Pressable>
          ))}
        </View>

        <Heading>Biometric unlock</Heading>
        {biometricHardwareOk ? (
          <>
            <Text style={styles.hint}>
              Use your fingerprint or face instead of your master password on future app opens.
              {!biometricOn && " Takes effect starting from your next master-password unlock."}
            </Text>
            <AppButton
              title={biometricOn ? "Turn off biometric unlock" : "Turn on biometric unlock"}
              variant={biometricOn ? "danger" : "primary"}
              onPress={toggleBiometric}
            />
          </>
        ) : (
          <Text style={styles.hint}>No biometric hardware enrolled on this device.</Text>
        )}

        <Heading>Change master password</Heading>
        <FormField
          label="New master password"
          secureTextEntry
          value={newPassword}
          onChangeText={setNewPassword}
        />
        <PasswordStrengthMeter password={newPassword} />
        <FormField
          label="Confirm new password"
          secureTextEntry
          value={confirmPassword}
          onChangeText={setConfirmPassword}
        />
        {status && (
          <Text accessibilityLiveRegion="polite" style={styles.hint}>
            {status}
          </Text>
        )}
        <AppButton title="Update password" onPress={handleChangePassword} />

        <Heading>Storage</Heading>
        <Text style={styles.hint}>
          {driveEmail ? `Connected as ${driveEmail}` : "Not connected"}
          {lastSyncedAt && ` · last synced ${new Date(lastSyncedAt).toLocaleString()}`}
        </Text>
        <AppButton title="Disconnect Google Drive" variant="secondary" onPress={onDisconnectDrive} />

        <View style={{ height: 16 }} />
        <AppButton title="Close" variant="secondary" onPress={onClose} />
      </ScrollView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 20 },
  label: { color: colors.muted, fontSize: 13, marginBottom: 8 },
  hint: { color: colors.muted, fontSize: 13, marginBottom: 12 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 },
  chip: {
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  chipActive: { borderColor: colors.accent, backgroundColor: colors.accent },
  chipText: { color: colors.text, fontSize: 13 },
});
