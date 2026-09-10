import { Modal, ScrollView, StyleSheet, Text, View } from "react-native";
import type { Folder, Login } from "@vault/core";
import { computeVaultInsights, STALE_DAYS } from "@vault/core";
import AppButton from "../components/AppButton";
import { Heading } from "../components/Typography";
import { colors } from "../theme";

interface Props {
  logins: readonly Login[];
  folders: readonly Folder[];
  onClose: () => void;
}

export default function SummaryScreen({ logins, folders, onClose }: Props) {
  const insights = computeVaultInsights(logins, folders);

  return (
    <Modal animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <Heading>Vault summary</Heading>
        <Text style={styles.hint}>{insights.totalLogins} saved logins</Text>

        <Heading>By category</Heading>
        {insights.folderBreakdown.length === 0 ? (
          <Text style={styles.hint}>No folders yet.</Text>
        ) : (
          insights.folderBreakdown.map((entry) => (
            <View key={entry.folder_id ?? "none"} style={styles.row}>
              <Text style={styles.rowLabel}>{entry.name}</Text>
              <Text style={styles.hint}>{entry.count}</Text>
            </View>
          ))
        )}

        <Heading>Smart insights</Heading>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Weak passwords</Text>
          <Text style={styles.hint}>{insights.weakCount}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Reused passwords</Text>
          <Text style={styles.hint}>{insights.reusedCount}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Not changed in {STALE_DAYS}+ days</Text>
          <Text style={styles.hint}>{insights.staleCount}</Text>
        </View>

        <View style={{ height: 16 }} />
        <AppButton title="Close" variant="secondary" onPress={onClose} />
      </ScrollView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 20 },
  hint: { color: colors.muted, fontSize: 13 },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6 },
  rowLabel: { color: colors.text, fontSize: 14 },
});
