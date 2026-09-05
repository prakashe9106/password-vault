import type { ReactNode } from "react";
import { StyleSheet, Text } from "react-native";
import { colors } from "../theme";

export function Heading({ children }: { children: ReactNode }) {
  return (
    <Text accessibilityRole="header" style={styles.heading}>
      {children}
    </Text>
  );
}

export function Hint({ children }: { children: ReactNode }) {
  return <Text style={styles.hint}>{children}</Text>;
}

export function ErrorText({ children }: { children: ReactNode }) {
  return (
    <Text accessibilityLiveRegion="polite" style={styles.error}>
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  heading: { color: colors.text, fontSize: 20, fontWeight: "700", marginBottom: 8 },
  hint: { color: colors.muted, fontSize: 14, marginBottom: 16, lineHeight: 20 },
  error: { color: colors.danger, fontSize: 14, marginBottom: 12 },
});
