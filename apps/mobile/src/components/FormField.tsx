import { StyleSheet, Text, TextInput, type TextInputProps, View } from "react-native";
import { colors } from "../theme";

interface Props extends TextInputProps {
  label: string;
}

export default function FormField({ label, style, ...inputProps }: Props) {
  return (
    <View style={styles.field}>
      {label.length > 0 && <Text style={styles.label}>{label}</Text>}
      <TextInput
        style={[styles.input, style]}
        placeholderTextColor={colors.muted}
        accessibilityLabel={label}
        {...inputProps}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  field: { marginBottom: 16 },
  label: { color: colors.muted, fontSize: 13, marginBottom: 6 },
  input: {
    backgroundColor: colors.surface2,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    color: colors.text,
    fontSize: 16,
  },
});
