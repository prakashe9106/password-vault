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
    <Modal titleId="summary-title" onClose={onClose}>
      <h2 id="summary-title">Vault summary</h2>
      <p className="hint">{insights.totalLogins} saved logins</p>

      <p style={{ margin: "0.75rem 0 0.25rem", fontWeight: 600 }}>By category</p>
      {insights.folderBreakdown.length === 0 ? (
        <p className="hint">No folders yet.</p>
      ) : (
        insights.folderBreakdown.map((entry) => (
          <div key={entry.folder_id ?? "none"} className="row" style={{ justifyContent: "space-between" }}>
            <span>{entry.name}</span>
            <span className="hint">{entry.count}</span>
          </div>
        ))
      )}

      <p style={{ margin: "0.75rem 0 0.25rem", fontWeight: 600 }}>Smart insights</p>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <span>Weak passwords</span>
        <span className="hint">{insights.weakCount}</span>
      </div>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <span>Reused passwords</span>
        <span className="hint">{insights.reusedCount}</span>
      </div>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <span>Not changed in {STALE_DAYS}+ days</span>
        <span className="hint">{insights.staleCount}</span>
      </div>

      <button type="button" className="secondary" onClick={onClose} style={{ marginTop: "1rem" }}>
        Close
      </button>
    </Modal>
  );
}
