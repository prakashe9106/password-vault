# Vault Protocol Specification — v1

Status: Draft, pending independent security review before production launch (per PRD §4 and §14.1). This document is the interoperability contract for every client that ever needs to read or write a vault file: the web app today, the browser extension next, and a native Android client later. No client may deviate from this spec without bumping `format_version` and/or `crypto_version` and documenting the change here.

## 1. Design goals

- The backend must never be able to decrypt a vault. All cryptographic operations happen on the client.
- The master password must never be transmitted or persisted in plaintext, anywhere.
- Losing the master password must not mean losing the vault — a recovery mechanism must exist, but it must not create a server-side (or any third-party) decryption backdoor.
- The container format must be self-describing enough that a future client, in a different language (Kotlin, for a native Android app), can implement this spec independently and interoperate byte-for-byte.
- No custom cryptographic primitives. Everything below is a direct, standard use of libsodium's audited constructions.

## 2. Primitive choices

| Purpose | Primitive | Notes |
|---|---|---|
| Password-based key derivation | Argon2id (`crypto_pwhash` with `crypto_pwhash_ALG_ARGON2ID13`) | Memory-hard, resistant to GPU/ASIC attacks. Parameters (`opslimit`, `memlimit`) are stored explicitly per-envelope rather than referenced by symbolic preset name, so they can be tuned over time without breaking older vaults. |
| Authenticated encryption | XChaCha20-Poly1305-IETF (`crypto_aead_xchacha20poly1305_ietf_*`) | Chosen over AES-256-GCM. The PRD allows "AES-256-GCM or an equivalent modern AEAD construction" — XChaCha20-Poly1305 is libsodium's idiomatic AEAD, uses a 192-bit random nonce (no counter/nonce-reuse bookkeeping needed — a fresh random nonce per encryption is safe by construction), and its performance does not depend on AES-NI hardware acceleration, which matters for uniform behavior across browsers, Node, WASM, and eventually Android. |
| Randomness | `randombytes_buf` / `randombytes_uniform` | libsodium's CSPRNG, used for all salts, nonces, the Vault Master Key, and recovery-code entropy. |

Rationale for both choices must be re-affirmed (or revised) during the independent security review gate in PRD §14.1 before production launch.

## 3. Key hierarchy

```
                 ┌────────────────────┐
                 │  Vault Master Key  │  (VMK — 32 random bytes, generated once at vault creation)
                 └─────────┬──────────┘
                            │ wrapped by (AEAD-encrypted using a KEK as the key)
             ┌──────────────┴───────────────┐
             │                                │
   ┌─────────▼─────────┐          ┌──────────▼──────────┐
   │  Password Envelope │          │  Recovery Envelope  │
   │  KEK = Argon2id(    │          │  KEK = Argon2id(     │
   │   masterPassword,   │          │   recoveryCode,      │
   │   salt_password)    │          │   salt_recovery)      │
   └─────────────────────┘          └───────────────────────┘
```

- The **VMK** is the only key that ever encrypts actual vault data. It is generated once with `randombytes_buf(32)` at vault creation and never changes unless the user explicitly rotates it (out of scope for v1).
- The **password envelope** and **recovery envelope** are structurally identical: each derives a KEK from a secret (master password or recovery code) plus its own random salt via Argon2id, then uses that KEK to AEAD-encrypt ("wrap") the VMK. Unlocking via either path recovers the same VMK.
- Rotating the master password (`changeMasterPassword`) re-derives and re-wraps only the password envelope; the VMK and the recovery envelope are untouched, so the recovery code continues to work.
- There is no mechanism, anywhere in this design, by which the backend or any third party can derive a KEK or the VMK. Both secrets (master password, recovery code) exist only on the client, transiently, during unlock.

## 4. Container format

The persisted artifact (the file/blob written to Google Drive in a later phase; written to IndexedDB in this increment) is a single JSON document:

