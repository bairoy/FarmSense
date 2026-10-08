import { MaterialCommunityIcons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";

import { FontFamily, Palette, Spacing } from "@/constants/theme";
import { useNetworkStatus } from "@/hooks/use-network-status";
import { useOutboxStore } from "@/store/outboxStore";

/**
 * A thin banner above the tabs so a farmer working with no signal can see
 * that their check-ins, logs and photos are queued rather than lost.
 */
export function SyncStatusBar() {
  const isOnline = useNetworkStatus();
  const pending = useOutboxStore((state) => state.pending);
  const failed = useOutboxStore((state) => state.failed);

  if (isOnline && pending === 0 && failed === 0) return null;

  const tone = !isOnline
    ? { bg: "#EAF7EA", fg: "#4D5E52", icon: "cloud-off-outline" as const }
    : failed > 0
      ? { bg: Palette.dangerTint, fg: Palette.danger, icon: "alert-circle-outline" as const }
      : { bg: Palette.warningTint, fg: Palette.warning, icon: "sync" as const };

  return (
    <View style={[styles.container, { backgroundColor: tone.bg }]}>
      <MaterialCommunityIcons name={tone.icon} size={18} color={tone.fg} />
      <Text style={[styles.text, { color: tone.fg }]}>
        {!isOnline
          ? pending > 0
            ? `Offline — ${pending} ${pending === 1 ? "entry" : "entries"} will sync when you're back online`
            : "Offline"
          : failed > 0
            ? `${failed} ${failed === 1 ? "entry" : "entries"} could not be saved — check and resend`
            : `Syncing ${pending} ${pending === 1 ? "entry" : "entries"}…`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  text: {
    flex: 1,
    fontFamily: FontFamily.medium,
    fontSize: 12,
  },
});
