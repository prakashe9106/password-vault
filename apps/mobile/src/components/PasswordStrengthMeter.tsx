import { StyleSheet, Text } from "react-native";
import { estimatePasswordStrength } from "@vault/core";
import { colors } from "../theme";

const SCORE_COLORS = [colors.danger, colors.danger, "#e5a04d", "#4de58f", "#4de58f"];

interface Props {
  password: string;
}

export default function PasswordStrengthMeter({ password }: Props) {
  if (!password) return null;
  const { score, label } = estimatePasswordStrength(password);
  return <Text style={[styles.text, { color: SCORE_COLORS[score] }]}>Strength: {label}</Text>;
}

const styles = StyleSheet.create({
  text: { fontSize: 13, marginTop: -8, marginBottom: 12 },
});
