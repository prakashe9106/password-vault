# Threat Model

Status as of Phase 4 (Hardening). Formalizes the risk table in the PRD (§14) against what is
actually implemented in this codebase, and records what's deliberately deferred. Written to close
a gap against the PRD's own Phase 0 exit criteria ("Security-reviewed design + test vectors") —
the design was implemented but never written down as a standalone document until now.

Per §14.1 of the PRD: this document is descriptive, not a marketing claim. It does not assert the
product is "unhackable" or that operators can "never" access user data — only what the current
design does and does not protect against.

| Risk | Impact | Current mitigation | Residual / deferred |
|---|---|---|---|
| Backend compromise | Critical | No backend exists that ever receives vault contents. `apps/backend` is an unauthenticated health-check stub (`GET /health`) with no vault, auth, or storage endpoints — see [`apps/backend/src/server.ts`](../../apps/backend/src/server.ts). All vault reads/writes happen client-side against IndexedDB (web), `chrome.storage.local` (extension), or the user's own Google Drive. | If a real backend is added later (auth, billing), it must stay structurally unable to decrypt vault contents — no plaintext credential storage in backend database/logs/analytics, per PRD §11. |
| Malicious browser page | Critical | The extension's autofill only proposes credentials for an exact origin match (`new URL(url).origin`) — see [`apps/extension/src/lib/matching.ts`](../../apps/extension/src/lib/matching.ts). No subdomain or fuzzy matching. Filling always requires an explicit user click in the popup (`FILL_REQUEST`) — never automatic. Content script permissions are minimal (`storage`, `activeTab`; no `host_permissions`). | Content-script form detection (`formDetector.ts`) trusts the page DOM; a page could render a fake password field to bait a save-prompt, but it still can't read *existing* vault contents, since it never gets access to unfilled entries. |
| Malicious extension update | Critical | Extension is an unpublished dev build — no release pipeline exists yet. | Deferred until publishing: needs a signed, reviewed release process (Chrome Web Store review, or self-hosted signing) before wide distribution. |
| Lost master password | Critical | A recovery code is generated at vault creation and wraps the same Vault Master Key via an independent envelope (dual-envelope design, [`docs/spec/vault-protocol-v1.md`](../spec/vault-protocol-v1.md)). Both web and extension force an explicit "I've saved it somewhere safe" acknowledgment before continuing (`RecoveryKeyDisplayScreen.tsx`, extension's `UnlockOrCreateScreen.tsx`). A live, non-blocking strength meter (`estimatePasswordStrength`, [`packages/vault-core/src/passwordStrength.ts`](../../packages/vault-core/src/passwordStrength.ts)) discourages weak master passwords at creation and on change. | Losing both the master password and the recovery code is unrecoverable by design — there is intentionally no server-side backdoor. The strength meter is a heuristic hint, not a hard entropy gate. |
| Sync conflict | High | Drive sync compares the last-known `headRevisionId` before writing (check-then-act) and surfaces an explicit two-choice resolution screen (`ConflictResolutionScreen.tsx`) rather than silently overwriting. | This is check-then-act, not a true compare-and-swap — the Drive API v3 has no reliable conditional-update header. A race between the check and the write (two clients uploading within the same short window) is a known, accepted gap for this phase, documented in `docs/spec/vault-protocol-v1.md`. |
| Stolen device | High | Auto-lock after configurable inactivity (`auto_lock_minutes`, default set in `defaultVaultSettings()`); vault data at rest is always the encrypted container — IndexedDB and `chrome.storage.local` never hold plaintext. The extension's session cache (`chrome.storage.session`) is memory-only and cleared on browser close. | Relies on the OS user session already being protected (device lock screen, disk encryption) — this product does not add its own OS-level protection. |
| OAuth token compromise | High | Google OAuth uses the client-side GIS token flow with `drive.file` scope only (least privilege — the app can only see files it created) plus `userinfo.email`/`profile`. No refresh tokens are requested or stored; the access token lives only in memory for the session (`googleAuth.ts`). | A token stolen mid-session could read/write the vault's Drive file for its (short) lifetime. No mitigation beyond scope minimization and non-persistence — token revocation is via the user's own Google account settings. |
| Clipboard exposure | Medium | Copying a password auto-clears the clipboard after 20 seconds if it still holds the copied value (`LoginListItem.tsx`, `copyAndAutoClear`). | Best-effort: relies on `navigator.clipboard.readText()` being available; if the browser denies clipboard-read permission, the timed overwrite still fires but can't verify nothing else claimed the clipboard first. |
| Crypto implementation bug | Critical | Uses libsodium (audited, widely-deployed) exclusively — XChaCha20-Poly1305-IETF for AEAD, Argon2id for the KDF. No hand-rolled cryptographic primitives anywhere in `vault-core`. Golden test vectors (`packages/vault-core/test/vectors/v1-test-vectors.json`) pin the exact byte-level behavior of the format across versions. | No independent third-party security review has been performed yet — see §14.1: claims should stay scoped to what's actually been reviewed. |
| Phishing domain | High | Exact-origin matching (see "Malicious browser page" above) means a look-alike domain (`paypa1.com` vs `paypal.com`) never receives an autofill suggestion, since its origin won't match any stored login's origin. | The user can still manually copy/paste a credential onto the wrong site — the product can warn via origin-matching but can't stop deliberate manual action. |

## Deferred: telemetry

The PRD (§10, §11) calls for operational telemetry ("operational metrics," "no secrets," "monitor
errors, sync failures and latency without logging secrets"). This is explicitly deferred rather
than built in this phase: there is no hosted backend to receive telemetry (`apps/backend` is an
unhosted local stub), and standing up real infrastructure — a hosting choice, an ingestion
endpoint, a retention policy — is a decision for the product owner, not something to invent
unilaterally while implementing an unrelated hardening pass.

When a real backend exists, telemetry should follow the same rule as everything else in this
document: metrics only, no plaintext vault data, no master password, no derived keys, ever.
