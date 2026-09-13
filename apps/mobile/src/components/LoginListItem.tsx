import { useState } from "react";
import * as Clipboard from "expo-clipboard";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { Login } from "@vault/core";
import { CATEGORY_LABELS } from "@vault/core";
import { colors } from "../theme";

const CLIPBOARD_CLEAR_MS = 20_000;

interface Props {
  login: Login;
  onEdit: () => void;
  onDelete: () => void;
}

async function copyAndAutoClear(value: string, setStatus: (s: string | null) => void): Promise<void> {
  await Clipboard.setStringAsync(value);
  setStatus("Copied — clipboard clears in 20s");
  setTimeout(async () => {
    const current = await Clipboard.getStringAsync().catch(() => null);
    if (current === value) await Clipboard.setStringAsync("");
    setStatus(null);
  }, CLIPBOARD_CLEAR_MS);
}

export default function LoginListItem({ login, onEdit, onDelete }: Props) {
  const [revealed, setRevealed] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  return (
    <View style={styles.item}>
      <Text style={styles.title}>
        {login.title}
        {login.category && login.category !== "login" ? ` · ${CATEGORY_LABELS[login.category]}` : ""}
      </Text>
      <Text style={styles.meta}>
        {login.username} · {login.url}
      </Text>
      {revealed && <Text style={styles.meta}>{login.password}</Text>}
      {status && (
        <Text accessibilityLiveRegion="polite" style={styles.status}>
          {status}
        </Text>
      )}
      <View style={styles.row}>
        <Pressable style={styles.chip} onPress={() => setRevealed((r) => !r)}>
          <Text style={styles.chipText}>{revealed ? "Hide" : "Show"}</Text>
        </Pressable>
        <Pressable style={styles.chip} onPress={() => copyAndAutoClear(login.password, setStatus)}>
          <Text style={styles.chipText}>Copy password</Text>
        </Pressable>
        <Pressable style={styles.chip} onPress={onEdit}>
          <Text style={styles.chipText}>Edit</Text>
        </Pressable>
        <Pressable style={[styles.chip, styles.dangerChip]} onPress={onDelete}>
          <Text style={styles.chipText}>Delete</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  item: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
  },
  title: { color: colors.text, fontWeight: "600", fontSize: 15 },
  meta: { color: colors.muted, fontSize: 13, marginTop: 2 },
  status: { color: colors.muted, fontSize: 12, marginTop: 4 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
  chip: {
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  dangerChip: { borderColor: colors.danger },
  chipText: { color: colors.text, fontSize: 13 },
});
