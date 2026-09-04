import type { ContainerHeader, EncryptedPayload, VaultContainer, VaultData } from "./schema.js";
import { CURRENT_CRYPTO_VERSION, CURRENT_FORMAT_VERSION } from "./schema.js";
import { aeadDecrypt, aeadEncrypt, bytesToUtf8, fromBase64, generateNonce, toBase64, utf8ToBytes } from "./crypto.js";
import { CorruptContainerError, VersionUnsupportedError } from "./errors.js";

/** Canonical AAD bound to every AEAD operation in this container — see spec §4.1. */
export function canonicalHeaderAad(header: ContainerHeader): Uint8Array {
  const canonical = JSON.stringify({
    format_version: header.format_version,
    crypto_version: header.crypto_version,
    vault_id: header.vault_id,
  });
  return utf8ToBytes(canonical);
}

export function encryptVaultData(data: VaultData, vmk: Uint8Array, header: ContainerHeader): EncryptedPayload {
  const nonce = generateNonce();
  const plaintext = utf8ToBytes(JSON.stringify(data));
  const aad = canonicalHeaderAad(header);
  const ciphertext = aeadEncrypt(vmk, nonce, plaintext, aad);
  return { nonce: toBase64(nonce), ciphertext: toBase64(ciphertext) };
}

export function decryptVaultData(payload: EncryptedPayload, vmk: Uint8Array, header: ContainerHeader): VaultData {
  const nonce = fromBase64(payload.nonce);
  const ciphertext = fromBase64(payload.ciphertext);
  const aad = canonicalHeaderAad(header);
  const plaintext = aeadDecrypt(vmk, nonce, ciphertext, aad);
  return JSON.parse(bytesToUtf8(plaintext)) as VaultData;
}

export function serializeContainer(container: VaultContainer): string {
  return JSON.stringify(container);
}

export function parseContainer(raw: string): VaultContainer {
  let obj: unknown;
  try {
    obj = JSON.parse(raw);
  } catch {
    throw new CorruptContainerError("not valid JSON");
  }
  if (typeof obj !== "object" || obj === null) {
    throw new CorruptContainerError("root is not an object");
  }

  const container = obj as Partial<VaultContainer>;

  if (typeof container.format_version !== "number") {
    throw new CorruptContainerError("missing format_version");
  }
  if (container.format_version !== CURRENT_FORMAT_VERSION) {
    throw new VersionUnsupportedError("format_version", container.format_version);
  }

  if (typeof container.crypto_version !== "number") {
    throw new CorruptContainerError("missing crypto_version");
  }
  if (container.crypto_version !== CURRENT_CRYPTO_VERSION) {
    throw new VersionUnsupportedError("crypto_version", container.crypto_version);
  }

  if (typeof container.vault_id !== "string") {
    throw new CorruptContainerError("missing vault_id");
  }
  if (!container.envelopes?.password || !container.envelopes?.recovery) {
    throw new CorruptContainerError("missing envelopes");
  }
  if (!container.payload?.nonce || !container.payload?.ciphertext) {
    throw new CorruptContainerError("missing payload");
  }

  return container as VaultContainer;
}
