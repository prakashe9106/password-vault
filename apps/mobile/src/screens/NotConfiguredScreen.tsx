import CenteredCard from "../components/CenteredCard";
import { Heading, Hint } from "../components/Typography";

export default function NotConfiguredScreen() {
  return (
    <CenteredCard>
      <Heading>Google Drive isn't configured yet</Heading>
      <Hint>
        This app stores your encrypted vault in your own Google Drive, which requires an Android
        OAuth Client ID that only a developer building this app can set up. See
        docs/google-drive-mobile-setup.md in the repo, put the Client ID in an EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID
        environment variable, then rebuild.
      </Hint>
    </CenteredCard>
  );
}
