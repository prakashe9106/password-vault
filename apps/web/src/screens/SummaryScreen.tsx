import type { Folder, Login } from "@vault/core";
import { computeVaultInsights, STALE_DAYS } from "@vault/core";
import Modal from "../components/Modal";

interface Props {
  logins: readonly Login[];
  folders: readonly Folder[];
  onClose: () => void;
}

export default function SummaryScreen({ logins, folders, onClose }: Props) {
  const insights = computeVaultInsights(logins, folders);

  return (
    <Modal titleId="summary-title" onClose={onClose} maxWidth={420}>
      <h1 id="summary-title">Vault summary</h1>
      <p className="hint-text">{insights.totalLogins} saved logins</p>

      <h2 style={{ fontSize: "1rem", margin: "1rem 0 0.5rem" }}>By category</h2>
      {insights.folderBreakdown.length === 0 ? (
        <p className="hint-text">No folders yet.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {insights.folderBreakdown.map((entry) => (
            <li
              key={entry.folder_id ?? "none"}
              style={{ display: "flex", justifyContent: "space-between", padding: "0.35rem 0" }}
            >
              <span>{entry.name}</span>
              <span className="hint-text">{entry.count}</span>
            </li>
          ))}
        </ul>
      )}

      <h2 style={{ fontSize: "1rem", margin: "1rem 0 0.5rem" }}>Smart insights</h2>
      <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
        <li style={{ display: "flex", justifyContent: "space-between", padding: "0.35rem 0" }}>
          <span>Weak passwords</span>
          <span className="hint-text">{insights.weakCount}</span>
        </li>
        <li style={{ display: "flex", justifyContent: "space-between", padding: "0.35rem 0" }}>
          <span>Reused passwords</span>
          <span className="hint-text">{insights.reusedCount}</span>
        </li>
        <li style={{ display: "flex", justifyContent: "space-between", padding: "0.35rem 0" }}>
          <span>Not changed in {STALE_DAYS}+ days</span>
          <span className="hint-text">{insights.staleCount}</span>
        </li>
      </ul>

      <button type="button" onClick={onClose} style={{ marginTop: "1.25rem" }}>
        Close
      </button>
    </Modal>
  );
}
