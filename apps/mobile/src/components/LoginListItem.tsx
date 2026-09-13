import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { Login } from "@vault/core";
import { CATEGORY_LABELS } from "@vault/core";
import { copyAndAutoClear } from "../lib/clipboard";
import { colors } from "../theme";

interface Props {
  login: Login;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export default function LoginListItem({ login, onView, onEdit, onDelete }: Props) {
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
        <Pressable style={styles.chip} onPress={onView}>
          <Text style={styles.chipText}>View</Text>
        </Pressable>
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
