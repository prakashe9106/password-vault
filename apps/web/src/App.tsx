import { useEffect, useState } from "react";
import { listVaultIndex } from "./storage/indexedDbAdapter";
import CreateVaultScreen from "./screens/CreateVaultScreen";
import UnlockVaultScreen from "./screens/UnlockVaultScreen";
import RecoveryKeyDisplayScreen from "./screens/RecoveryKeyDisplayScreen";
import VaultHomeShell from "./screens/VaultHomeShell";

type Phase = "loading" | "create" | "unlock" | "recovery-display" | "app";

interface VaultMeta {
  vaultId: string;
  vaultName: string;
}

export default function App() {
  const [phase, setPhase] = useState<Phase>("loading");
  const [vaultMeta, setVaultMeta] = useState<VaultMeta | null>(null);
  const [pendingRecoveryCode, setPendingRecoveryCode] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listVaultIndex().then((entries) => {
      if (cancelled) return;
      if (entries.length === 0) {
        setPhase("create");
      } else {
        const entry = entries[0]!;
        setVaultMeta({ vaultId: entry.vault_id, vaultName: entry.name });
        setPhase("unlock");
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (phase === "loading") {
    return <div className="centered-screen">Loading…</div>;
  }

  if (phase === "create") {
    return (
      <CreateVaultScreen
        onCreated={(vaultId, vaultName, recoveryCode) => {
          setVaultMeta({ vaultId, vaultName });
          setPendingRecoveryCode(recoveryCode);
          setPhase("recovery-display");
        }}
      />
    );
  }

  if (phase === "recovery-display" && pendingRecoveryCode) {
    return <RecoveryKeyDisplayScreen recoveryCode={pendingRecoveryCode} onAcknowledged={() => setPhase("app")} />;
  }

  if (phase === "unlock" && vaultMeta) {
    return (
      <UnlockVaultScreen vaultId={vaultMeta.vaultId} vaultName={vaultMeta.vaultName} onUnlocked={() => setPhase("app")} />
    );
  }

  if (phase === "app") {
    return <VaultHomeShell onLocked={() => setPhase("unlock")} />;
  }

  return null;
}
