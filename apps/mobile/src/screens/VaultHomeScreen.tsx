import { useEffect, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import type { Login } from "@vault/core";
import { changeMasterPassword } from "@vault/core";
import FormField from "../components/FormField";
import LoginListItem from "../components/LoginListItem";
import { colors } from "../theme";
import { useAutoLock } from "../state/autoLock";
import { lockSession, persistAndNotify, useSession } from "../state/sessionStore";
import { resolveConflictKeepMine, resolveConflictUseTheirs, uploadNow, useSyncState } from "../state/syncStore";
import { loadContainer } from "../storage/vaultStorage";
import LoginEditorScreen, { type LoginFormValues } from "./LoginEditorScreen";
import SettingsScreen from "./SettingsScreen";
import SummaryScreen from "./SummaryScreen";
import ConflictResolutionScreen from "./ConflictResolutionScreen";

interface Props {
  accessToken: string | null;
  driveEmail: string | null;
  onLocked: () => void;
  onDisconnectDrive: () => void;
}

const SYNC_STATUS_LABEL: Record<string, string> = {
  disconnected: "Not synced",
  syncing: "Syncing…",
  synced: "Synced",
  "offline-pending": "Offline — will sync when online",
  conflict: "Sync conflict — resolve",
  error: "Sync error",
};

export default function VaultHomeScreen({ accessToken, driveEmail, onLocked, onDisconnectDrive }: Props) {
  const session = useSession();
  const syncState = useSyncState();
  const [selectedFolderId, setSelectedFolderId] = useState<string | null | "all">("all");
  const [query, setQuery] = useState("");
  const [editorState, setEditorState] = useState<"closed" | "new" | Login>("closed");
  const [showSettings, setShowSettings] = useState(false);
  const [showSummary, setShowSummary] = useState(false);

  const autoLockMinutes = session.status === "unlocked" ? session.unlockedVault.settings.auto_lock_minutes : 0;
  useAutoLock(autoLockMinutes);

  // Auto-lock (backgrounding) or a manual "Lock now" tap flips session to locked between
  // renders; hand control back to App so it can show the unlock screen.
  useEffect(() => {
    if (session.status !== "unlocked") onLocked();
  }, [session.status, onLocked]);

  if (session.status !== "unlocked") {
    return null;
  }

  const { unlockedVault, vaultId } = session;
  const allLogins = query.trim() ? unlockedVault.search(query) : unlockedVault.logins;
  const visibleLogins = allLogins.filter((login) => selectedFolderId === "all" || login.folder_id === selectedFolderId);

  async function persistAndSync(): Promise<void> {
    const raw = await persistAndNotify();
    await uploadNow(accessToken, vaultId, raw);
  }

  async function handleSaveLogin(values: LoginFormValues) {
    if (editorState === "new") {
      unlockedVault.addLogin(values);
    } else if (editorState !== "closed") {
      unlockedVault.updateLogin(editorState.id, values);
    }
    setEditorState("closed");
    await persistAndSync();
  }

  async function handleDeleteLogin(id: string) {
    unlockedVault.deleteLogin(id);
    await persistAndSync();
  }

  return (
    <View style={styles.screen}>
      <View style={styles.topbar}>
        <FormField
          label=""
          placeholder="Search logins…"
          value={query}
          onChangeText={setQuery}
          style={styles.searchInput}
          accessibilityLabel="Search logins"
        />
        <View style={styles.topbarActions}>
          <Pressable style={styles.iconButton} onPress={() => setEditorState("new")} accessibilityLabel="Add login">
            <Text style={styles.iconButtonText}>+ Add</Text>
          </Pressable>
          <Pressable style={styles.iconButton} onPress={() => setShowSummary(true)} accessibilityLabel="Summary">
            <Text style={styles.iconButtonText}>Summary</Text>
          </Pressable>
          <Pressable style={styles.iconButton} onPress={() => setShowSettings(true)} accessibilityLabel="Settings">
            <Text style={styles.iconButtonText}>Settings</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.chipRow}>
        <Pressable style={[styles.chip, selectedFolderId === "all" && styles.chipActive]} onPress={() => setSelectedFolderId("all")}>
          <Text style={styles.chipText}>All</Text>
        </Pressable>
        <Pressable style={[styles.chip, selectedFolderId === null && styles.chipActive]} onPress={() => setSelectedFolderId(null)}>
          <Text style={styles.chipText}>No folder</Text>
        </Pressable>
        {unlockedVault.folders.map((f) => (
          <Pressable
            key={f.id}
            style={[styles.chip, selectedFolderId === f.id && styles.chipActive]}
            onPress={() => setSelectedFolderId(f.id)}
          >
            <Text style={styles.chipText}>{f.name}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.syncStatus}>{SYNC_STATUS_LABEL[syncState.status]}</Text>

      <FlatList
        data={visibleLogins}
        keyExtractor={(l) => l.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text style={styles.empty}>No logins here yet.</Text>}
        renderItem={({ item }) => (
          <LoginListItem login={item} onEdit={() => setEditorState(item)} onDelete={() => handleDeleteLogin(item.id)} />
        )}
      />

      <Pressable style={styles.lockButton} onPress={() => lockSession()} accessibilityRole="button">
        <Text style={styles.lockButtonText}>Lock now</Text>
      </Pressable>

      {editorState !== "closed" && (
        <LoginEditorScreen
          existing={editorState === "new" ? undefined : editorState}
          folders={unlockedVault.folders}
          defaultFolderId={selectedFolderId === "all" ? null : selectedFolderId}
          onSave={handleSaveLogin}
          onCancel={() => setEditorState("closed")}
        />
      )}

      {showSummary && (
        <SummaryScreen logins={unlockedVault.logins} folders={unlockedVault.folders} onClose={() => setShowSummary(false)} />
      )}

      {showSettings && (
        <SettingsScreen
          settings={unlockedVault.settings}
          onUpdateSettings={async (patch) => {
            unlockedVault.updateSettings(patch);
            await persistAndSync();
          }}
          onChangePassword={async (newPassword) => {
            changeMasterPassword(unlockedVault, newPassword);
            await persistAndSync();
          }}
          onClose={() => setShowSettings(false)}
          driveEmail={driveEmail}
          lastSyncedAt={syncState.lastSyncedAt}
          onDisconnectDrive={onDisconnectDrive}
        />
      )}

      {syncState.status === "conflict" && accessToken && (
        <ConflictResolutionScreen
          onKeepMine={async () => {
            const raw = await loadContainer(vaultId);
            if (raw) await resolveConflictKeepMine(accessToken, vaultId, raw);
          }}
          onUseTheirs={async () => {
            await resolveConflictUseTheirs(accessToken, vaultId);
            lockSession();
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, paddingTop: 50, paddingHorizontal: 16 },
  topbar: { flexDirection: "row", alignItems: "flex-end", gap: 8, marginBottom: 8 },
  searchInput: { flex: 1, marginBottom: 0 },
  topbarActions: { flexDirection: "row", gap: 8 },
  iconButton: {
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 10,
  },
  iconButtonText: { color: colors.text, fontSize: 13 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 8 },
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
  syncStatus: { color: colors.muted, fontSize: 12, marginBottom: 8 },
  list: { paddingBottom: 80 },
  empty: { color: colors.muted, textAlign: "center", marginTop: 40 },
  lockButton: { position: "absolute", bottom: 20, right: 16, backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border, borderRadius: 20, paddingVertical: 10, paddingHorizontal: 16 },
  lockButtonText: { color: colors.text, fontSize: 13 },
});
