import type { Folder, Login } from "./schema.js";
import { estimatePasswordStrength } from "./passwordStrength.js";

export const STALE_DAYS = 90;

export interface FolderBreakdownEntry {
  folder_id: string | null;
  name: string;
  count: number;
}

export interface VaultInsights {
  totalLogins: number;
  folderBreakdown: FolderBreakdownEntry[];
  weakCount: number;
  reusedCount: number;
  staleCount: number;
}

/** Vault-wide stats for the summary screen. Pure function — same data every client can compute
 * from its own already-decrypted `logins`/`folders`, so the counting logic lives in one place. */
export function computeVaultInsights(logins: readonly Login[], folders: readonly Folder[], now: Date = new Date()): VaultInsights {
  const countsByFolder = new Map<string | null, number>();
  const passwordCounts = new Map<string, number>();
  let weakCount = 0;
  let staleCount = 0;
  const staleThresholdMs = STALE_DAYS * 24 * 60 * 60 * 1000;

  for (const login of logins) {
    countsByFolder.set(login.folder_id, (countsByFolder.get(login.folder_id) ?? 0) + 1);
    passwordCounts.set(login.password, (passwordCounts.get(login.password) ?? 0) + 1);

    if (estimatePasswordStrength(login.password).score <= 1) weakCount++;
    if (now.getTime() - new Date(login.updated_at).getTime() > staleThresholdMs) staleCount++;
  }

  const reusedCount = logins.filter((login) => (passwordCounts.get(login.password) ?? 0) > 1).length;

  const folderBreakdown: FolderBreakdownEntry[] = folders.map((f) => ({
    folder_id: f.id,
    name: f.name,
    count: countsByFolder.get(f.id) ?? 0,
  }));
  const noFolderCount = countsByFolder.get(null) ?? 0;
  if (noFolderCount > 0) {
    folderBreakdown.push({ folder_id: null, name: "No folder", count: noFolderCount });
  }
  folderBreakdown.sort((a, b) => b.count - a.count);

  return {
    totalLogins: logins.length,
    folderBreakdown,
    weakCount,
    reusedCount,
    staleCount,
  };
}
