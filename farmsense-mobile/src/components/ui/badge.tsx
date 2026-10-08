import { MaterialCommunityIcons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";

import { FontFamily, Palette, Radius, Spacing } from "@/constants/theme";

export type BadgeTone = "positive" | "warning" | "danger" | "info" | "neutral";

const TONES: Record<BadgeTone, { bg: string; fg: string }> = {
  positive: { bg: Palette.positiveTint, fg: Palette.positive },
  warning: { bg: Palette.warningTint, fg: Palette.warning },
  danger: { bg: Palette.dangerTint, fg: Palette.danger },
  info: { bg: Palette.infoTint, fg: Palette.info },
  neutral: { bg: "#EEF1EC", fg: "#4D5E52" },
};

interface BadgeProps {
  label: string;
  tone?: BadgeTone;
  icon?: keyof typeof MaterialCommunityIcons.glyphMap;
}

export function Badge({ label, tone = "neutral", icon }: BadgeProps) {
  const { bg, fg } = TONES[tone];
  return (
    <View style={[styles.pill, { backgroundColor: bg }]}>
      {icon ? <MaterialCommunityIcons name={icon} size={16} color={fg} /> : null}
      <Text style={[styles.label, { color: fg }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.half + 2,
    minHeight: 32,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.pill,
    alignSelf: "flex-start",
  },
  label: {
    fontFamily: FontFamily.semibold,
    fontSize: 14,
  },
});
