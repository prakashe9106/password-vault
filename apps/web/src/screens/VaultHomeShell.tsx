import { useEffect, useState } from "react";
import type { Login } from "@vault/core";
import { changeMasterPassword } from "@vault/core";
import { lockSession, persistAndNotify, useSession } from "../state/sessionStore";
import { useAutoLock } from "../state/autoLock";
import FolderSidebar from "../components/FolderSidebar";
import SearchBar from "../components/SearchBar";
import LoginListItem from "../components/LoginListItem";
import LoginEditorScreen, { type LoginFormValues } from "./LoginEditorScreen";
import SettingsScreen from "./SettingsScreen";

interface Props {
  onLocked: () => void;
}

export default function VaultHomeShell({ onLocked }: Props) {
  const session = useSession();
  const [selectedFolderId, setSelectedFolderId] = useState<string | null | "all">("all");
  const [query, setQuery] = useState("");
  const [editorState, setEditorState] = useState<"closed" | "new" | Login>("closed");
  const [showSettings, setShowSettings] = useState(false);

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

  const { unlockedVault } = session;
  const allLogins = query.trim() ? unlockedVault.search(query) : unlockedVault.logins;
  const visibleLogins = allLogins.filter((login) => {
    if (selectedFolderId === "all") return true;
    return login.folder_id === selectedFolderId;
  });

  async function handleSaveLogin(values: LoginFormValues) {
    if (editorState === "new") {
      unlockedVault.addLogin(values);
    } else if (editorState !== "closed") {
      unlockedVault.updateLogin(editorState.id, values);
    }
    setEditorState("closed");
    await persistAndNotify();
  }

  async function handleDeleteLogin(id: string) {
    if (!confirm("Delete this login? This can't be undone.")) return;
    unlockedVault.deleteLogin(id);
    await persistAndNotify();
  }

  async function handleAddFolder(name: string) {
    unlockedVault.addFolder(name);
    await persistAndNotify();
  }

  async function handleDeleteFolder(id: string) {
    if (!confirm("Delete this folder? Its logins will move to “No folder”.")) return;
    unlockedVault.deleteFolder(id);
    if (selectedFolderId === id) setSelectedFolderId("all");
    await persistAndNotify();
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
        onLock={() => lockSession()}
      />
      <div className="main-panel">
        <div className="topbar">
          <SearchBar value={query} onChange={setQuery} />
          <button onClick={() => setEditorState("new")}>Add login</button>
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
            await persistAndNotify();
          }}
          onChangePassword={async (newPassword) => {
            changeMasterPassword(unlockedVault, newPassword);
            await persistAndNotify();
          }}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}
