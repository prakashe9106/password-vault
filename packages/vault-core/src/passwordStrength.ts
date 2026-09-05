export interface PasswordStrength {
  score: 0 | 1 | 2 | 3 | 4;
  label: "very weak" | "weak" | "fair" | "strong" | "very strong";
}

const SCORE_LABELS: PasswordStrength["label"][] = ["very weak", "weak", "fair", "strong", "very strong"];

// Sourced from widely published "most common passwords" lists — this is a coarse defensive
// check, not a comprehensive breach-corpus lookup (that would need a network call, which the
// master password must never make).
const COMMON_PASSWORDS = new Set([
  "password",
  "123456",
  "12345678",
  "123456789",
  "qwerty",
  "letmein",
  "welcome",
  "admin",
  "iloveyou",
  "monkey",
  "dragon",
  "master",
  "sunshine",
  "princess",
  "football",
  "abc123",
  "password1",
  "trustno1",
]);

/**
 * Local, zero-network heuristic for master-password strength feedback. Not a substitute for a
 * real entropy estimator (e.g. zxcvbn) — deliberately simple to avoid a new dependency for a
 * non-blocking hint. The vault's actual security floor is the `length >= 8` hard gate enforced
 * by callers; this only adds visible encouragement toward a stronger choice.
 */
export function estimatePasswordStrength(password: string): PasswordStrength {
  if (password.length === 0) {
    return { score: 0, label: SCORE_LABELS[0]! };
  }

  if (COMMON_PASSWORDS.has(password.toLowerCase())) {
    return { score: 0, label: SCORE_LABELS[0]! };
  }

  let classes = 0;
  if (/[a-z]/.test(password)) classes++;
  if (/[A-Z]/.test(password)) classes++;
  if (/[0-9]/.test(password)) classes++;
  if (/[^a-zA-Z0-9]/.test(password)) classes++;

  let lengthPoints = 0;
  if (password.length >= 8) lengthPoints++;
  if (password.length >= 12) lengthPoints++;
  if (password.length >= 16) lengthPoints++;

  const raw = lengthPoints + (classes >= 3 ? 2 : classes >= 2 ? 1 : 0);
  const score = Math.max(0, Math.min(4, raw)) as PasswordStrength["score"];

  return { score, label: SCORE_LABELS[score]! };
}
