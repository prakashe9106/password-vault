/**
 * Thin libsodium wrapper. No vault-specific logic lives here — see docs/spec/vault-protocol-v1.md
 * for why XChaCha20-Poly1305-IETF (AEAD) and Argon2id (KDF) were chosen.
 */
import sodium from "libsodium-wrappers-sumo";
import type { KdfParams } from "./schema.js";
import { DecryptionFailedError } from "./errors.js";

let readyPromise: Promise<typeof sodium> | null = null;

/** Must be awaited before calling any other function in this module. */
export async function ready(): Promise<typeof sodium> {
  if (!readyPromise) {
    readyPromise = sodium.ready.then(() => sodium);
  }
  return readyPromise;
}

export const VMK_BYTES = 32; // crypto_aead_xchacha20poly1305_ietf_KEYBYTES

/** Default Argon2id cost parameters — "moderate" preset values, stored explicitly per envelope. */
export const DEFAULT_KDF_PARAMS: KdfParams = {
  opslimit: 3,
  memlimit: 268435456, // 256 MiB
};

export function randomBytes(n: number): Uint8Array {
  return sodium.randombytes_buf(n);
}

export function generateSalt(): Uint8Array {
  return sodium.randombytes_buf(sodium.crypto_pwhash_SALTBYTES);
}

export function generateNonce(): Uint8Array {
  return sodium.randombytes_buf(sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES);
}

export function generateVmk(): Uint8Array {
  return sodium.randombytes_buf(VMK_BYTES);
}

/** Derive a key of `keyLength` bytes from a secret via Argon2id. `sodium.ready` must already be resolved. */
export function deriveKey(
  secret: Uint8Array,
  salt: Uint8Array,
  params: KdfParams,
  keyLength: number = VMK_BYTES,
): Uint8Array {
  return sodium.crypto_pwhash(
    keyLength,
    secret,
    salt,
    params.opslimit,
    params.memlimit,
    sodium.crypto_pwhash_ALG_ARGON2ID13,
  );
}

/** AEAD-encrypt with XChaCha20-Poly1305-IETF. `aad`, if given, is authenticated but not encrypted. */
export function aeadEncrypt(
  key: Uint8Array,
  nonce: Uint8Array,
  plaintext: Uint8Array,
  aad?: Uint8Array,
): Uint8Array {
  return sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(plaintext, aad ?? null, null, nonce, key);
}

/** Throws DecryptionFailedError if the auth tag doesn't verify (wrong key, tampered data, or wrong AAD). */
export function aeadDecrypt(
  key: Uint8Array,
  nonce: Uint8Array,
  ciphertext: Uint8Array,
  aad?: Uint8Array,
): Uint8Array {
  try {
    return sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(null, ciphertext, aad ?? null, nonce, key);
  } catch {
    throw new DecryptionFailedError();
  }
}

export function toBase64(bytes: Uint8Array): string {
  return sodium.to_base64(bytes, sodium.base64_variants.ORIGINAL);
}

export function fromBase64(b64: string): Uint8Array {
  return sodium.from_base64(b64, sodium.base64_variants.ORIGINAL);
}

export function utf8ToBytes(s: string): Uint8Array {
  return sodium.from_string(s);
}

export function bytesToUtf8(bytes: Uint8Array): string {
  return sodium.to_string(bytes);
}

/** Best-effort zeroing of sensitive buffers held in memory (e.g. on lock()). */
export function wipe(bytes: Uint8Array): void {
  sodium.memzero(bytes);
}
