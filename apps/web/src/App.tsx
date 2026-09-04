import { useEffect, useState } from "react";
import { isDriveConfigured, signOut } from "./lib/googleAuth";
import { lockSession } from "./state/sessionStore";
import { migrateLocalVaultToDrive, resolveDriveState, retryPendingUploads } from "./state/syncStore";
import DriveNotConfiguredScreen from "./screens/DriveNotConfiguredScreen";
import ConnectDriveScreen from "./screens/ConnectDriveScreen";
import MigrateVaultChoiceScreen from "./screens/MigrateVaultChoiceScreen";
import CreateVaultScreen from "./screens/CreateVaultScreen";
import UnlockVaultScreen from "./screens/UnlockVaultScreen";
import RecoveryKeyDisplayScreen from "./screens/RecoveryKeyDisplayScreen";
import VaultHomeShell from "./screens/VaultHomeShell";

type Phase =
  | "not-configured"
  | "connect-drive"
  | "resolving"
  | "migrate-choice"
  | "create"
  | "unlock"
  | "recovery-display"
  | "app";

interface VaultMeta {
  vaultId: string;
  vaultName: string;
}

export default function App() {
  const [phase, setPhase] = useState<Phase>(isDriveConfigured() ? "connect-drive" : "not-configured");
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [vaultMeta, setVaultMeta] = useState<VaultMeta | null>(null);
  const [pendingRecoveryCode, setPendingRecoveryCode] = useState<string | null>(null);
  const [resolveError, setResolveError] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken) return;
    const retry = () => retryPendingUploads(accessToken);
    window.addEventListener("online", retry);
    return () => window.removeEventListener("online", retry);
  }, [accessToken]);

  async function handleConnected(token: string) {
    setAccessToken(token);
    setPhase("resolving");
    setResolveError(null);
    try {
      const result = await resolveDriveState(token);
      if (result.kind === "remote-found") {
        setVaultMeta({ vaultId: result.vaultId, vaultName: result.vaultName });
        setPhase("unlock");
      } else if (result.kind === "local-orphan") {
        setVaultMeta({ vaultId: result.vaultId, vaultName: result.vaultName });
        setPhase("migrate-choice");
      } else {
        setPhase("create");
      }
    } catch (err) {
      setResolveError(err instanceof Error ? err.message : "Failed to check Google Drive.");
      setPhase("connect-drive");
    }
  }

  if (phase === "not-configured") {
    return <DriveNotConfiguredScreen />;
  }

  if (phase === "connect-drive") {
    return (
      <>
        {resolveError && (
          <div className="centered-screen" style={{ position: "absolute", top: 0, width: "100%" }}>
            <p className="error-text">{resolveError}</p>
          </div>
        )}
        <ConnectDriveScreen onConnected={handleConnected} />
      </>
    );
  }

  if (phase === "resolving") {
    return <div className="centered-screen">Checking Google Drive…</div>;
  }

  if (phase === "migrate-choice" && vaultMeta && accessToken) {
    return (
      <MigrateVaultChoiceScreen
        vaultName={vaultMeta.vaultName}
        onUploadExisting={async () => {
          await migrateLocalVaultToDrive(accessToken, vaultMeta.vaultId);
          setPhase("unlock");
        }}
        onStartFresh={() => {
          setVaultMeta(null);
          setPhase("create");
        }}
      />
    );
  }

  if (phase === "create" && accessToken) {
    return (
      <CreateVaultScreen
        accessToken={accessToken}
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
    return (
      <VaultHomeShell
        onLocked={() => setPhase("unlock")}
        onDisconnectDrive={() => {
          lockSession();
          signOut();
          setAccessToken(null);
          setVaultMeta(null);
          setPhase("connect-drive");
        }}
      />
    );
  }

  return null;
}
