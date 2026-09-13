import { changeMasterPassword, type UnlockedVault } from "@vault/core";
import type {
  ActiveTabInfo,
  BackgroundResult,
  ContentToBackgroundMessage,
  FillResponse,
  FormPresenceResponse,
  PopupToBackgroundMessage,
} from "../lib/messaging";
import { sendToContentScript } from "../lib/messaging";
import { clearPendingSave, getPendingSave, setPendingSave } from "../lib/storage";
import { matchLoginsForOrigin } from "../lib/matching";
import {
  createNewVault,
  hasStoredVault,
  lockVault,
  persistLiveVault,
  rehydrateFromSession,
  unlockWithPassword,
  unlockWithRecoveryCode,
} from "./vaultSession";

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (sender.tab) {
    handleContentMessage(message as ContentToBackgroundMessage).then(sendResponse);
  } else {
    handlePopupMessage(message as PopupToBackgroundMessage)
      .then(sendResponse)
      .catch((err) => sendResponse({ ok: false, error: messageOf(err) }));
  }
  return true; // keep the channel open for the async sendResponse above
});

function requireLive(vault: UnlockedVault | null): UnlockedVault {
  if (!vault) throw new Error("Vault is locked.");
  return vault;
}

function messageOf(err: unknown): string {
  return err instanceof Error ? err.message : "Unexpected error.";
}

async function handlePopupMessage(message: PopupToBackgroundMessage): Promise<unknown> {
  switch (message.type) {
    case "GET_LOCK_STATE": {
      const vault = await rehydrateFromSession();
      return { locked: vault === null, vaultExists: await hasStoredVault() };
    }

    case "CREATE_VAULT": {
      try {
        const recoveryCode = await createNewVault(message.masterPassword, message.vaultName);
        return { ok: true, recoveryCode };
      } catch (err) {
        return { ok: false, error: messageOf(err) };
      }
    }

    case "UNLOCK": {
      try {
        await unlockWithPassword(message.masterPassword);
        return { ok: true };
      } catch {
        return { ok: false, error: "Incorrect master password." };
      }
    }

    case "UNLOCK_WITH_RECOVERY": {
      try {
        await unlockWithRecoveryCode(message.recoveryCode);
        return { ok: true };
      } catch {
        return { ok: false, error: "Invalid recovery code." };
      }
    }

    case "LOCK": {
      await lockVault();
      return { ok: true };
    }

    case "GET_VAULT_DATA": {
      const vault = await rehydrateFromSession();
      if (!vault) return { ok: false, error: "locked" };
      return { ok: true, logins: vault.logins, folders: vault.folders, settings: vault.settings };
    }

    case "ADD_LOGIN": {
      const vault = requireLive(await rehydrateFromSession());
      const login = vault.addLogin(message.input);
      await persistLiveVault();
      return { ok: true, login };
    }

    case "UPDATE_LOGIN": {
      const vault = requireLive(await rehydrateFromSession());
      const login = vault.updateLogin(message.id, message.patch);
      await persistLiveVault();
      return { ok: true, login };
    }

    case "DELETE_LOGIN": {
      const vault = requireLive(await rehydrateFromSession());
      vault.deleteLogin(message.id);
      await persistLiveVault();
      return { ok: true };
    }

    case "UPDATE_SETTINGS": {
      const vault = requireLive(await rehydrateFromSession());
      vault.updateSettings(message.patch);
      await persistLiveVault();
      return { ok: true };
    }

    case "CHANGE_MASTER_PASSWORD": {
      const vault = requireLive(await rehydrateFromSession());
      changeMasterPassword(vault, message.newPassword);
      await persistLiveVault();
      return { ok: true };
    }

    case "GET_PENDING_SAVE": {
      return { pending: await getPendingSave() };
    }

    case "CONFIRM_PENDING_SAVE": {
      const pending = await getPendingSave();
      if (!pending) return { ok: false, error: "No pending save." };
      const vault = requireLive(await rehydrateFromSession());
      vault.addLogin({
        title: pending.origin,
        url: pending.origin,
        username: pending.username,
        password: pending.password,
        notes: "",
        folder_id: message.folderId,
        category: "login",
        custom_fields: [],
      });
      await persistLiveVault();
      await clearPendingSave();
      await chrome.action.setBadgeText({ text: "" });
      return { ok: true };
    }

    case "DISMISS_PENDING_SAVE": {
      await clearPendingSave();
      await chrome.action.setBadgeText({ text: "" });
      return { ok: true };
    }

    case "GET_ACTIVE_TAB_INFO":
      return getActiveTabInfo();

    case "FILL_REQUEST":
      return handleFillRequest(message.loginId);
  }
}

async function handleContentMessage(message: ContentToBackgroundMessage): Promise<{ ok: true }> {
  if (message.type === "LOGIN_SUBMITTED") {
    await maybeStagePendingSave(message.origin, message.username, message.password);
  }
  return { ok: true };
}

/** Skips staging a save if this exact origin+username+password is already saved. */
async function maybeStagePendingSave(origin: string, username: string, password: string): Promise<void> {
  if (!username || !password) return;

  const vault = await rehydrateFromSession();
  if (vault) {
    const existing = matchLoginsForOrigin(vault.logins, origin).find((l) => l.username === username);
    if (existing && existing.password === password) return;
  }

  await setPendingSave({ origin, username, password, capturedAt: Date.now() });
  await chrome.action.setBadgeText({ text: "1" });
  await chrome.action.setBadgeBackgroundColor({ color: "#5b8dff" });
}

async function getActiveTabInfo(): Promise<ActiveTabInfo> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !tab.url) return { tabId: null, origin: null, hasLoginForm: false };

  let origin: string | null;
  try {
    origin = new URL(tab.url).origin;
  } catch {
    origin = null;
  }

  let hasLoginForm = false;
  try {
    const response = await sendToContentScript<FormPresenceResponse>(tab.id, { type: "PING_FORM_PRESENCE" });
    hasLoginForm = response?.present ?? false;
  } catch {
    hasLoginForm = false; // no content script here (e.g. a chrome:// page)
  }

  return { tabId: tab.id, origin, hasLoginForm };
}

async function handleFillRequest(loginId: string): Promise<BackgroundResult<FillResponse>> {
  const vault = await rehydrateFromSession();
  if (!vault) return { ok: false, error: "Vault is locked." };

  const login = vault.logins.find((l) => l.id === loginId);
  if (!login) return { ok: false, error: "Login not found." };

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return { ok: false, error: "No active tab." };

  try {
    const response = await sendToContentScript<FillResponse>(tab.id, {
      type: "PERFORM_FILL",
      username: login.username,
      password: login.password,
    });
    return { ok: true, filled: response.filled };
  } catch {
    return { ok: false, error: "Could not fill this page." };
  }
}
