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

function StatTile({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <View style={styles.tile}>
      <Text style={styles.tileLabel}>{label}</Text>
      <Text style={[styles.tileValue, color ? { color } : null]}>{value}</Text>
    </View>
  );
}

export default function SummaryScreen({ logins, folders, onClose }: Props) {
  const insights = computeVaultInsights(logins, folders);
  const maxCategoryCount = Math.max(1, ...insights.folderBreakdown.map((f) => f.count));

  return (
    <Modal animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <Heading>Vault summary</Heading>

        <View style={styles.tileGrid}>
          <StatTile label="Total logins" value={insights.totalLogins} />
          <StatTile label="Weak" value={insights.weakCount} color={colors.warning} />
          <StatTile label="Reused" value={insights.reusedCount} color={colors.danger} />
          <StatTile label={`Stale (${STALE_DAYS}+d)`} value={insights.staleCount} color={colors.warning} />
        </View>

        <Heading>By category</Heading>
        {insights.folderBreakdown.length === 0 ? (
          <Text style={styles.hint}>No folders yet.</Text>
        ) : (
          insights.folderBreakdown.map((entry) => (
            <View key={entry.folder_id ?? "none"} style={styles.barRow}>
              <Text style={styles.barName} numberOfLines={1}>
                {entry.name}
              </Text>
              <View style={styles.barTrack}>
                <View style={[styles.barFill, { width: `${(entry.count / maxCategoryCount) * 100}%` }]} />
              </View>
              <Text style={styles.hint}>{entry.count}</Text>
            </View>
          ))
        )}

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
  tileGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 8 },
  tile: { backgroundColor: colors.surface2, borderRadius: 8, padding: 10, flexBasis: "47%", flexGrow: 1 },
  tileLabel: { color: colors.muted, fontSize: 12, marginBottom: 4 },
  tileValue: { color: colors.text, fontSize: 22, fontWeight: "600" },
  barRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 4 },
  barName: { color: colors.muted, fontSize: 13, width: 80 },
  barTrack: { flex: 1, height: 7, backgroundColor: colors.surface2, borderRadius: 4, overflow: "hidden" },
  barFill: { height: "100%", backgroundColor: colors.accent, borderRadius: 4 },
});