```jsonc
{
  "format_version": 1,        // governs the JSON *shape* below
  "crypto_version": 1,        // governs which algorithms/param semantics apply
  "vault_id": "uuid-v4-string",
  "header": {
    "kdf_alg": "argon2id"
  },
  "envelopes": {
    "password": {
      "salt": "base64",         // crypto_pwhash_SALTBYTES random bytes
      "opslimit": 3,
      "memlimit": 268435456,     // bytes; both stored explicitly, not symbolic
      "nonce": "base64",         // crypto_aead_xchacha20poly1305_ietf_NPUBBYTES (24) random bytes
      "wrapped_key": "base64"    // AEAD ciphertext+tag of the 32-byte VMK, KEK = Argon2id(password, salt)
    },
    "recovery": {
      "salt": "base64",
      "opslimit": 3,
      "memlimit": 268435456,
      "nonce": "base64",
      "wrapped_key": "base64"
    }
  },
  "payload": {
    "nonce": "base64",          // fresh nonce for every save, never reused
    "ciphertext": "base64"      // AEAD ciphertext+tag of the serialized VaultData JSON, key = VMK
  },
  "revision": 1,                 // monotonic counter, incremented on every save
  "updated_at": "2026-09-04T00:00:00.000Z"
}
```

### 4.1 Associated data (AAD) binding

Every AEAD operation (both envelope wraps and the payload encryption) binds a canonical JSON string of `{format_version, crypto_version, vault_id}` as associated data. This means tampering with any of those three header fields — for example substituting a different `vault_id` or downgrading `crypto_version` — causes decryption to fail even if the attacker leaves the ciphertext bytes untouched. AAD is never secret; it only needs to be reproducible identically at decrypt time.

### 4.2 What's encrypted vs. visible

Everything under `envelopes.*.salt/opslimit/memlimit/nonce` and `payload.nonce` is safe to store in the clear — salts and nonces are not secrets, KDF parameters are not secrets, and `wrapped_key`/`ciphertext` are opaque AEAD outputs that reveal nothing without the corresponding KEK/VMK. The only things that must never appear in this document (or anywhere else) are the master password, the recovery code, the derived KEKs, and the VMK itself.

### 4.3 Decrypted payload shape (`VaultData`)

This is the JSON structure that results from decrypting `payload.ciphertext` with the VMK:

```jsonc
{
  "logins": [
    { "id": "uuid", "title": "string", "url": "string", "username": "string",
      "password": "string", "notes": "string", "folder_id": "uuid|null",
      "created_at": "ISO-8601", "updated_at": "ISO-8601",
      "history": [
        { "changed_at": "ISO-8601", "title": "string", "url": "string", "username": "string",
          "password": "string", "notes": "string", "folder_id": "uuid|null" }
      ]
    }
  ],
  "folders": [
    { "id": "uuid", "name": "string", "created_at": "ISO-8601", "updated_at": "ISO-8601" }
  ],
  "settings": {
    "auto_lock_minutes": 5,
    "generator_defaults": { "length": 20, "useUpper": true, "useLower": true, "useDigits": true, "useSymbols": true, "excludeAmbiguous": false }
  },
  "sync_metadata": {
    "device_id": "uuid",
    "revision": 1,
    "updated_at": "ISO-8601",
    "conflict_markers": []
  }
}
```

`sync_metadata` is populated starting in this increment (single device, so `conflict_markers` stays empty) so that the future Google Drive sync phase (PRD §6) does not require a format migration to add the field.

Each login's `history` holds snapshots of its previously-saved field values (newest first), capped at `MAX_LOGIN_HISTORY_ENTRIES` (20). A snapshot is recorded whenever `title`, `url`, `username`, `password`, `notes`, or `folder_id` actually changes; a save with no changes adds nothing. This is purely additive to the format — older encrypted vaults decrypt fine with `history` absent on their logins, since there is no runtime schema validation on the decrypted JSON (just a type cast), so every reader treats a missing `history` as `[]` rather than requiring a format-version bump.

## 5. Operational flows

### 5.1 Create vault

