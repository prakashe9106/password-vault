import { useEffect, useState } from "react";
import {
  handleRedirectCallback,
  isGoogleDriveConfigured,
  isGoogleRedirectCallback,
  signOut as googleSignOut,
} from "./lib/googleAuth";
import { isOneDriveConfigured, signOut as oneDriveSignOut } from "./lib/oneDriveAuth";
import { PROVIDER_LABELS, type StorageProvider } from "./lib/storageProvider";
import { lockSession } from "./state/sessionStore";
import { migrateLocalVaultToRemote, resolveRemoteState, retryPendingUploads } from "./state/syncStore";
import StorageNotConfiguredScreen from "./screens/StorageNotConfiguredScreen";
import ConnectStorageScreen from "./screens/ConnectStorageScreen";
import MigrateVaultChoiceScreen from "./screens/MigrateVaultChoiceScreen";
import CreateVaultScreen from "./screens/CreateVaultScreen";
import UnlockVaultScreen from "./screens/UnlockVaultScreen";
import RecoveryKeyDisplayScreen from "./screens/RecoveryKeyDisplayScreen";
import VaultHomeShell from "./screens/VaultHomeShell";

type Phase =
  | "not-configured"
  | "connect-storage"
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

function isAnyStorageConfigured(): boolean {
  return isGoogleDriveConfigured() || isOneDriveConfigured();
}

export default function App() {
  const [phase, setPhase] = useState<Phase>(() => {
    if (isGoogleRedirectCallback()) return "resolving";
    return isAnyStorageConfigured() ? "connect-storage" : "not-configured";
  });
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [connectedProvider, setConnectedProvider] = useState<StorageProvider | null>(null);
  const [vaultMeta, setVaultMeta] = useState<VaultMeta | null>(null);
  const [pendingRecoveryCode, setPendingRecoveryCode] = useState<string | null>(null);
  const [resolveError, setResolveError] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken || !connectedProvider) return;
    const retry = () => retryPendingUploads(connectedProvider, accessToken);
    window.addEventListener("online", retry);
    return () => window.removeEventListener("online", retry);
  }, [accessToken, connectedProvider]);

  useEffect(() => {
    if (!isGoogleRedirectCallback()) return;
    handleRedirectCallback()
      .then((result) => {
        if (result) void handleConnected(result.accessToken, "google-drive");
      })
      .catch((err) => {
        setResolveError(err instanceof Error ? err.message : "Google sign-in failed.");
        setPhase("connect-storage");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleConnected(token: string, provider: StorageProvider) {
    setAccessToken(token);
    setConnectedProvider(provider);
    setPhase("resolving");
    setResolveError(null);
    try {
      const result = await resolveRemoteState(provider, token);
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
      setResolveError(err instanceof Error ? err.message : `Failed to check ${PROVIDER_LABELS[provider]}.`);
      setPhase("connect-storage");
    }
  }

  if (phase === "not-configured") {
    return <StorageNotConfiguredScreen />;
  }

  if (phase === "connect-storage") {
    return (
      <>
        {resolveError && (
          <div className="centered-screen" style={{ position: "absolute", top: 0, width: "100%" }}>
            <p className="error-text" role="alert">
              {resolveError}
            </p>
          </div>
        )}
        <ConnectStorageScreen onConnected={handleConnected} />
      </>
    );
  }

  if (phase === "resolving") {
    return <div className="centered-screen">Checking {connectedProvider ? PROVIDER_LABELS[connectedProvider] : "cloud storage"}…</div>;
  }

  if (phase === "migrate-choice" && vaultMeta && accessToken && connectedProvider) {
    return (
      <MigrateVaultChoiceScreen
        vaultName={vaultMeta.vaultName}
        providerLabel={PROVIDER_LABELS[connectedProvider]}
        onUploadExisting={async () => {
          await migrateLocalVaultToRemote(connectedProvider, accessToken, vaultMeta.vaultId);
          setPhase("unlock");
        }}
        onStartFresh={() => {
          setVaultMeta(null);
          setPhase("create");
        }}
      />
    );
  }

  if (phase === "create" && accessToken && connectedProvider) {
    return (
      <CreateVaultScreen
        accessToken={accessToken}
        provider={connectedProvider}
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

  if (phase === "app" && connectedProvider) {
    return (
      <VaultHomeShell
        connectedProvider={connectedProvider}
        onLocked={() => setPhase("unlock")}
        onDisconnectStorage={() => {
          lockSession();
          if (connectedProvider === "google-drive") googleSignOut();
          else void oneDriveSignOut();
          setAccessToken(null);
          setConnectedProvider(null);
          setVaultMeta(null);
          setPhase("connect-storage");
        }}
      />
    );
  }

  return null;
}
