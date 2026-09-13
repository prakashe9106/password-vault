import { useSyncExternalStore } from "react";

/**
 * Google Drive auth via OAuth 2.0 Implicit Grant, using a full-page redirect — deliberately NOT
 * a popup (unreliable across every environment tested: corporate desktop, personal phone on
 * wifi, personal phone on cellular) and NOT Authorization Code + PKCE either, since Google's
 * "Web application" client type requires a client_secret for the code-exchange step even with
 * PKCE, which a pure static site with no backend can't keep. Implicit grant hands the access
 * token back directly in the redirect URL's fragment, with no exchange step and therefore no
 * secret needed — the right fit for this architecture. Tradeoff: no refresh token, so there's no
 * true silent renewal; requestAccessToken(false) just fails and lets the existing
 * offline-pending fallback in syncStore.ts handle it, the same path already used for other
 * sync failures.
 *
 * The access token lives only in memory here, same as before — never persisted.
 */

const SCOPES = [
  "https://www.googleapis.com/auth/drive.file",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
].join(" ");

const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const REVOKE_ENDPOINT = "https://oauth2.googleapis.com/revoke";
const STATE_KEY = "google_oauth_state";

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

function clientId(): string {
  return import.meta.env.VITE_GOOGLE_CLIENT_ID;
}

function redirectUri(): string {
  return window.location.origin;
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function randomState(): string {
  return base64UrlEncode(crypto.getRandomValues(new Uint8Array(16)));
}

async function fetchProfile(accessToken: string): Promise<GoogleProfile> {
  const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error("Failed to fetch Google profile.");
  const data = (await res.json()) as { email?: string; name?: string };
  return { email: data.email ?? "", name: data.name ?? "" };
}

function hashParams(): URLSearchParams {
  return new URLSearchParams(window.location.hash.replace(/^#/, ""));
}

/** True if the current URL is a Google redirect callback (success or error). */
export function isGoogleRedirectCallback(): boolean {
  const hash = hashParams();
  return hash.has("access_token") || hash.has("error") || new URLSearchParams(window.location.search).has("error");
}

/** Kicks off the redirect to Google's consent screen. Navigates away — does not return a token
 * directly; the result comes back via handleRedirectCallback() on the next page load. */
export function beginSignIn(): void {
  const oauthState = randomState();
  sessionStorage.setItem(STATE_KEY, oauthState);

  const params = new URLSearchParams({
    client_id: clientId(),
    redirect_uri: redirectUri(),
    response_type: "token",
    scope: SCOPES,
    include_granted_scopes: "true",
    state: oauthState,
  });
  window.location.href = `${AUTH_ENDPOINT}?${params.toString()}`;
}

export interface RedirectCallbackResult {
  accessToken: string;
}

/** Call once on app startup. Returns null if the current URL isn't a Google redirect callback. */
export async function handleRedirectCallback(): Promise<RedirectCallbackResult | null> {
  if (!isGoogleRedirectCallback()) return null;

  const hash = hashParams();
  const accessToken = hash.get("access_token");
  const returnedState = hash.get("state");
  const authError = hash.get("error") ?? new URLSearchParams(window.location.search).get("error");

  const expectedState = sessionStorage.getItem(STATE_KEY);
  sessionStorage.removeItem(STATE_KEY);
  const cleanUrl = () => window.history.replaceState({}, "", window.location.pathname);

  if (authError) {
    cleanUrl();
    const message = `Google sign-in failed: ${authError}`;
    setState({ status: "error", error: message });
    throw new Error(message);
  }

  cleanUrl();
  if (!accessToken || !expectedState || returnedState !== expectedState) {
    const message = "Google sign-in failed: the request could not be verified. Please try again.";
    setState({ status: "error", error: message });
    throw new Error(message);
  }

  setState({ status: "authorizing", error: null });
  const profile = await fetchProfile(accessToken);
  setState({ status: "authorized", accessToken, profile, error: null });
  return { accessToken };
}

/**
 * No refresh token exists with implicit grant, so there's no true silent renewal — this always
 * fails, and callers (syncStore's background retry on a 401) fall back to the existing
 * offline-pending queue, same as any other sync failure.
 */
export async function requestAccessToken(interactive: boolean): Promise<string> {
  if (interactive) {
    throw new Error("Interactive Google sign-in must go through beginSignIn(), not requestAccessToken().");
  }
  throw new Error("No stored Google session to silently refresh — sign in again.");
}

export function signOut(): void {
  const token = state.accessToken;
  setState({ status: "signed-out", accessToken: null, profile: null, error: null });
  if (token) {
    void fetch(`${REVOKE_ENDPOINT}?token=${encodeURIComponent(token)}`, { method: "POST" }).catch(() => {});
  }
}
