# Mobile app (Android) — Phase 5

This app has **never been compiled or run**. There is no JDK, Android SDK, `adb`, or `gradle` on
the machine this was built on — confirmed before starting, and accepted as a known tradeoff for
this phase (see the plan this was built from). Everything below is written carefully, but treat it
as a first draft that needs real-device verification, not working software.

## What's actually been checked

- `pnpm --filter mobile typecheck` (`tsc --noEmit`) — passes clean, full TypeScript typecheck
  against `@vault/core`.
- `pnpm --filter mobile export` (`expo export --platform android`) — **passes**. Metro bundled all
  651 modules and compiled the result all the way to Hermes bytecode (`.hbc`), needing no Android
  SDK at all. This took real iteration to get working (see `metro.config.js`'s comments — pnpm's
  `node_modules/.pnpm/<pkg>/node_modules/` layout and Metro's resolver needed a specific, correct
  combination of settings; an earlier attempt at this actively broke resolution of `expo`'s own
  dependencies). I confirmed the bundle isn't silently stubbing anything out by grepping the
  compiled bytecode for symbols that could only be there if the real code paths were included:
  `crypto_pwhash` (12×), `argon2` (7×), `xchacha20poly1305` (4×), `UnlockedVault`,
  `estimatePasswordStrength`, `generatePassword` all present. Interestingly, `WebAssembly` appears
  exactly once — consistent with the Node finding above that libsodium's fallback defines its own
  internal shim object by that name rather than depending on the host providing a real one.

This is real signal that the dependency graph, module resolution, and JS/TS-to-Hermes-bytecode
compilation pipeline all work correctly for this exact code — genuinely more verification than "it
might build." It does **not** prove anything about runtime behavior on a real device or emulator:
no screen has been rendered, no button has been pressed, no biometric prompt has fired, no OAuth
round-trip has completed, and compiling to Hermes bytecode says nothing about whether the
Argon2id/AEAD calls inside actually execute correctly (or fast enough) when that bytecode runs.

## The single biggest risk: does the crypto even run correctly (or fast enough)?

`@vault/core` imports `libsodium-wrappers-sumo`, which is WebAssembly-based. React Native's JS
engine (Hermes) does not implement the `WebAssembly` global. I tested — in Node, not Hermes —
whether this dependency has a working fallback when `WebAssembly` is unavailable: deleting
`globalThis.WebAssembly` and running an Argon2id derivation still produced a correct result, but
the same run also threw an unhandled async rejection from a separate internal wasm-loading
attempt. That's evidence of *a* non-WASM code path existing, not proof Hermes will execute it
cleanly, and it says nothing about speed — if what actually runs is an interpreted/asm.js-style
fallback instead of compiled WebAssembly, Argon2id at this app's memlimit (256MB, matching every
other client) could take much longer on a phone than the ~1-3 seconds seen on desktop, or fail
under memory pressure.

**First thing to check once real Android tooling exists**: run the app, create a vault, and time
how long "Create vault" and "Unlock" actually take. If it's slow, hangs, or crashes:

- Lower `DEFAULT_KDF_PARAMS` isn't an option — it's shared with every other client and changing it
  would be a protocol version bump affecting web/extension too.
- The documented fallback is **`react-native-libsodium`** — a native-module (JSI, not WASM) sodium
  binding purpose-built for exactly this situation. It exposes largely the same function names as
  `libsodium-wrappers-sumo`, so swapping it in would mean a small platform-specific adapter over
  `packages/vault-core/src/crypto.ts`'s sodium calls (dependency-injecting the sodium
  implementation), not a rewrite of the container/vault logic above it.

## Other things that are unverified but lower-risk

- The Metro resolver customizations in `metro.config.js` (the libsodium alias, and the
  `.js`-import-resolves-to-`.ts`-file fallback for `@vault/core`'s NodeNext-style imports) were
  reasoned through by reading how Metro's resolver actually behaves, but never run against a real
  Metro bundling pass beyond `expo export`.
- The Google OAuth flow (`src/lib/googleAuth.ts`, using `expo-auth-session`) has never completed a
  real authorization-code+PKCE round-trip. See `docs/google-drive-mobile-setup.md` for what's
  needed to even attempt it (an Android OAuth Client ID tied to a signing key's SHA-1 fingerprint).
- Biometric unlock (`src/storage/secureVmk.ts`, `expo-local-authentication` + `expo-secure-store`)
  has never triggered an actual OS biometric prompt.

## Scope: what's built vs. deferred

Built (matching `Password_Vault_SaaS_PRD_v1.docx`'s Android MVP list): vault unlock (password,
recovery code, biometric), search, add/edit/delete logins and folders, password generator,
biometric unlock, Google Drive sync, offline access (local cache via AsyncStorage).

Deferred, and why:

- **Android `AutofillService`** — only mentioned in the other PRD's Phase 5 roadmap line, not the
  Android-specific PRD's MVP list. Needs a custom native Kotlin module (parsing `AssistStructure`,
  building datasets, a manifest service declaration) — real native-code risk on top of an already
  much-larger-than-usual verification gap.
- **OneDrive** — only Google Drive is in the Android PRD's MVP list; OneDrive is web-only per Phase 6.
- **CSV import/export** — not in the Android PRD's MVP list; web-only per Phase 6.

## Setup

1. `pnpm install` from the repo root.
2. Copy `.env.example` to `.env` and follow `docs/google-drive-mobile-setup.md` for
   `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID`.
3. `pnpm --filter mobile typecheck` and `pnpm --filter mobile export` are the only things
   confirmed to work without Android tooling. Everything past that needs a JDK, the Android SDK,
   and either an emulator or a physical device — none of which exist in the environment this was
   written in.
