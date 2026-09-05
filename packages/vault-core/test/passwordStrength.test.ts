import { describe, expect, it } from "vitest";
import { estimatePasswordStrength } from "../src/passwordStrength.js";

describe("estimatePasswordStrength", () => {
  it("scores an empty password as very weak", () => {
    expect(estimatePasswordStrength("").score).toBe(0);
  });

  it("scores a common password as very weak regardless of case", () => {
    expect(estimatePasswordStrength("Password").score).toBe(0);
    expect(estimatePasswordStrength("qwerty").score).toBe(0);
  });

  it("scores a short single-character-class password low", () => {
    expect(estimatePasswordStrength("abcdefgh").score).toBeLessThanOrEqual(1);
  });

  it("scores a long password mixing character classes high", () => {
    expect(estimatePasswordStrength("Correct-Horse-Battery-Staple-9!").score).toBe(4);
  });

  it("increases score as length and character diversity increase", () => {
    const short = estimatePasswordStrength("abc12345").score;
    const longer = estimatePasswordStrength("abc12345XYZ!").score;
    const longest = estimatePasswordStrength("abc12345XYZ!extra-length").score;
    expect(longer).toBeGreaterThanOrEqual(short);
    expect(longest).toBeGreaterThanOrEqual(longer);
  });

  it("always returns a label matching the score", () => {
    const labels = ["very weak", "weak", "fair", "strong", "very strong"];
    for (const pw of ["", "a", "password", "abc12345XYZ!extra-length"]) {
      const { score, label } = estimatePasswordStrength(pw);
      expect(label).toBe(labels[score]);
    }
  });
});
