import sodium from "libsodium-wrappers-sumo";
import type { GeneratorRules } from "./schema.js";
import { defaultGeneratorRules } from "./schema.js";
import { ready } from "./crypto.js";

const UPPER = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const LOWER = "abcdefghijklmnopqrstuvwxyz";
const DIGITS = "0123456789";
const SYMBOLS = "!@#$%^&*()-_=+[]{};:,.<>?";
const AMBIGUOUS = new Set("Il1O0o".split(""));

export { defaultGeneratorRules };

/** Cryptographically strong password generator. Must be called after `await ready()`. */
export function generatePassword(rules: GeneratorRules = defaultGeneratorRules()): string {
  let alphabet = "";
  if (rules.useUpper) alphabet += UPPER;
  if (rules.useLower) alphabet += LOWER;
  if (rules.useDigits) alphabet += DIGITS;
  if (rules.useSymbols) alphabet += SYMBOLS;

  if (alphabet.length === 0) {
    throw new Error("generatePassword: at least one character class must be enabled");
  }

  if (rules.excludeAmbiguous) {
    alphabet = Array.from(alphabet)
      .filter((c) => !AMBIGUOUS.has(c))
      .join("");
  }

  if (rules.length <= 0) {
    throw new Error("generatePassword: length must be positive");
  }

  const chars: string[] = [];
  for (let i = 0; i < rules.length; i++) {
    const idx = sodium.randombytes_uniform(alphabet.length);
    chars.push(alphabet[idx]!);
  }
  return chars.join("");
}

export async function generatePasswordAsync(rules?: GeneratorRules): Promise<string> {
  await ready();
  return generatePassword(rules);
}
