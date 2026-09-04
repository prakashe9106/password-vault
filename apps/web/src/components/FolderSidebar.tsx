import { useState } from "react";
import type { Folder } from "@vault/core";

interface Props {
  folders: readonly Folder[];
  selectedFolderId: string | null | "all";
  onSelect: (folderId: string | null | "all") => void;
  onAddFolder: (name: string) => void;
  onDeleteFolder: (folderId: string) => void;
  onOpenSettings: () => void;
  onLock: () => void;
}

export default function FolderSidebar({
  folders,
  selectedFolderId,
  onSelect,
  onAddFolder,
  onDeleteFolder,
  onOpenSettings,
  onLock,
}: Props) {
  const [newFolderName, setNewFolderName] = useState("");

  return (
    <div className="sidebar">
      <button
        className={`sidebar-item ${selectedFolderId === "all" ? "active" : ""}`}
        onClick={() => onSelect("all")}
      >
        All logins
      </button>
      <button
        className={`sidebar-item ${selectedFolderId === null ? "active" : ""}`}
        onClick={() => onSelect(null)}
      >
        No folder
      </button>

      <div style={{ marginTop: "0.75rem", marginBottom: "0.25rem", color: "var(--muted)", fontSize: "0.8rem" }}>
        FOLDERS
      </div>
      {folders.map((folder) => (
        <div key={folder.id} style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
          <button
            className={`sidebar-item ${selectedFolderId === folder.id ? "active" : ""}`}
            style={{ flex: 1 }}
            onClick={() => onSelect(folder.id)}
          >
            {folder.name}
          </button>
          <button
            className="secondary"
            title="Delete folder"
            style={{ padding: "0.2rem 0.5rem" }}
            onClick={() => onDeleteFolder(folder.id)}
          >
            ×
          </button>
        </div>
      ))}

      <form
        style={{ display: "flex", gap: "0.25rem", marginTop: "0.5rem" }}
        onSubmit={(e) => {
          e.preventDefault();
          if (!newFolderName.trim()) return;
          onAddFolder(newFolderName.trim());
          setNewFolderName("");
        }}
      >
        <input
          placeholder="New folder"
          value={newFolderName}
          onChange={(e) => setNewFolderName(e.target.value)}
          style={{ fontSize: "0.85rem" }}
        />
        <button type="submit" style={{ padding: "0.4rem 0.6rem" }}>
          +
        </button>
      </form>

      <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        <button className="secondary" onClick={onOpenSettings}>
          Settings
        </button>
        <button className="secondary" onClick={onLock}>
          Lock now
        </button>
      </div>
    </div>
  );
}
