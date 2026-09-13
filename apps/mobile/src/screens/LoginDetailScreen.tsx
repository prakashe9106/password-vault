import { useState } from "react";
import { Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { Folder, Login } from "@vault/core";
import { CATEGORY_LABELS } from "@vault/core";
import { copyAndAutoClear } from "../lib/clipboard";
import AppButton from "../components/AppButton";
import { Heading } from "../components/Typography";
import { colors } from "../theme";

interface Props {
  login: Login;
  folders: readonly Folder[];
  onEdit: () => void;
  onClose: () => void;
}

function folderName(folders: readonly Folder[], folderId: string | null): string {
  if (folderId === null) return "No folder";
  return folders.find((f) => f.id === folderId)?.name ?? "Folder no longer exists";
}

function withScheme(url: string): string {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

function DetailField({ label, value }: { label: string; value: string }) {
  const [status, setStatus] = useState<string | null>(null);
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.valueRow}>
        <Text style={styles.value} selectable>
          {value}
        </Text>
        <AppButton title="Copy" variant="secondary" onPress={() => copyAndAutoClear(value, setStatus)} />
      </View>
      {status && <Text style={styles.status}>{status}</Text>}
    </View>
  );
}

export default function LoginDetailScreen({ login, folders, onEdit, onClose }: Props) {
  const [revealed, setRevealed] = useState(false);
  const [passwordStatus, setPasswordStatus] = useState<string | null>(null);

  return (
    <Modal animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <Heading>
          {login.title}
          {login.category && login.category !== "login" ? ` · ${CATEGORY_LABELS[login.category]}` : ""}
        </Heading>
        {login.url && (
          <View style={styles.field}>
            <Text style={styles.label}>Website URL</Text>
            <Pressable onPress={() => Linking.openURL(withScheme(login.url))}>
              <Text style={styles.link}>{login.url}</Text>
            </Pressable>
          </View>
        )}
        <DetailField label="Username" value={login.username} />
        <View style={styles.field}>
          <Text style={styles.label}>Password</Text>
          <View style={styles.valueRow}>
            <Text style={styles.value} selectable={revealed}>
              {revealed ? login.password : "•".repeat(Math.max(login.password.length, 8))}
            </Text>
            <AppButton title={revealed ? "Hide" : "Show"} variant="secondary" onPress={() => setRevealed((r) => !r)} />
            <AppButton
              title="Copy"
              variant="secondary"
              onPress={() => copyAndAutoClear(login.password, setPasswordStatus)}
            />
          </View>
          {passwordStatus && <Text style={styles.status}>{passwordStatus}</Text>}
        </View>
        {login.custom_fields.map((field) => (
          <DetailField key={field.label} label={field.label} value={field.value} />
        ))}
        <View style={styles.field}>
          <Text style={styles.label}>Folder</Text>
          <Text style={styles.value}>{folderName(folders, login.folder_id)}</Text>
        </View>
        {login.notes && (
          <View style={styles.field}>
            <Text style={styles.label}>Notes</Text>
            <Text style={styles.value}>{login.notes}</Text>
          </View>
        )}
        <View style={{ gap: 10, marginTop: 8 }}>
          <AppButton title="Edit" onPress={onEdit} />
          <AppButton title="Close" variant="secondary" onPress={onClose} />
        </View>
      </ScrollView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 20 },
  field: { marginBottom: 16 },
  label: { color: colors.muted, fontSize: 13, marginBottom: 6 },
  value: { color: colors.text, fontSize: 15, flexShrink: 1 },
  valueRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  status: { color: colors.muted, fontSize: 12, marginTop: 4 },
  link: { color: colors.accent, fontSize: 15, textDecorationLine: "underline" },
});
