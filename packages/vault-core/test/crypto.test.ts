import { beforeAll, describe, expect, it } from "vitest";
import {
  DEFAULT_KDF_PARAMS,
  aeadDecrypt,
  aeadEncrypt,
  deriveKey,
  generateNonce,
  generateSalt,
  ready,
  utf8ToBytes,
  VMK_BYTES,
} from "../src/crypto.js";
import { DecryptionFailedError } from "../src/errors.js";

beforeAll(async () => {
  await ready();
});

describe("deriveKey (Argon2id)", () => {
  it("is deterministic for the same secret, salt, and params", () => {
    const salt = generateSalt();
    const k1 = deriveKey(utf8ToBytes("correct horse battery staple"), salt, DEFAULT_KDF_PARAMS);
    const k2 = deriveKey(utf8ToBytes("correct horse battery staple"), salt, DEFAULT_KDF_PARAMS);
    expect(k1).toEqual(k2);
    expect(k1.length).toBe(VMK_BYTES);
  });

  it("produces a different key for a different secret", () => {
    const salt = generateSalt();
    const k1 = deriveKey(utf8ToBytes("password-a"), salt, DEFAULT_KDF_PARAMS);
    const k2 = deriveKey(utf8ToBytes("password-b"), salt, DEFAULT_KDF_PARAMS);
    expect(k1).not.toEqual(k2);
  });

  it("produces a different key for a different salt", () => {
    const k1 = deriveKey(utf8ToBytes("same-password"), generateSalt(), DEFAULT_KDF_PARAMS);
    const k2 = deriveKey(utf8ToBytes("same-password"), generateSalt(), DEFAULT_KDF_PARAMS);
    expect(k1).not.toEqual(k2);
  });
});

describe("aeadEncrypt / aeadDecrypt (XChaCha20-Poly1305-IETF)", () => {
  it("round-trips plaintext", () => {
    const key = deriveKey(utf8ToBytes("k"), generateSalt(), DEFAULT_KDF_PARAMS);
    const nonce = generateNonce();
    const plaintext = utf8ToBytes("hunter2");
    const ciphertext = aeadEncrypt(key, nonce, plaintext);
    const decrypted = aeadDecrypt(key, nonce, ciphertext);
    expect(decrypted).toEqual(plaintext);
  });

  it("round-trips with associated data", () => {
    const key = deriveKey(utf8ToBytes("k"), generateSalt(), DEFAULT_KDF_PARAMS);
    const nonce = generateNonce();
    const aad = utf8ToBytes(JSON.stringify({ vault_id: "abc" }));
    const ciphertext = aeadEncrypt(key, nonce, utf8ToBytes("secret"), aad);
    expect(aeadDecrypt(key, nonce, ciphertext, aad)).toEqual(utf8ToBytes("secret"));
  });

  it("throws DecryptionFailedError when the ciphertext is tampered with", () => {
    const key = deriveKey(utf8ToBytes("k"), generateSalt(), DEFAULT_KDF_PARAMS);
    const nonce = generateNonce();
    const ciphertext = aeadEncrypt(key, nonce, utf8ToBytes("secret"));
    const tampered = new Uint8Array(ciphertext);
    tampered[0] = tampered[0]! ^ 0xff;
    expect(() => aeadDecrypt(key, nonce, tampered)).toThrow(DecryptionFailedError);
  });

  it("throws DecryptionFailedError when the AAD doesn't match", () => {
    const key = deriveKey(utf8ToBytes("k"), generateSalt(), DEFAULT_KDF_PARAMS);
    const nonce = generateNonce();
    const aad = utf8ToBytes("aad-a");
    const ciphertext = aeadEncrypt(key, nonce, utf8ToBytes("secret"), aad);
    expect(() => aeadDecrypt(key, nonce, ciphertext, utf8ToBytes("aad-b"))).toThrow(DecryptionFailedError);
  });

  it("throws DecryptionFailedError when the key is wrong", () => {
    const nonce = generateNonce();
    const key1 = deriveKey(utf8ToBytes("k1"), generateSalt(), DEFAULT_KDF_PARAMS);
    const key2 = deriveKey(utf8ToBytes("k2"), generateSalt(), DEFAULT_KDF_PARAMS);
    const ciphertext = aeadEncrypt(key1, nonce, utf8ToBytes("secret"));
    expect(() => aeadDecrypt(key2, nonce, ciphertext)).toThrow(DecryptionFailedError);
  });
});
