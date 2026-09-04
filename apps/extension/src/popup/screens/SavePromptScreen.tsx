import { useState } from "react";
import { sendToBackground } from "../../lib/messaging";
import type { PendingSave } from "../../lib/storage";

interface Props {
  pending: PendingSave;
  onResolved: () => void;
}

export default function SavePromptScreen({ pending, onResolved }: Props) {
  const [busy, setBusy] = useState(false);

  async function handleSave() {
    setBusy(true);
    await sendToBackground({ type: "CONFIRM_PENDING_SAVE", folderId: null });
    setBusy(false);
    onResolved();
  }

  async function handleDismiss() {
    setBusy(true);
    await sendToBackground({ type: "DISMISS_PENDING_SAVE" });
    setBusy(false);
    onResolved();
  }

  return (
    <div className="screen">
      <h2>Save this login?</h2>
      <p className="hint">You just signed in to {pending.origin}.</p>
      <div className="field-label">Site</div>
      <input readOnly value={pending.origin} />
      <div className="field-label">Username</div>
      <input readOnly value={pending.username} />
      <div className="row">
        <button disabled={busy} onClick={handleSave}>
          Save
        </button>
        <button className="secondary" disabled={busy} onClick={handleDismiss}>
          Not now
        </button>
      </div>
    </div>
  );
}
