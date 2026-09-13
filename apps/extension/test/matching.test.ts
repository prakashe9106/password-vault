import { describe, expect, it } from "vitest";
import type { Login } from "@vault/core";
import { matchLoginsForOrigin } from "../src/lib/matching";

function login(overrides: Partial<Login> = {}): Login {
  return {
    id: "id",
    title: "Example",
    url: "https://example.com/login",
    username: "user",
    password: "pw",
    notes: "",
    folder_id: null,
    created_at: "t",
    updated_at: "t",
    category: "login",
    custom_fields: [],
    history: [],
    ...overrides,
  };
}

describe("matchLoginsForOrigin", () => {
  it("matches an exact origin", () => {
    const logins = [login({ id: "1", url: "https://example.com/login" })];
    expect(matchLoginsForOrigin(logins, "https://example.com")).toHaveLength(1);
  });

  it("does not match a different path on the same origin (origin already ignores path, so this still matches)", () => {
    const logins = [login({ id: "1", url: "https://example.com/some/deep/path" })];
    expect(matchLoginsForOrigin(logins, "https://example.com")).toHaveLength(1);
  });

  it("does not match a subdomain by default", () => {
    const logins = [login({ id: "1", url: "https://example.com" })];
    expect(matchLoginsForOrigin(logins, "https://accounts.example.com")).toHaveLength(0);
  });

  it("does not match a different protocol", () => {
    const logins = [login({ id: "1", url: "http://example.com" })];
    expect(matchLoginsForOrigin(logins, "https://example.com")).toHaveLength(0);
  });

  it("does not match a lookalike/punycode domain", () => {
    const logins = [login({ id: "1", url: "https://example.com" })];
    expect(matchLoginsForOrigin(logins, "https://xn--exmple-4nb.com")).toHaveLength(0);
  });

  it("ignores logins with an unparseable url", () => {
    const logins = [login({ id: "1", url: "not a url" })];
    expect(matchLoginsForOrigin(logins, "https://example.com")).toHaveLength(0);
  });

  it("returns every login matching the origin, not just the first", () => {
    const logins = [
      login({ id: "1", url: "https://example.com", username: "a" }),
      login({ id: "2", url: "https://example.com", username: "b" }),
      login({ id: "3", url: "https://other.com", username: "c" }),
    ];
    expect(matchLoginsForOrigin(logins, "https://example.com").map((l) => l.id)).toEqual(["1", "2"]);
  });
});
