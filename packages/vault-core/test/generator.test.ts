import { beforeAll, describe, expect, it } from "vitest";
import { generatePassword } from "../src/generator.js";
import { ready } from "../src/crypto.js";
import type { GeneratorRules } from "../src/schema.js";

beforeAll(async () => {
  await ready();
});

function rules(overrides: Partial<GeneratorRules> = {}): GeneratorRules {
  return {
    length: 20,
    useUpper: true,
    useLower: true,
    useDigits: true,
    useSymbols: true,
    excludeAmbiguous: false,
    ...overrides,
  };
}

describe("generatePassword", () => {
  it("produces a password of the requested length", () => {
    expect(generatePassword(rules({ length: 32 })).length).toBe(32);
    expect(generatePassword(rules({ length: 8 })).length).toBe(8);
  });

  it("only uses lowercase when only lowercase is enabled", () => {
    const pw = generatePassword(rules({ useUpper: false, useDigits: false, useSymbols: false, length: 50 }));
    expect(pw).toMatch(/^[a-z]+$/);
  });

  it("only uses digits when only digits are enabled", () => {
    const pw = generatePassword(rules({ useUpper: false, useLower: false, useSymbols: false, length: 50 }));
    expect(pw).toMatch(/^[0-9]+$/);
  });

  it("excludes ambiguous characters when configured", () => {
    const pw = generatePassword(rules({ excludeAmbiguous: true, length: 500 }));
    expect(pw).not.toMatch(/[Il1O0o]/);
  });

  it("throws if no character class is enabled", () => {
    expect(() =>
      generatePassword(rules({ useUpper: false, useLower: false, useDigits: false, useSymbols: false })),
    ).toThrow();
  });

  it("throws for a non-positive length", () => {
    expect(() => generatePassword(rules({ length: 0 }))).toThrow();
  });

  it("is not trivially biased toward one character across many samples", () => {
    const counts = new Map<string, number>();
    const samples = 2000;
    for (let i = 0; i < samples; i++) {
      const pw = generatePassword(rules({ useUpper: false, useDigits: false, useSymbols: false, length: 1 }));
      counts.set(pw, (counts.get(pw) ?? 0) + 1);
    }
    // 26 lowercase letters; expect every letter to appear at least once in 2000 samples,
    // and no single letter to dominate (a strong signal of a broken RNG mapping).
    expect(counts.size).toBe(26);
    for (const count of counts.values()) {
      expect(count).toBeLessThan(samples * 0.15);
    }
  });
});
