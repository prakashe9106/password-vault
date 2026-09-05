/// <reference path="./types/libsodium-wrappers-sumo.d.ts" />
export * from "./schema.js";
export * from "./errors.js";
export {
  ready,
  randomBytes,
  generateSalt,
  generateNonce,
  generateVmk,
  deriveKey,
  aeadEncrypt,
  aeadDecrypt,
  toBase64,
  fromBase64,
  utf8ToBytes,
  bytesToUtf8,
  wipe,
  DEFAULT_KDF_PARAMS,
  VMK_BYTES,
} from "./crypto.js";
export { serializeContainer, parseContainer, encryptVaultData, decryptVaultData, canonicalHeaderAad } from "./container.js";
export {
  generateRecoveryCode,
  formatRecoveryCode,
  parseRecoveryCode,
  createEnvelope,
  openEnvelope,
  RECOVERY_ENTROPY_BYTES,
  type RecoveryCode,
} from "./recovery.js";
export { generatePassword, generatePasswordAsync, defaultGeneratorRules } from "./generator.js";
export { estimatePasswordStrength, type PasswordStrength } from "./passwordStrength.js";
export { createVault, unlockVault, unlockVaultWithRecovery, changeMasterPassword, UnlockedVault } from "./vault.js";
export type { CreateVaultResult } from "./vault.js";
