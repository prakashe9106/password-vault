// One-off generator for docs/spec/vault-protocol-v1.md §8's golden test vectors.
// Uses the same primitives/params as src/crypto.ts (Argon2id + XChaCha20-Poly1305-IETF), called
// directly against the installed libsodium package so this script has no TypeScript build step.
// Run with: node scripts/generate-test-vectors.mjs
// Plain `import` would hit libsodium-wrappers-sumo's broken ESM build (see vitest.config.ts for
// the full explanation), so load the working CJS build directly instead.
import { createRequire } from "node:module";
const sodium = createRequire(import.meta.url)("libsodium-wrappers-sumo");

await sodium.ready;

const DEFAULT_KDF_PARAMS = { opslimit: 3, memlimit: 268435456 };

function b64(bytes) {
  return sodium.to_base64(bytes, sodium.base64_variants.ORIGINAL);
}

// Fixed inputs — deliberately not random, so any conformant implementation reproduces the same
// outputs byte-for-byte given these exact inputs.
const password = "correct horse battery staple";
const salt = sodium.from_hex("000102030405060708090a0b0c0d0e0f");
const vaultId = "11111111-2222-3333-4444-555555555555";
const header = { format_version: 1, crypto_version: 1, vault_id: vaultId };
const aad = sodium.from_string(JSON.stringify(header));

const derivedKey = sodium.crypto_pwhash(
  32,
  password,
  salt,
  DEFAULT_KDF_PARAMS.opslimit,
  DEFAULT_KDF_PARAMS.memlimit,
  sodium.crypto_pwhash_ALG_ARGON2ID13,
);

const nonce = sodium.from_hex("000102030405060708090a0b0c0d0e0f1011121314151617");
const plaintext = "hello vault";
const ciphertext = sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(
  sodium.from_string(plaintext),
  aad,
  null,
  nonce,
  derivedKey,
);

const vectors = {
  description:
    "Golden test vectors for Vault Protocol v1 (see docs/spec/vault-protocol-v1.md). Any conformant client implementation (web, extension, future Android) must reproduce these exact byte outputs given the same inputs.",
  kdf: {
    algorithm: "argon2id",
    opslimit: DEFAULT_KDF_PARAMS.opslimit,
    memlimit: DEFAULT_KDF_PARAMS.memlimit,
    password_utf8: password,
    salt_hex: sodium.to_hex(salt),
    derived_key_base64: b64(derivedKey),
  },
  aead: {
    algorithm: "xchacha20poly1305-ietf",
    key_base64: b64(derivedKey),
    nonce_hex: sodium.to_hex(nonce),
    aad_utf8: JSON.stringify(header),
    plaintext_utf8: plaintext,
    ciphertext_base64: b64(ciphertext),
  },
};

console.log(JSON.stringify(vectors, null, 2));
