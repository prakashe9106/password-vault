import { useEffect, useState } from "react";
import type { Folder, Login, VaultSettings } from "@vault/core";
import { CATEGORY_LABELS } from "@vault/core";
import { sendToBackground } from "../../lib/messaging";
import { matchLoginsForOrigin } from "../../lib/matching";
import LoginEditorScreen, { type LoginFormValues } from "./LoginEditorScreen";
import SettingsScreen from "./SettingsScreen";
import SummaryScreen from "./SummaryScreen";

interface Props {
  onLocked: () => void;
}

export default function VaultHomeScreen({ onLocked }: Props) {
  const [logins, setLogins] = useState<Login[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [settings, setSettings] = useState<VaultSettings | null>(null);
  const [query, setQuery] = useState("");
  const [activeOrigin, setActiveOrigin] = useState<string | null>(null);
  const [hasLoginForm, setHasLoginForm] = useState(false);
  const [editorState, setEditorState] = useState<"closed" | "new" | Login>("closed");
  const [showSettings, setShowSettings] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [fillStatus, setFillStatus] = useState<string | null>(null);

  async function loadVault() {
    const result = await sendToBackground<{ ok: boolean; logins?: Login[]; folders?: Folder[]; settings?: VaultSettings }>({
      type: "GET_VAULT_DATA",
    });
    if (!result.ok) {
      onLocked();
      return;
    }
    setLogins(result.logins ?? []);
    setFolders(result.folders ?? []);
    setSettings(result.settings ?? null);
  }

  async function loadTabInfo() {
    const info = await sendToBackground<{ origin: string | null; hasLoginForm: boolean }>({
      type: "GET_ACTIVE_TAB_INFO",
    });
    setActiveOrigin(info.origin);
    setHasLoginForm(info.hasLoginForm);
  }

  useEffect(() => {
    loadVault();
    loadTabInfo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = query.trim()
    ? logins.filter((l) => `${l.title} ${l.url} ${l.username}`.toLowerCase().includes(query.trim().toLowerCase()))
    : logins;
  const matchingIds = new Set(
    hasLoginForm && activeOrigin ? matchLoginsForOrigin(logins, activeOrigin).map((l) => l.id) : [],
  );

  async function handleFill(loginId: string) {
    setFillStatus("Filling…");
    const result = await sendToBackground<{ ok: boolean; filled?: boolean; error?: string }>({
      type: "FILL_REQUEST",
      loginId,
    });
    setFillStatus(result.ok && result.filled ? "Filled" : (result.error ?? "Could not fill."));
    setTimeout(() => setFillStatus(null), 2000);
  }

  async function handleSaveLogin(values: LoginFormValues) {
    if (editorState === "new") {
      await sendToBackground({ type: "ADD_LOGIN", input: values });
    } else if (editorState !== "closed") {
      await sendToBackground({ type: "UPDATE_LOGIN", id: editorState.id, patch: values });
    }
    setEditorState("closed");
    await loadVault();
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this login?")) return;
    await sendToBackground({ type: "DELETE_LOGIN", id });
    await loadVault();
  }

  return (
    <div className="screen">
      <div className="topbar">
        <input
          aria-label="Search logins"
          placeholder="Search…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button aria-label="Add login" onClick={() => setEditorState("new")}>
          +
        </button>
      </div>

      {fillStatus && (
        <p className="hint" role="status" aria-live="polite">
          {fillStatus}
        </p>
      )}

      {filtered.length === 0 ? (
        <p className="hint">No logins yet.</p>
      ) : (
        <ul className="login-list">
          {filtered.map((login) => (
            <li key={login.id} className="login-row">
              <span className="login-title">
                {login.title}
                {login.category && login.category !== "login" && (
                  <span className="hint" style={{ marginLeft: "0.4rem", fontSize: "0.7rem" }}>
                    {CATEGORY_LABELS[login.category]}
                  </span>
                )}
              </span>
              <div className="row">
                {matchingIds.has(login.id) && <button onClick={() => handleFill(login.id)}>Fill</button>}
                <button className="secondary" onClick={() => setEditorState(login)}>
                  Edit
                </button>
                <button className="danger" onClick={() => handleDelete(login.id)}>
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="row footer-row">
        <button className="secondary" onClick={() => setShowSummary(true)}>
          Summary
        </button>
        <button className="secondary" onClick={() => setShowSettings(true)}>
          Settings
        </button>
        <button
          className="secondary"
          onClick={async () => {
            await sendToBackground({ type: "LOCK" });
            onLocked();
          }}
        >
          Lock
        </button>
      </div>

      {editorState !== "closed" && (
        <LoginEditorScreen
          existing={editorState === "new" ? undefined : editorState}
          folders={folders}
          onSave={handleSaveLogin}
          onCancel={() => setEditorState("closed")}
        />
      )}

      {showSummary && <SummaryScreen logins={logins} folders={folders} onClose={() => setShowSummary(false)} />}

      {showSettings && settings && (
        <SettingsScreen
          settings={settings}
          onUpdateSettings={async (patch) => {
            await sendToBackground({ type: "UPDATE_SETTINGS", patch });
            await loadVault();
          }}
          onChangePassword={async (newPassword) => {
            await sendToBackground({ type: "CHANGE_MASTER_PASSWORD", newPassword });
          }}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}
