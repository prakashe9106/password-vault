import type { Login, VaultSettings } from "@vault/core";
import type { PendingSave } from "./storage";

/** Everything the popup can ask the background service worker to do. */
export type PopupToBackgroundMessage =
  | { type: "GET_LOCK_STATE" }
  | { type: "CREATE_VAULT"; masterPassword: string; vaultName: string }
  | { type: "UNLOCK"; masterPassword: string }
  | { type: "UNLOCK_WITH_RECOVERY"; recoveryCode: string }
  | { type: "LOCK" }
  | { type: "GET_VAULT_DATA" }
  | { type: "ADD_LOGIN"; input: Omit<Login, "id" | "created_at" | "updated_at" | "history"> }
  | { type: "UPDATE_LOGIN"; id: string; patch: Partial<Omit<Login, "id" | "created_at" | "history">> }
  | { type: "DELETE_LOGIN"; id: string }
  | { type: "UPDATE_SETTINGS"; patch: Partial<VaultSettings> }
  | { type: "CHANGE_MASTER_PASSWORD"; newPassword: string }
  | { type: "GET_PENDING_SAVE" }
  | { type: "CONFIRM_PENDING_SAVE"; folderId: string | null }
  | { type: "DISMISS_PENDING_SAVE" }
  | { type: "GET_ACTIVE_TAB_INFO" }
  | { type: "FILL_REQUEST"; loginId: string };

/** Sent by the content script to the background service worker. */
export type ContentToBackgroundMessage = {
  type: "LOGIN_SUBMITTED";
  origin: string;
  username: string;
  password: string;
};

/** Sent by the background service worker to a specific tab's content script. */
export type BackgroundToContentMessage =
  | { type: "PING_FORM_PRESENCE" }
  | { type: "PERFORM_FILL"; username: string; password: string };

export type BackgroundResult<T = Record<string, never>> = ({ ok: true } & T) | { ok: false; error: string };

export interface ActiveTabInfo {
  tabId: number | null;
  origin: string | null;
  hasLoginForm: boolean;
}

export interface FormPresenceResponse {
  present: boolean;
}

export interface FillResponse {
  filled: boolean;
}

export interface PendingSaveResponse {
  pending: PendingSave | null;
}

export function sendToBackground<TResponse = unknown>(message: PopupToBackgroundMessage): Promise<TResponse> {
  return chrome.runtime.sendMessage(message);
}

export function sendToContentScript<TResponse = unknown>(
  tabId: number,
  message: BackgroundToContentMessage,
): Promise<TResponse> {
  return chrome.tabs.sendMessage(tabId, message);
}
