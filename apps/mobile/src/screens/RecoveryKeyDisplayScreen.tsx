import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import AppButton from "../components/AppButton";
import CenteredCard from "../components/CenteredCard";
import { Heading, Hint } from "../components/Typography";
import { colors } from "../theme";

interface Props {
  recoveryCode: string;
  onAcknowledged: () => void;
}

/**
 * Forces explicit acknowledgement before proceeding — same design as
 * apps/web/src/screens/RecoveryKeyDisplayScreen.tsx: losing both the master password and this
 * code means the vault is unrecoverable by design.
 */
export default function RecoveryKeyDisplayScreen({ recoveryCode, onAcknowledged }: Props) {
  const [confirmed, setConfirmed] = useState(false);

  return (
    <CenteredCard>
      <Heading>Save your recovery key</Heading>
      <Hint>
        If you forget your master password, this is the only other way to unlock your vault.
        Nobody else — including us — can recover it for you. Write it down and store it somewhere
        safe.
      </Hint>
      <Text selectable style={styles.code}>
        {recoveryCode}
      </Text>
      <Pressable
        onPress={() => setConfirmed((c) => !c)}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: confirmed }}
        style={styles.checkboxRow}
      >
        <View style={[styles.checkbox, confirmed && styles.checkboxChecked]} />
        <Text style={styles.checkboxLabel}>I've saved my recovery key somewhere safe</Text>
      </Pressable>
      <AppButton title="Continue to my vault" onPress={onAcknowledged} disabled={!confirmed} />
    </CenteredCard>
  );
}

const styles = StyleSheet.create({
  code: {
    fontFamily: "monospace",
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 16,
    fontSize: 16,
    letterSpacing: 1,
    color: colors.text,
    marginBottom: 16,
  },
  checkboxRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 16 },
  checkbox: { width: 20, height: 20, borderWidth: 1, borderColor: colors.border, borderRadius: 4 },
  checkboxChecked: { backgroundColor: colors.accent, borderColor: colors.accent },
  checkboxLabel: { color: colors.text, flexShrink: 1 },
});
