import { findLoginForm, fillLoginForm, type DetectedLoginForm } from "./formDetector";
import type { BackgroundToContentMessage, ContentToBackgroundMessage } from "../lib/messaging";

let cachedDetection: DetectedLoginForm | null = findLoginForm(document);

function redetect(): void {
  cachedDetection = findLoginForm(document);
}

// Re-scan on DOM changes for SPA-rendered forms (login forms that appear after initial load).
const observer = new MutationObserver(() => redetect());
observer.observe(document.documentElement, { childList: true, subtree: true });

// Capture phase, before the page's own handler can prevent/redirect — see Phase 3 plan: a
// JS-driven SPA submission with no native `submit` event is an explicit known gap for now.
document.addEventListener(
  "submit",
  (event) => {
    const form = event.target as HTMLFormElement;
    const passwordInput = form.querySelector<HTMLInputElement>('input[type="password"]');
    if (!passwordInput?.value) return;

    const usernameInput = cachedDetection?.passwordInput === passwordInput ? cachedDetection.usernameInput : null;
    const message: ContentToBackgroundMessage = {
      type: "LOGIN_SUBMITTED",
      origin: location.origin,
      username: usernameInput?.value ?? "",
      password: passwordInput.value,
    };
    chrome.runtime.sendMessage(message).catch(() => {
      // Background may be waking up momentarily — not worth surfacing to the user.
    });
  },
  true,
);

chrome.runtime.onMessage.addListener((message: BackgroundToContentMessage, _sender, sendResponse) => {
  if (message.type === "PING_FORM_PRESENCE") {
    sendResponse({ present: cachedDetection !== null });
    return true;
  }
  if (message.type === "PERFORM_FILL") {
    if (!cachedDetection) {
      sendResponse({ filled: false });
      return true;
    }
    fillLoginForm(cachedDetection, message.username, message.password);
    sendResponse({ filled: true });
    return true;
  }
  return false;
});
