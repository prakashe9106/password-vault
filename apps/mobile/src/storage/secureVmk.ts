import * as SecureStore from "expo-secure-store";
import * as LocalAuthentication from "expo-local-authentication";

/**
 * Biometric-gated session cache — the mobile analog of the extension's
 * chrome.storage.session-cached VMK (see apps/extension/src/background/vaultSession.ts). The
 * raw VMK is cached in SecureStore (Android Keystore-backed at rest) after a normal
 * password/recovery unlock; on next app open, a biometric prompt gates whether it's ever read
 * back out. On success this enables a cheap AEAD-only rehydration instead of a fresh Argon2id
 * derivation — same trick, biometric-gated instead of just time-gated.
 */

const VMK_KEY = "vault_vmk";
const ACTIVITY_KEY = "vault_last_activity";

export async function cacheVmk(vmkBase64: string): Promise<void> {
  await SecureStore.setItemAsync(VMK_KEY, vmkBase64);
  await touchActivity();
}

export async function touchActivity(): Promise<void> {
  await SecureStore.setItemAsync(ACTIVITY_KEY, String(Date.now()));
}

export async function clearCachedVmk(): Promise<void> {
  await SecureStore.deleteItemAsync(VMK_KEY);
  await SecureStore.deleteItemAsync(ACTIVITY_KEY);
}

export async function hasCachedVmk(): Promise<boolean> {
  return (await SecureStore.getItemAsync(VMK_KEY)) !== null;
}

export interface CachedVmk {
  vmkBase64: string;
  lastActivity: number;
}

export async function isBiometricAvailable(): Promise<boolean> {
  const [hasHardware, isEnrolled] = await Promise.all([
    LocalAuthentication.hasHardwareAsync(),
    LocalAuthentication.isEnrolledAsync(),
  ]);
  return hasHardware && isEnrolled;
}

/** Prompts biometric auth; returns the cached VMK only if the prompt succeeds. */
export async function getCachedVmkWithBiometric(): Promise<CachedVmk | null> {
  const vmkBase64 = await SecureStore.getItemAsync(VMK_KEY);
  if (!vmkBase64) return null;
  if (!(await isBiometricAvailable())) return null;

  const result = await LocalAuthentication.authenticateAsync({ promptMessage: "Unlock your vault" });
  if (!result.success) return null;

  const lastActivityRaw = await SecureStore.getItemAsync(ACTIVITY_KEY);
  return { vmkBase64, lastActivity: lastActivityRaw ? Number(lastActivityRaw) : 0 };
}
