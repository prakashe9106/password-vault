import type { ContainerHeader, Envelope, KdfParams } from "./schema.js";
import {
  DEFAULT_KDF_PARAMS,
  aeadDecrypt,
  aeadEncrypt,
  deriveKey,
  fromBase64,
  generateNonce,
  generateSalt,
  randomBytes,
  ready,
  toBase64,
  wipe,
} from "./crypto.js";
import { canonicalHeaderAad } from "./container.js";
import { WrongPasswordError } from "./errors.js";

/** 160 bits of entropy — high enough to skip relying on the KDF for brute-force resistance. */
export const RECOVERY_ENTROPY_BYTES = 20;

// Crockford base32: excludes I, L, O, U to avoid visual ambiguity/typos when transcribed by hand.
const CROCKFORD_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

function base32Encode(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let output = "";
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += CROCKFORD_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += CROCKFORD_ALPHABET[(value << (5 - bits)) & 31];
  }
  return output;
}

function base32Decode(input: string): Uint8Array {
  const clean = input
    .toUpperCase()
    .replace(/[-\s]/g, "")
    .replace(/O/g, "0")
    .replace(/[IL]/g, "1");

  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const char of clean) {
    const idx = CROCKFORD_ALPHABET.indexOf(char);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return new Uint8Array(bytes);
}

export interface RecoveryCode {
  raw: Uint8Array;
  /** Human-presentable, dash-grouped Crockford base32 string. */
  formatted: string;
}

export function formatRecoveryCode(raw: Uint8Array): string {
  const encoded = base32Encode(raw);
  return (encoded.match(/.{1,5}/g) ?? [encoded]).join("-");
}

export function parseRecoveryCode(formatted: string): Uint8Array {
  return base32Decode(formatted);
}

export async function generateRecoveryCode(): Promise<RecoveryCode> {
  await ready();
  const raw = randomBytes(RECOVERY_ENTROPY_BYTES);
  return { raw, formatted: formatRecoveryCode(raw) };
}

/** Wraps `vmk` under a KEK derived from `secretInput` — used for both the password and recovery envelopes. */
export function createEnvelope(
  secretInput: Uint8Array,
  vmk: Uint8Array,
  header: ContainerHeader,
  params: KdfParams = DEFAULT_KDF_PARAMS,
): Envelope {
  const salt = generateSalt();
  const kek = deriveKey(secretInput, salt, params);
  const nonce = generateNonce();
  const aad = canonicalHeaderAad(header);
  const wrappedKey = aeadEncrypt(kek, nonce, vmk, aad);
  wipe(kek);

  return {
    salt: toBase64(salt),
    opslimit: params.opslimit,
    memlimit: params.memlimit,
    nonce: toBase64(nonce),
    wrapped_key: toBase64(wrappedKey),
  };
}

/** Recovers the VMK from an envelope, or throws WrongPasswordError if `secretInput` is wrong. */
export function openEnvelope(secretInput: Uint8Array, envelope: Envelope, header: ContainerHeader): Uint8Array {
  const salt = fromBase64(envelope.salt);
  const kek = deriveKey(secretInput, salt, { opslimit: envelope.opslimit, memlimit: envelope.memlimit });
  const nonce = fromBase64(envelope.nonce);
  const wrappedKey = fromBase64(envelope.wrapped_key);
  const aad = canonicalHeaderAad(header);

  try {
    const vmk = aeadDecrypt(kek, nonce, wrappedKey, aad);
    wipe(kek);
    return vmk;
  } catch {
    wipe(kek);
    throw new WrongPasswordError();
  }
}
