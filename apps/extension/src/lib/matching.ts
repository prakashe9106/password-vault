import type { Login } from "@vault/core";

/**
 * Exact-origin matching only (PRD §7.3: "Prefer exact origin/domain matches," "do not
 * automatically fill credentials into an unrelated domain"). A saved login's `url` is parsed and
 * compared by origin (protocol + hostname + port) against the page's origin — no subdomain
 * matching, no fuzzy/lookalike-domain matching. This is deliberately conservative: a punycode or
 * visually-similar phishing domain simply won't have a stored match, which is the safe default.
 */
export function matchLoginsForOrigin(logins: readonly Login[], pageOrigin: string): Login[] {
  return logins.filter((login) => originOf(login.url) === pageOrigin);
}

function originOf(url: string): string | null {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}
