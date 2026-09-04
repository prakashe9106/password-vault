/**
 * Pure DOM heuristics — no chrome.* APIs here, so this is directly unit-testable with jsdom
 * fixtures. Reads only input element types/names/ids/autocomplete attributes (PRD §7.5: "Avoid
 * collecting page contents unrelated to login detection").
 */

export interface DetectedLoginForm {
  formEl: HTMLFormElement | null;
  passwordInput: HTMLInputElement;
  usernameInput: HTMLInputElement | null;
}

const USERNAME_HINTS = ["user", "email", "login", "identifier", "account"];
// Signals a signup/change-password field rather than a "current password" login field.
const NEW_PASSWORD_HINTS = ["new-password", "newpassword", "confirm", "retype", "verify"];

export function findLoginForm(doc: Document): DetectedLoginForm | null {
  const passwordInputs = Array.from(doc.querySelectorAll<HTMLInputElement>('input[type="password"]')).filter(isVisible);
  if (passwordInputs.length === 0) return null;

  // Multiple password fields usually means signup/change-password (new + confirm) rather than a
  // login form — prefer one that doesn't look like a "new password" field.
  const candidates =
    passwordInputs.length === 1 ? passwordInputs : passwordInputs.filter((input) => !looksLikeNewPassword(input));
  const passwordInput = candidates[0] ?? passwordInputs[0]!;

  const formEl = passwordInput.closest("form");
  const usernameInput = findUsernameInput(passwordInput, formEl);

  return { formEl, passwordInput, usernameInput };
}

function looksLikeNewPassword(input: HTMLInputElement): boolean {
  if (input.autocomplete === "new-password") return true;
  const signal = `${input.autocomplete} ${input.name} ${input.id}`.toLowerCase();
  return NEW_PASSWORD_HINTS.some((hint) => signal.includes(hint));
}

function findUsernameInput(passwordInput: HTMLInputElement, formEl: HTMLFormElement | null): HTMLInputElement | null {
  const scope: ParentNode = formEl ?? passwordInput.ownerDocument;
  const relevantInputs = Array.from(scope.querySelectorAll<HTMLInputElement>("input")).filter(
    (input) => (input.type === "text" || input.type === "email") && isVisible(input),
  );

  const strongMatch = relevantInputs.find((input) => {
    if (input.autocomplete === "username") return true;
    const signal = `${input.autocomplete} ${input.name} ${input.id}`.toLowerCase();
    return USERNAME_HINTS.some((hint) => signal.includes(hint));
  });
  if (strongMatch) return strongMatch;

  // Fall back to the nearest preceding text/email input in document order.
  const allInputs = Array.from(scope.querySelectorAll<HTMLInputElement>("input")).filter(isVisible);
  const passwordIndex = allInputs.indexOf(passwordInput);
  for (let i = passwordIndex - 1; i >= 0; i--) {
    const candidate = allInputs[i]!;
    if (candidate.type === "text" || candidate.type === "email") return candidate;
  }
  return null;
}

/**
 * Avoids offsetParent/getClientRects (layout-dependent, unavailable in jsdom and unreliable for
 * position:fixed elements) in favor of computed display/visibility, which jsdom supports without
 * a real layout engine.
 */
function isVisible(el: HTMLElement): boolean {
  if (el.hidden) return false;
  const style = el.ownerDocument.defaultView?.getComputedStyle(el);
  if (style && (style.display === "none" || style.visibility === "hidden")) return false;
  return true;
}

export function fillLoginForm(detected: DetectedLoginForm, username: string, password: string): void {
  if (detected.usernameInput) setNativeValue(detected.usernameInput, username);
  setNativeValue(detected.passwordInput, password);
}

/** Sets the value via the native setter so frameworks (React etc.) observe the change. */
function setNativeValue(input: HTMLInputElement, value: string): void {
  const descriptor = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value");
  descriptor?.set?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}
