import { useEffect, useState } from "react";
import { StatusBar, StyleSheet, Text, View } from "react-native";
import { isGoogleDriveConfigured, signOut, type GoogleAuthResult, type GoogleProfile } from "./src/lib/googleAuth";
import { lockSession } from "./src/state/sessionStore";
import { migrateLocalVaultToDrive, resolveDriveState, retryPendingUploads } from "./src/state/syncStore";
import NotConfiguredScreen from "./src/screens/NotConfiguredScreen";
import ConnectDriveScreen from "./src/screens/ConnectDriveScreen";
import MigrateVaultChoiceScreen from "./src/screens/MigrateVaultChoiceScreen";
import CreateVaultScreen from "./src/screens/CreateVaultScreen";
import UnlockVaultScreen from "./src/screens/UnlockVaultScreen";
import RecoveryKeyDisplayScreen from "./src/screens/RecoveryKeyDisplayScreen";
import VaultHomeScreen from "./src/screens/VaultHomeScreen";
import { colors } from "./src/theme";

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
  const [phase, setPhase] = useState<Phase>(isGoogleDriveConfigured() ? "connect-drive" : "not-configured");
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [profile, setProfile] = useState<GoogleProfile | null>(null);
  const [vaultMeta, setVaultMeta] = useState<VaultMeta | null>(null);
  const [pendingRecoveryCode, setPendingRecoveryCode] = useState<string | null>(null);
  const [resolveError, setResolveError] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken) return;
    // No AppState "online" event on RN the way the web has `window.addEventListener("online")` —
    // a coarse app-foreground retry covers the common case (reopening the app after being
    // offline) without pulling in a network-status library for this phase.
    void retryPendingUploads(accessToken);
  }, [accessToken]);

  async function handleConnected(result: GoogleAuthResult) {
    setAccessToken(result.accessToken);
    setProfile(result.profile);
    setPhase("resolving");
    setResolveError(null);
    try {
      const outcome = await resolveDriveState(result.accessToken);
      if (outcome.kind === "remote-found") {
        setVaultMeta({ vaultId: outcome.vaultId, vaultName: outcome.vaultName });
        setPhase("unlock");
      } else if (outcome.kind === "local-orphan") {
        setVaultMeta({ vaultId: outcome.vaultId, vaultName: outcome.vaultName });
        setPhase("migrate-choice");
      } else {
        setPhase("create");
      }
    } catch (err) {
      setResolveError(err instanceof Error ? err.message : "Failed to check Google Drive.");
      setPhase("connect-drive");
    }
  }

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" />
      {renderPhase()}
    </View>
  );

  function renderPhase() {
    if (phase === "not-configured") {
      return <NotConfiguredScreen />;
    }

    if (phase === "connect-drive") {
      return (
        <>
          {resolveError && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorBannerText}>{resolveError}</Text>
            </View>
          )}
          <ConnectDriveScreen onConnected={handleConnected} />
        </>
      );
    }

    if (phase === "resolving") {
      return (
        <View style={styles.centered}>
          <Text style={styles.centeredText}>Checking Google Drive…</Text>
        </View>
      );
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
        <VaultHomeScreen
          accessToken={accessToken}
          driveEmail={profile?.email ?? null}
          onLocked={() => setPhase("unlock")}
          onDisconnectDrive={async () => {
            lockSession();
            await signOut();
            setAccessToken(null);
            setProfile(null);
            setVaultMeta(null);
            setPhase("connect-drive");
          }}
        />
      );
    }

    return null;
  }
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg },
  centeredText: { color: colors.text },
  errorBanner: { position: "absolute", top: 0, width: "100%", padding: 12, zIndex: 1 },
  errorBannerText: { color: colors.danger, textAlign: "center" },
});
