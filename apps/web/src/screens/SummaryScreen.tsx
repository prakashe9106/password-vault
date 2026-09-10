import type { Folder, Login } from "@vault/core";
import { computeVaultInsights, STALE_DAYS } from "@vault/core";
import Modal from "../components/Modal";

interface Props {
  logins: readonly Login[];
  folders: readonly Folder[];
  onClose: () => void;
}

function StatTile({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div style={{ background: "var(--surface-2)", borderRadius: 8, padding: "0.75rem" }}>
      <p className="hint-text" style={{ margin: "0 0 0.25rem" }}>
        {label}
      </p>
      <p style={{ margin: 0, fontSize: "1.5rem", fontWeight: 600, color: color ?? "var(--text)" }}>{value}</p>
    </div>
  );
}

export default function SummaryScreen({ logins, folders, onClose }: Props) {
  const insights = computeVaultInsights(logins, folders);
  const maxCategoryCount = Math.max(1, ...insights.folderBreakdown.map((f) => f.count));

  return (
    <Modal titleId="summary-title" onClose={onClose} maxWidth={480}>
      <h1 id="summary-title">Vault summary</h1>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(100px, 1fr))", gap: "0.6rem", margin: "1rem 0" }}>
        <StatTile label="Total logins" value={insights.totalLogins} />
        <StatTile label="Weak" value={insights.weakCount} color="var(--warning)" />
        <StatTile label="Reused" value={insights.reusedCount} color="var(--danger)" />
        <StatTile label={`Stale (${STALE_DAYS}+d)`} value={insights.staleCount} color="var(--warning)" />
      </div>

      <h2 style={{ fontSize: "1rem", margin: "1.25rem 0 0.6rem" }}>By category</h2>
      {insights.folderBreakdown.length === 0 ? (
        <p className="hint-text">No folders yet.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {insights.folderBreakdown.map((entry) => (
            <div
              key={entry.folder_id ?? "none"}
              style={{ display: "grid", gridTemplateColumns: "90px 1fr 28px", alignItems: "center", gap: "0.6rem" }}
            >
              <span className="hint-text" style={{ fontSize: "0.85rem" }}>
                {entry.name}
              </span>
              <div style={{ background: "var(--surface-2)", borderRadius: 4, height: 8, overflow: "hidden" }}>
                <div
                  style={{
                    height: "100%",
                    width: `${(entry.count / maxCategoryCount) * 100}%`,
                    background: "var(--accent)",
                    borderRadius: 4,
                  }}
                />
              </div>
              <span className="hint-text" style={{ fontSize: "0.85rem", textAlign: "right" }}>
                {entry.count}
              </span>
            </div>
          ))}
        </div>
      )}

      <button type="button" onClick={onClose} style={{ marginTop: "1.25rem" }}>
        Close
      </button>
    </Modal>
  );
}
