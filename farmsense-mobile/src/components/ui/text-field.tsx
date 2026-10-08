import { useState } from "react";
import { StyleSheet, Text, TextInput, View, type TextInputProps } from "react-native";

import { Colors, FontFamily, Palette, Radius, Spacing } from "@/constants/theme";

interface TextFieldProps extends TextInputProps {
  label: string;
  hint?: string;
}

export function TextField({ label, hint, style, onFocus, onBlur, ...rest }: TextFieldProps) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, { borderColor: focused ? Palette.primary : Colors.border, borderWidth: focused ? 2 : 1.5 }, style]}
        placeholderTextColor={Colors.textTertiary}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        {...rest}
      />
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.one,
  },
  label: {
    fontFamily: FontFamily.semibold,
    fontSize: 14,
    color: Colors.textSecondary,
  },
  input: {
    height: 52,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.three,
    fontFamily: FontFamily.regular,
    fontSize: 16,
    color: Colors.text,
    backgroundColor: Colors.backgroundElement,
  },
  hint: {
    fontFamily: FontFamily.regular,
    fontSize: 12,
    color: Colors.textTertiary,
  },
});
