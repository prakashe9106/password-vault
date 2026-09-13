import { describe, expect, it } from "vitest";
import type { Folder, Login } from "../src/schema.js";
import { computeVaultInsights, STALE_DAYS } from "../src/insights.js";

const NOW = new Date("2026-06-01T00:00:00.000Z");

function login(overrides: Partial<Login>): Login {
  return {
    id: overrides.id ?? "id",
    title: "title",
    url: "",
    username: "",
    password: "SomeStrongP@ssw0rd!",
    notes: "",
    folder_id: null,
    category: "login",
    custom_fields: [],
    created_at: NOW.toISOString(),
    updated_at: NOW.toISOString(),
    history: [],
    ...overrides,
  };
}

function folder(id: string, name: string): Folder {
  return { id, name, created_at: NOW.toISOString(), updated_at: NOW.toISOString() };
}

describe("computeVaultInsights", () => {
  it("returns all zeros and an empty breakdown for an empty vault", () => {
    const insights = computeVaultInsights([], []);
    expect(insights).toEqual({ totalLogins: 0, folderBreakdown: [], weakCount: 0, reusedCount: 0, staleCount: 0 });
  });

  it("counts total logins", () => {
    const logins = [login({ id: "a" }), login({ id: "b" }), login({ id: "c" })];
    expect(computeVaultInsights(logins, []).totalLogins).toBe(3);
  });

  it("builds a folder breakdown including an empty folder and a No folder bucket", () => {
    const folders = [folder("f1", "Work"), folder("f2", "Empty")];
    const logins = [
      login({ id: "a", folder_id: "f1" }),
      login({ id: "b", folder_id: "f1" }),
      login({ id: "c", folder_id: null }),
    ];
    const { folderBreakdown } = computeVaultInsights(logins, folders);
    expect(folderBreakdown).toEqual(
      expect.arrayContaining([
        { folder_id: "f1", name: "Work", count: 2 },
        { folder_id: "f2", name: "Empty", count: 0 },
        { folder_id: null, name: "No folder", count: 1 },
      ]),
    );
    expect(folderBreakdown).toHaveLength(3);
    expect(folderBreakdown[0]!.count).toBeGreaterThanOrEqual(folderBreakdown[1]!.count);
  });

  it("omits the No folder bucket when nothing is unfiled", () => {
    const folders = [folder("f1", "Work")];
    const logins = [login({ id: "a", folder_id: "f1" })];
    const { folderBreakdown } = computeVaultInsights(logins, folders);
    expect(folderBreakdown.find((e) => e.folder_id === null)).toBeUndefined();
  });

  it("flags weak passwords at the strength boundary", () => {
    const logins = [login({ id: "a", password: "password" }), login({ id: "b", password: "Str0ng&Unique!Pass" })];
    expect(computeVaultInsights(logins, []).weakCount).toBe(1);
  });

  it("flags every login that shares a password with another, ignores unique ones", () => {
    const logins = [
      login({ id: "a", password: "shared-pw" }),
      login({ id: "b", password: "shared-pw" }),
      login({ id: "c", password: "unique-pw" }),
    ];
    expect(computeVaultInsights(logins, []).reusedCount).toBe(2);
  });

  it("flags stale logins past the threshold using an injected now", () => {
    const staleDate = new Date(NOW.getTime() - (STALE_DAYS + 1) * 24 * 60 * 60 * 1000).toISOString();
    const freshDate = new Date(NOW.getTime() - (STALE_DAYS - 1) * 24 * 60 * 60 * 1000).toISOString();
    const logins = [login({ id: "a", updated_at: staleDate }), login({ id: "b", updated_at: freshDate })];
    expect(computeVaultInsights(logins, [], NOW).staleCount).toBe(1);
  });
});
