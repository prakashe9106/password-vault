import { useSyncExternalStore } from "react";
import { PublicClientApplication, type AccountInfo } from "@azure/msal-browser";

/**
 * Mirrors googleAuth.ts's shape, but Microsoft's client-side flow needs authorization-code+PKCE
 * (unlike Google's simpler implicit-style token popup), so this uses MSAL — the same
 * "use an established library rather than hand-roll a security protocol" stance already applied
 * to vault-core's crypto. Access tokens live only in memory here, same as googleAuth.ts.
 */

const SCOPES = ["Files.ReadWrite.AppFolder", "User.Read"];

export interface OneDriveProfile {
  email: string;
  name: string;
}

export type AuthStatus = "signed-out" | "authorizing" | "authorized" | "error";

interface AuthState {
  status: AuthStatus;
  accessToken: string | null;
  profile: OneDriveProfile | null;
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

export function isOneDriveConfigured(): boolean {
  return Boolean(import.meta.env.VITE_ONEDRIVE_CLIENT_ID);
}

let pcaPromise: Promise<PublicClientApplication> | null = null;

function getPca(): Promise<PublicClientApplication> {
  if (!pcaPromise) {
    const pca = new PublicClientApplication({
      auth: {
        clientId: import.meta.env.VITE_ONEDRIVE_CLIENT_ID,
        // Personal Microsoft accounts only — this product targets personal vaults, not org
        // tenants (the same reason sharing/business admin are deferred to a later phase).
        authority: "https://login.microsoftonline.com/consumers",
        redirectUri: window.location.origin,
      },
    });
    pcaPromise = pca.initialize().then(() => pca);
  }
  return pcaPromise;
}

async function fetchProfile(accessToken: string): Promise<OneDriveProfile> {
  const res = await fetch("https://graph.microsoft.com/v1.0/me", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error("Failed to fetch Microsoft profile.");
  const data = (await res.json()) as { mail?: string; userPrincipalName?: string; displayName?: string };
  return { email: data.mail ?? data.userPrincipalName ?? "", name: data.displayName ?? "" };
}

let activeAccount: AccountInfo | null = null;

/**
 * Requests a OneDrive access token. `interactive: false` attempts a silent token acquisition,
 * which only succeeds if the user already has an active MSAL session in this browser.
 */
export async function requestAccessToken(interactive: boolean): Promise<string> {
  setState({ status: "authorizing", error: null });
  try {
    const pca = await getPca();
    const result = interactive
      ? await pca.loginPopup({ scopes: SCOPES })
      : await pca.acquireTokenSilent({ scopes: SCOPES, account: activeAccount ?? undefined });
    activeAccount = result.account;
    const profile = await fetchProfile(result.accessToken);
    setState({ status: "authorized", accessToken: result.accessToken, profile, error: null });
    return result.accessToken;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Authorization failed.";
    setState({ status: "error", error: message });
    throw err instanceof Error ? err : new Error(message);
  }
}

export async function signOut(): Promise<void> {
  const account = activeAccount;
  setState({ status: "signed-out", accessToken: null, profile: null, error: null });
  activeAccount = null;
  if (account) {
    const pca = await getPca();
    await pca.logoutPopup({ account }).catch(() => {});
  }
}
