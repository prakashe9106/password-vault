import { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { Folder, Login } from "@vault/core";
import { defaultGeneratorRules, generatePasswordAsync } from "@vault/core";
import AppButton from "../components/AppButton";
import FormField from "../components/FormField";
import { Heading } from "../components/Typography";
import { colors } from "../theme";

export interface LoginFormValues {
  title: string;
  url: string;
  username: string;
  password: string;
  notes: string;
  folder_id: string | null;
}

interface Props {
  existing?: Login;
  folders: readonly Folder[];
  defaultFolderId?: string | null;
  onSave: (values: LoginFormValues) => void;
  onCancel: () => void;
}

export default function LoginEditorScreen({ existing, folders, defaultFolderId, onSave, onCancel }: Props) {
  const [values, setValues] = useState<LoginFormValues>({
    title: existing?.title ?? "",
    url: existing?.url ?? "",
    username: existing?.username ?? "",
    password: existing?.password ?? "",
    notes: existing?.notes ?? "",
    folder_id: existing?.folder_id ?? defaultFolderId ?? null,
  });
  const [generating, setGenerating] = useState(false);

  function update<K extends keyof LoginFormValues>(key: K, value: LoginFormValues[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  async function handleGenerate() {
    setGenerating(true);
    try {
      const password = await generatePasswordAsync(defaultGeneratorRules());
      update("password", password);
    } finally {
      setGenerating(false);
    }
  }

  return (
    <Modal animationType="slide" presentationStyle="pageSheet" onRequestClose={onCancel}>
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <Heading>{existing ? "Edit login" : "Add login"}</Heading>
        <FormField label="Title" value={values.title} onChangeText={(t) => update("title", t)} />
        <FormField
          label="Website URL"
          value={values.url}
          onChangeText={(t) => update("url", t)}
          autoCapitalize="none"
          keyboardType="url"
        />
        <FormField label="Username" value={values.username} onChangeText={(t) => update("username", t)} autoCapitalize="none" />
        <FormField label="Password" value={values.password} onChangeText={(t) => update("password", t)} autoCapitalize="none" />
        <AppButton title="Generate password" variant="secondary" onPress={handleGenerate} busy={generating} />
        <View style={{ height: 16 }} />
        <Text style={styles.label}>Folder</Text>
        <View style={styles.chipRow}>
          <Pressable
            style={[styles.chip, values.folder_id === null && styles.chipActive]}
            onPress={() => update("folder_id", null)}
          >
            <Text style={styles.chipText}>No folder</Text>
          </Pressable>
          {folders.map((f) => (
            <Pressable
              key={f.id}
              style={[styles.chip, values.folder_id === f.id && styles.chipActive]}
              onPress={() => update("folder_id", f.id)}
            >
              <Text style={styles.chipText}>{f.name}</Text>
            </Pressable>
          ))}
        </View>
        <FormField
          label="Notes"
          value={values.notes}
          onChangeText={(t) => update("notes", t)}
          multiline
          numberOfLines={3}
        />
        <View style={{ gap: 10, marginTop: 8 }}>
          <AppButton title="Save" onPress={() => onSave(values)} />
          <AppButton title="Cancel" variant="secondary" onPress={onCancel} />
        </View>
      </ScrollView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 20 },
  label: { color: colors.muted, fontSize: 13, marginBottom: 8 },
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
