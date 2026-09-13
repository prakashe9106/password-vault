import { useSyncExternalStore } from "react";

/**
 * Thin wrapper around Google Identity Services' client-side OAuth token flow. Deliberately
 * no backend involvement (see docs/google-drive-setup.md and the Phase 2 plan): access tokens
 * live only in memory here, are never persisted, and expire in ~1 hour.
 */

const SCOPES = [
  "https://www.googleapis.com/auth/drive.file",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
].join(" ");

const GIS_SCRIPT_SRC = "https://accounts.google.com/gsi/client";

interface TokenResponse {
  access_token?: string;
  error?: string;
  error_description?: string;
}

interface TokenClientOverrides {
  prompt?: string;
  callback?: (response: TokenResponse) => void;
  error_callback?: (error: { type: string }) => void;
}

interface TokenClient {
  requestAccessToken: (overrides?: TokenClientOverrides) => void;
}

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (response: TokenResponse) => void;
            error_callback?: (error: { type: string }) => void;
          }) => TokenClient;
          revoke: (accessToken: string, done: () => void) => void;
        };
      };
    };
  }
}

export interface GoogleProfile {
  email: string;
  name: string;
}

export type AuthStatus = "signed-out" | "authorizing" | "authorized" | "error";

interface AuthState {
  status: AuthStatus;
  accessToken: string | null;
  profile: GoogleProfile | null;
  error: string | null;
}

let state: AuthState = { status: "signed-out", accessToken: null, profile: null, error: null };
const listeners = new Set<() => void>();

function setState(patch: Partial<AuthState>): void {
  state = { ...state, ...patch };
  for (const l of listeners) l();
}

export function useAuthState(): AuthState {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => state,
  );
}

export function isGoogleDriveConfigured(): boolean {
  return Boolean(import.meta.env.VITE_GOOGLE_CLIENT_ID);
}

let scriptLoadPromise: Promise<void> | null = null;

function loadGisScript(): Promise<void> {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  if (!scriptLoadPromise) {
    scriptLoadPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = GIS_SCRIPT_SRC;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Failed to load Google Identity Services script."));
      document.head.appendChild(script);
    });
  }
  return scriptLoadPromise;
}

let tokenClient: TokenClient | null = null;

async function getTokenClient(): Promise<TokenClient> {
  await loadGisScript();
  if (!tokenClient) {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    tokenClient = window.google!.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: SCOPES,
      callback: () => {
        // Overridden per-call in requestToken() below.
      },
    });
  }
  return tokenClient;
}

// Start loading the GIS script and creating the token client as soon as this module is
// imported (well before any click), so that by the time the user actually clicks "Sign in",
// getTokenClient() resolves from cache instead of awaiting a real network fetch. Awaiting a
// fetch inside a click handler consumes the click's "user activation" on strict mobile
// browsers, which silently blocks or breaks the popup this flow depends on — this is why the
// same "stuck on Connecting..." symptom showed up on a personal phone over cellular data too,
// not just the corporate network.
if (isGoogleDriveConfigured()) {
  void getTokenClient().catch(() => {
    // Ignore — a real failure here just means the first actual sign-in click will retry it
    // and surface the error through requestAccessToken()'s normal error handling.
  });
}

async function fetchProfile(accessToken: string): Promise<GoogleProfile> {
  const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error("Failed to fetch Google profile.");
  const data = (await res.json()) as { email?: string; name?: string };
  return { email: data.email ?? "", name: data.name ?? "" };
}

/**
 * Requests a Drive access token. `interactive: false` attempts a silent (no-popup) grant, which
 * only succeeds if the user already authorized this app in this browser/session recently.
 */
export async function requestAccessToken(interactive: boolean): Promise<string> {
  setState({ status: "authorizing", error: null });
  const client = await getTokenClient();

  return new Promise((resolve, reject) => {
    client.requestAccessToken({
      prompt: interactive ? "consent" : "",
      callback: async (response: TokenResponse) => {
        if (!response.access_token) {
          const message = response.error_description ?? response.error ?? "Authorization failed.";
          setState({ status: "error", error: message });
          reject(new Error(message));
          return;
        }
        try {
          const profile = await fetchProfile(response.access_token);
          setState({ status: "authorized", accessToken: response.access_token, profile, error: null });
          resolve(response.access_token);
        } catch (err) {
          const message = err instanceof Error ? err.message : "Failed to load profile.";
          setState({ status: "error", error: message });
          reject(err);
        }
      },
      error_callback: (error: { type: string }) => {
        setState({ status: "error", error: error.type });
        reject(new Error(error.type));
      },
    });
  });
}

export function signOut(): void {
  const token = state.accessToken;
  setState({ status: "signed-out", accessToken: null, profile: null, error: null });
  if (token && window.google?.accounts?.oauth2) {
    window.google.accounts.oauth2.revoke(token, () => {});
  }
}
