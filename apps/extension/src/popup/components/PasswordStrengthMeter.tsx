import { estimatePasswordStrength } from "@vault/core";

const SCORE_COLORS = ["var(--danger)", "var(--danger)", "#e5a04d", "#4de58f", "#4de58f"];

interface Props {
  password: string;
}

export default function PasswordStrengthMeter({ password }: Props) {
  if (!password) return null;

  const { score, label } = estimatePasswordStrength(password);

  return (
    <p className="hint" aria-live="polite" style={{ color: SCORE_COLORS[score] }}>
      Strength: {label}
    </p>
  );
}
