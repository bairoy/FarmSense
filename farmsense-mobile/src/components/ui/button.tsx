import { MaterialCommunityIcons } from "@expo/vector-icons";
import { ActivityIndicator, Pressable, StyleSheet, Text, type PressableProps } from "react-native";

import { FontFamily, Palette, Radius, Spacing } from "@/constants/theme";

type Variant = "primary" | "secondary" | "neutral" | "ghost" | "danger";

interface ButtonProps extends PressableProps {
  title: string;
  loading?: boolean;
  variant?: Variant;
  icon?: keyof typeof MaterialCommunityIcons.glyphMap;
}

const VARIANTS: Record<Variant, { bg: string; pressedBg: string; fg: string; border?: string }> = {
  primary: { bg: Palette.primary, pressedBg: Palette.primaryPressed, fg: "#fff" },
  secondary: { bg: "#fff", pressedBg: Palette.primaryTint, fg: Palette.primary, border: Palette.primary },
  neutral: { bg: "#fff", pressedBg: "#F0F3EF", fg: "#17221A", border: "#E2E8E2" },
  ghost: { bg: "transparent", pressedBg: "transparent", fg: Palette.primary },
  danger: { bg: Palette.dangerTint, pressedBg: Palette.danger, fg: Palette.danger },
};

export function Button({ title, loading, variant = "primary", icon, disabled, ...rest }: Omit<ButtonProps, "style">) {
  const { bg, pressedBg, fg, border } = VARIANTS[variant];
  const isDisabled = disabled || loading;

  return (
    <Pressable
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        { backgroundColor: pressed && !isDisabled ? pressedBg : bg },
        border ? { borderWidth: 1.5, borderColor: border } : null,
        variant === "primary" && !pressed ? styles.elevated : null,
        isDisabled && styles.disabled,
      ]}
      {...rest}
    >
      {({ pressed }) => {
        const activeFg = variant === "danger" && pressed && !isDisabled ? "#fff" : fg;
        return loading ? (
          <ActivityIndicator color={activeFg} />
        ) : (
          <>
            {icon ? <MaterialCommunityIcons name={icon} size={20} color={activeFg} style={styles.icon} /> : null}
            <Text style={[styles.text, { color: activeFg }]}>{title}</Text>
          </>
        );
      }}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: "row",
    borderRadius: Radius.md,
    height: 52,
    paddingHorizontal: Spacing.four,
    alignItems: "center",
    justifyContent: "center",
  },
  elevated: {
    shadowColor: Palette.primaryPressed,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 3,
  },
  disabled: { opacity: 0.5 },
  icon: { marginRight: Spacing.two },
  text: {
    fontFamily: FontFamily.semibold,
    fontSize: 16,
  },
});
