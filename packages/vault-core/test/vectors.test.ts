import { beforeAll, describe, expect, it } from "vitest";
import sodium from "libsodium-wrappers-sumo";
import { aeadEncrypt, deriveKey, ready, toBase64, utf8ToBytes } from "../src/crypto.js";
import vectors from "./vectors/v1-test-vectors.json" with { type: "json" };

beforeAll(async () => {
  await ready();
});

/**
 * Confirms this implementation reproduces the golden vectors byte-for-byte — the contract any
 * future client (browser extension, native Android) must also satisfy. See
 * docs/spec/vault-protocol-v1.md §8.
 */
describe("v1 test vectors", () => {
  it("reproduces the golden KDF output", () => {
    const salt = sodium.from_hex(vectors.kdf.salt_hex);
    const key = deriveKey(utf8ToBytes(vectors.kdf.password_utf8), salt, {
      opslimit: vectors.kdf.opslimit,
      memlimit: vectors.kdf.memlimit,
    });
    expect(toBase64(key)).toBe(vectors.kdf.derived_key_base64);
  });

  it("reproduces the golden AEAD ciphertext", () => {
    const key = sodium.from_base64(vectors.aead.key_base64, sodium.base64_variants.ORIGINAL);
    const nonce = sodium.from_hex(vectors.aead.nonce_hex);
    const aad = utf8ToBytes(vectors.aead.aad_utf8);
    const ciphertext = aeadEncrypt(key, nonce, utf8ToBytes(vectors.aead.plaintext_utf8), aad);
    expect(toBase64(ciphertext)).toBe(vectors.aead.ciphertext_base64);
  });
});
