import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import * as SecureStore from "expo-secure-store";

/**
 * Google Drive OAuth for the mobile app. Unlike apps/web's googleAuth.ts (Google Identity
 * Services' browser-only popup token flow), a native app has to use authorization-code+PKCE via
 * expo-auth-session — which is redirect-based and only works from inside a mounted component
 * (it listens for the app resuming after the system browser closes). That's a real shape
 * difference from the web version, not just a port: the interactive "connect" step is a hook
 * (`useGoogleAuthRequest`, used from a screen's button handler), while the silent-refresh path
 * used by syncStore's background retry logic stays a plain async function, since refreshing a
 * token needs no browser or redirect at all.
 */

const SCOPES = ["https://www.googleapis.com/auth/drive.file", "email", "profile", "openid"];

const DISCOVERY: AuthSession.DiscoveryDocument = {
  authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
  tokenEndpoint: "https://oauth2.googleapis.com/token",
  revocationEndpoint: "https://oauth2.googleapis.com/revoke",
};

const REFRESH_TOKEN_KEY = "google_refresh_token";

export interface GoogleProfile {
  email: string;
  name: string;
}

function clientId(): string {
  return process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ?? "";
}

export function isGoogleDriveConfigured(): boolean {
  return Boolean(process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID);
}

WebBrowser.maybeCompleteAuthSession();

async function fetchProfile(accessToken: string): Promise<GoogleProfile> {
  const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error("Failed to fetch Google profile.");
  const data = (await res.json()) as { email?: string; name?: string };
  return { email: data.email ?? "", name: data.name ?? "" };
}

export interface GoogleAuthResult {
  accessToken: string;
  profile: GoogleProfile;
}

/** Use from a screen component. `connect()` opens the system browser and resolves on return. */
export function useGoogleAuthRequest() {
  const redirectUri = AuthSession.makeRedirectUri();
  const [request, , promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: clientId(),
      scopes: SCOPES,
      redirectUri,
      responseType: AuthSession.ResponseType.Code,
      usePKCE: true,
      extraParams: { access_type: "offline", prompt: "consent" },
    },
    DISCOVERY,
  );

  async function connect(): Promise<GoogleAuthResult> {
    const result = await promptAsync();
    if (result.type !== "success") {
      throw new Error(result.type === "error" ? (result.error?.message ?? "Authorization failed.") : "Sign-in cancelled.");
    }
    if (!result.params.code) {
      throw new Error("Google didn't return an authorization code.");
    }
    const tokenResult = await AuthSession.exchangeCodeAsync(
      {
        clientId: clientId(),
        code: result.params.code,
        redirectUri,
        extraParams: { code_verifier: request?.codeVerifier ?? "" },
      },
      DISCOVERY,
    );
    if (tokenResult.refreshToken) {
      await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, tokenResult.refreshToken);
    }
    const profile = await fetchProfile(tokenResult.accessToken);
    return { accessToken: tokenResult.accessToken, profile };
  }

  return { ready: request !== null, connect };
}

/** Silent refresh only — no browser, no redirect. Used by syncStore's background retry path. */
export async function requestAccessToken(_interactive: false): Promise<string> {
  const refreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
  if (!refreshToken) throw new Error("No stored Google session to refresh.");
  const result = await AuthSession.refreshAsync({ clientId: clientId(), refreshToken }, DISCOVERY);
  return result.accessToken;
}

export async function hasStoredSession(): Promise<boolean> {
  return (await SecureStore.getItemAsync(REFRESH_TOKEN_KEY)) !== null;
}

export async function signOut(): Promise<void> {
  await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
}