1. Generate `vault_id` (uuid v4) and VMK (`randombytes_buf(32)`).
2. Generate a human-presentable recovery code (see §6) and its raw bytes.
3. For each of {master password, recovery code}: generate a random salt, derive a KEK via Argon2id, generate a random nonce, AEAD-encrypt the VMK with AAD = canonical header fields → envelope.
4. Build the initial (empty) `VaultData`, encrypt it with the VMK under a fresh nonce → `payload`.
5. Assemble and return the full container (`revision: 1`) plus the recovery code for display to the user.

### 5.2 Unlock (master password path)

1. Parse the container; verify `format_version`/`crypto_version` are supported (reject with `VersionUnsupportedError` otherwise).
2. Derive the KEK from the entered password and `envelopes.password.salt/opslimit/memlimit`.
3. AEAD-open `envelopes.password.wrapped_key` with that KEK and the header AAD → VMK, or throw `WrongPasswordError` on auth failure.
4. AEAD-open `payload.ciphertext` with the VMK and header AAD → `VaultData`.

### 5.3 Unlock (recovery path)

Identical to 5.2 but uses `envelopes.recovery` and the recovery code as the input secret.

### 5.4 Save (after any mutation)

1. Mutate the in-memory `VaultData`, bump `sync_metadata.revision` and `updated_at`.
2. Encrypt the full `VaultData` under the (unchanged) VMK with a **freshly generated nonce** (nonces are never reused, even for the same key).
3. Increment the container's top-level `revision`, set `updated_at`, and persist the full container.

Envelopes are untouched on ordinary saves — only `changeMasterPassword` regenerates the password envelope (new salt, new KEK, re-wrap VMK, same VMK so the recovery envelope and all vault data remain valid unchanged).

## 6. Recovery code format

- 20 random bytes (`randombytes_buf(20)`) ≈ 160 bits of entropy — enough that it can safely skip a memory-hard KDF cost concern, but it is still passed through the same Argon2id envelope construction as the master password so that "envelope" is a single uniform concept in the code (see `recovery.ts`/`createEnvelope`).
- Displayed to the user as Crockford base32, grouped in blocks of 5 characters (e.g. `XXXXX-XXXXX-XXXXX-XXXXX-XXXXX-XXXXX-XXXXX`) for readability and manual transcription accuracy.
- The UI must force explicit acknowledgement that the user has saved this code before proceeding (PRD §4.4 — "must clearly explain that recovery design affects the security model"). There is no way to regenerate a forgotten recovery code without the master password (or vice versa) other than by unlocking the vault and re-running the create-envelope step for one of the two paths.

## 7. Versioning rules

- `format_version` changes only when the JSON *shape* changes (renamed/restructured fields). Parsers must reject unknown `format_version` values rather than guess.
- `crypto_version` changes only when the algorithm choice or parameter *semantics* change (e.g. a future move to a different AEAD, or a change in how KDF parameters are interpreted). A client may support parsing multiple past `crypto_version`s for backward-compatible reads while only ever writing the latest.
- The two version numbers are independent: a future `crypto_version 2` could still use `format_version 1`'s JSON shape, and vice versa.

## 8. Test vectors

Fixed, golden input/output byte sets (specific password, specific salts, specific plaintext, and their exact resulting KEK/VMK/nonce/ciphertext bytes) are committed at `packages/vault-core/test/vectors/v1-test-vectors.json`, generated from the reference TypeScript implementation. Any future client implementation (browser extension reusing the same package, or a native Android reimplementation) must reproduce these exact byte outputs to be considered a conformant implementation of this spec. Regenerating or extending the vectors (e.g. when adding `crypto_version 2`) must keep the existing v1 vectors unchanged so old vaults remain verifiably decryptable.

## 9. Explicit non-goals for v1

- Per-record encryption (the entire `VaultData` is one AEAD payload). Partial/field-level encryption for efficient partial sync is a possible future optimization, not required now.
- Multi-device conflict *resolution* logic — `sync_metadata` fields exist so this can be added later without a format change, but no merge algorithm ships in this increment (single device only).
- Master-password or recovery-code rotation UX beyond the basic `changeMasterPassword` API — full rotation flows (e.g. recovery-code regeneration UI) are a later phase.
