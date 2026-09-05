# Google Drive setup for the mobile app (Android)

This is the mobile analog of `docs/google-drive-setup.md`. The mobile app needs a different OAuth
Client ID *type* than the web app — an "Android" client, not a "Web application" one — because it
authenticates via a native authorization-code+PKCE flow (`expo-auth-session`) instead of a
browser-only token popup. Reusing the web Client ID will not work.

1. In the same (or a new) [Google Cloud Console](https://console.cloud.google.com/) project as the
   web app's setup, go to **APIs & Services → Credentials → Create Credentials → OAuth client ID**.
2. **Application type: Android.**
3. **Package name**: `com.privacyfirstvault.mobile` (matches `apps/mobile/app.json`'s
   `expo.android.package` — change both together if you rename it).
4. **SHA-1 certificate fingerprint**: this is the part that needs real Android tooling (or an Expo
   account) to obtain, since it's derived from whatever key eventually signs the built APK:
   - If you're using **EAS Build** (Expo's cloud build service — the practical path here, since
     there's no local Android SDK to build with): run `eas credentials` once for the `android`
     platform. EAS can generate and manage a signing keystore for you and will show you its SHA-1.
   - If you have a local Android SDK and are building with a debug keystore during development,
     `keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebug -storepass android -keypass android`
     prints it (Android's default debug keystore, standard password).
5. Copy the generated **Client ID** (a `....apps.googleusercontent.com` value — a different one
   than the web Client ID, even though it may share a Cloud project).
6. In `apps/mobile/`, copy `.env.example` to `.env` and paste it:
   ```
   EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=....apps.googleusercontent.com
   ```
7. Rebuild/restart the Metro bundler so the env var is picked up (Expo's `EXPO_PUBLIC_` prefix is
   inlined at bundle time, the same mechanism as the web app's `VITE_` prefix).

Until this is done, the app shows a "Google Drive isn't configured yet" screen instead of a
sign-in button. No client secret is involved — this is a public-client PKCE flow.

**This entire flow is unverified** — no Client ID has ever been created against it, and no
authorization round-trip has completed. See `apps/mobile/README.md` for the full list of
unverified assumptions in this phase.
