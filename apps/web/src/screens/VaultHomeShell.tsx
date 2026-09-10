import { useEffect, useState } from "react";
import type { Login } from "@vault/core";
import { changeMasterPassword } from "@vault/core";
import { lockSession, persistAndNotify, useSession } from "../state/sessionStore";
import { useAutoLock } from "../state/autoLock";
import { useAuthState as useGoogleAuthState } from "../lib/googleAuth";
import { useAuthState as useOneDriveAuthState } from "../lib/oneDriveAuth";
import { PROVIDER_LABELS, type StorageProvider } from "../lib/storageProvider";
import { resolveConflictKeepMine, resolveConflictUseTheirs, uploadNow, useSyncState } from "../state/syncStore";
import { loadContainer } from "../storage/indexedDbAdapter";
import { exportLoginsToCsv, type ImportedLoginRow } from "../lib/csvVault";
import FolderSidebar from "../components/FolderSidebar";
import SearchBar from "../components/SearchBar";
import LoginListItem from "../components/LoginListItem";
import LoginEditorScreen, { type LoginFormValues } from "./LoginEditorScreen";
import SettingsScreen from "./SettingsScreen";
import SummaryScreen from "./SummaryScreen";
import ImportVaultScreen from "./ImportVaultScreen";
import ConflictResolutionScreen from "./ConflictResolutionScreen";

interface Props {
  connectedProvider: StorageProvider;
  onLocked: () => void;
  onDisconnectStorage: () => void;
}

const SYNC_STATUS_LABEL: Record<string, string> = {
  disconnected: "Not synced",
  syncing: "Syncing…",
  synced: "Synced",
  "offline-pending": "Offline — will sync when online",
  conflict: "Sync conflict — resolve",
  error: "Sync error",
};

/** Both hooks are cheap and always called, so which provider is "active" can vary per render
 * without breaking the rules of hooks. */
function useConnectedAuth(provider: StorageProvider) {
  const google = useGoogleAuthState();
  const oneDrive = useOneDriveAuthState();
  return provider === "google-drive" ? google : oneDrive;
}

export default function VaultHomeShell({ connectedProvider, onLocked, onDisconnectStorage }: Props) {
  const session = useSession();
  const { accessToken, profile } = useConnectedAuth(connectedProvider);
  const syncState = useSyncState();
  const [selectedFolderId, setSelectedFolderId] = useState<string | null | "all">("all");
  const [query, setQuery] = useState("");
  const [editorState, setEditorState] = useState<"closed" | "new" | Login>("closed");
  const [showSettings, setShowSettings] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [showImport, setShowImport] = useState(false);

  const autoLockMinutes = session.status === "unlocked" ? session.unlockedVault.settings.auto_lock_minutes : 0;
  useAutoLock(autoLockMinutes);

  // The auto-lock timer or a manual "Lock now" click can flip session to locked between
  // renders; hand control back to App so it can show the unlock screen.
  useEffect(() => {
    if (session.status !== "unlocked") onLocked();
  }, [session.status, onLocked]);

  if (session.status !== "unlocked") {
    return null;
  }

  const { unlockedVault, vaultId } = session;
  const allLogins = query.trim() ? unlockedVault.search(query) : unlockedVault.logins;
  const visibleLogins = allLogins.filter((login) => {
    if (selectedFolderId === "all") return true;
    return login.folder_id === selectedFolderId;
  });

  async function persistAndSync(): Promise<void> {
    const raw = await persistAndNotify();
    await uploadNow(connectedProvider, accessToken, vaultId, raw);
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
    if (!confirm("Delete this login? This can't be undone.")) return;
    unlockedVault.deleteLogin(id);
    await persistAndSync();
  }

  async function handleAddFolder(name: string) {
    unlockedVault.addFolder(name);
    await persistAndSync();
  }

  async function handleDeleteFolder(id: string) {
    if (!confirm("Delete this folder? Its logins will move to “No folder”.")) return;
    unlockedVault.deleteFolder(id);
    if (selectedFolderId === id) setSelectedFolderId("all");
    await persistAndSync();
  }

  function handleExportCsv() {
    const proceed = confirm(
      "This creates an unencrypted file with all your passwords. Anyone with access to this file can read them. Continue?",
    );
    if (!proceed) return;
    const csv = exportLoginsToCsv(unlockedVault.logins, unlockedVault.folders);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `vault-export-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setShowSettings(false);
  }

  async function handleImportLogins(rows: ImportedLoginRow[]): Promise<void> {
    const folderIdByName = new Map(unlockedVault.folders.map((f) => [f.name, f.id]));
    for (const row of rows) {
      let folderId: string | null = null;
      if (row.folderName) {
        folderId = folderIdByName.get(row.folderName) ?? null;
        if (!folderId) {
          const created = unlockedVault.addFolder(row.folderName);
          folderId = created.id;
          folderIdByName.set(row.folderName, folderId);
        }
      }
      unlockedVault.addLogin({ ...row.values, folder_id: folderId });
    }
    setShowImport(false);
    await persistAndSync();
  }

  return (
    <div className="app-shell">
      <FolderSidebar
        folders={unlockedVault.folders}
        selectedFolderId={selectedFolderId}
        onSelect={setSelectedFolderId}
        onAddFolder={handleAddFolder}
        onDeleteFolder={handleDeleteFolder}
        onOpenSettings={() => setShowSettings(true)}
        onOpenSummary={() => setShowSummary(true)}
        onLock={() => lockSession()}
      />
      <div className="main-panel">
        <div className="topbar">
          <SearchBar value={query} onChange={setQuery} />
          <button onClick={() => setEditorState("new")}>Add login</button>
          <span className="hint-text" style={{ marginLeft: "auto" }}>
            {SYNC_STATUS_LABEL[syncState.status]}
          </span>
        </div>

        {visibleLogins.length === 0 ? (
          <p className="hint-text">No logins here yet.</p>
        ) : (
          <ul className="login-list">
            {visibleLogins.map((login) => (
              <LoginListItem
                key={login.id}
                login={login}
                onEdit={() => setEditorState(login)}
                onDelete={() => handleDeleteLogin(login.id)}
              />
            ))}
          </ul>
        )}
      </div>

      {editorState !== "closed" && (
        <LoginEditorScreen
          existing={editorState === "new" ? undefined : editorState}
          folders={unlockedVault.folders}
          defaultFolderId={selectedFolderId === "all" ? null : selectedFolderId}
          onSave={handleSaveLogin}
          onCancel={() => setEditorState("closed")}
        />
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
          connectedEmail={profile?.email ?? null}
          providerLabel={PROVIDER_LABELS[connectedProvider]}
          lastSyncedAt={syncState.lastSyncedAt}
          onDisconnectStorage={onDisconnectStorage}
          onExportCsv={handleExportCsv}
          onOpenImport={() => {
            setShowSettings(false);
            setShowImport(true);
          }}
        />
      )}

      {showSummary && (
        <SummaryScreen logins={unlockedVault.logins} folders={unlockedVault.folders} onClose={() => setShowSummary(false)} />
      )}

      {showImport && <ImportVaultScreen onImport={handleImportLogins} onCancel={() => setShowImport(false)} />}

      {syncState.status === "conflict" && accessToken && (
        <ConflictResolutionScreen
          onKeepMine={async () => {
            const raw = await loadContainer(vaultId);
            if (raw) await resolveConflictKeepMine(connectedProvider, accessToken, vaultId, raw);
          }}
          onUseTheirs={async () => {
            await resolveConflictUseTheirs(connectedProvider, accessToken, vaultId);
            lockSession();
          }}
        />
      )}
    </div>
  );
}
