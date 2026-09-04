import { useEffect, useState } from "react";
import { sendToBackground } from "../lib/messaging";
import type { PendingSave } from "../lib/storage";
import UnlockOrCreateScreen from "./screens/UnlockOrCreateScreen";
import VaultHomeScreen from "./screens/VaultHomeScreen";
import SavePromptScreen from "./screens/SavePromptScreen";

type Phase = "loading" | "locked" | "unlocked";

export default function Popup() {
  const [phase, setPhase] = useState<Phase>("loading");
  const [vaultExists, setVaultExists] = useState(false);
  const [pendingSave, setPendingSave] = useState<PendingSave | null>(null);

  async function refresh() {
    const lockState = await sendToBackground<{ locked: boolean; vaultExists: boolean }>({ type: "GET_LOCK_STATE" });
    setVaultExists(lockState.vaultExists);

    if (lockState.locked) {
      setPhase("locked");
      return;
    }

    const pendingResult = await sendToBackground<{ pending: PendingSave | null }>({ type: "GET_PENDING_SAVE" });
    setPendingSave(pendingResult.pending);
    setPhase("unlocked");
  }

  useEffect(() => {
    refresh();
  }, []);

  if (phase === "loading") {
    return <div className="screen">Loading…</div>;
  }

  if (phase === "locked") {
    return <UnlockOrCreateScreen vaultExists={vaultExists} onReady={refresh} />;
  }

  if (pendingSave) {
    return (
      <SavePromptScreen
        pending={pendingSave}
        onResolved={() => {
          setPendingSave(null);
          refresh();
        }}
      />
    );
  }

  return <VaultHomeScreen onLocked={refresh} />;
}
