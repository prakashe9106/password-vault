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
      <label className="field-label" htmlFor="save-prompt-site">
        Site
      </label>
      <input id="save-prompt-site" readOnly value={pending.origin} />
      <label className="field-label" htmlFor="save-prompt-username">
        Username
      </label>
      <input id="save-prompt-username" readOnly value={pending.username} />
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
