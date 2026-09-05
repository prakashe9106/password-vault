import { useState } from "react";
import { Modal, View } from "react-native";
import AppButton from "../components/AppButton";
import CenteredCard from "../components/CenteredCard";
import { ErrorText, Heading, Hint } from "../components/Typography";

interface Props {
  onKeepMine: () => Promise<void>;
  onUseTheirs: () => Promise<void>;
}

/** Mirrors apps/web/src/screens/ConflictResolutionScreen.tsx — no field-level merge, by design. */
export default function ConflictResolutionScreen({ onKeepMine, onUseTheirs }: Props) {
  const [busy, setBusy] = useState<"mine" | "theirs" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handle(choice: "mine" | "theirs", action: () => Promise<void>) {
    setBusy(choice);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to resolve conflict.");
      setBusy(null);
    }
  }

  return (
    <Modal animationType="fade" transparent onRequestClose={() => {}}>
      <CenteredCard>
        <Heading>This vault changed on another device</Heading>
        <Hint>
          Your vault was updated somewhere else since this device last synced. Choose which
          version to keep — this can't automatically merge changes from both.
        </Hint>
        {error && <ErrorText>{error}</ErrorText>}
        <View style={{ gap: 10 }}>
          <AppButton title="Keep my changes" onPress={() => handle("mine", onKeepMine)} busy={busy === "mine"} disabled={busy !== null} />
          <AppButton
            title="Use the other device's version"
            variant="secondary"
            onPress={() => handle("theirs", onUseTheirs)}
            busy={busy === "theirs"}
            disabled={busy !== null}
          />
        </View>
      </CenteredCard>
    </Modal>
  );
}
