import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";

import { Colors, FontFamily, Palette, Spacing, Type } from "@/constants/theme";
import { useAuthStore } from "@/store/authStore";

function initials(name?: string, email?: string) {
  const source = name?.trim() || email?.trim() || "";
  if (!source) return "F";
  return source
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

/** The shared brand top-bar shown on tab-root screens (Dashboard, Fields). */
export function AppHeader() {
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);

  const confirmSignOut = () => {
    Alert.alert("Sign out", user?.name ? `Sign out of ${user.name}'s account?` : "Sign out of your account?", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign out", style: "destructive", onPress: logout },
    ]);
  };

  return (
    <View style={styles.header}>
      <View style={styles.brandRow}>
        <MaterialCommunityIcons name="leaf" size={26} color={Palette.primary} />
        <Text style={styles.brand}>FarmSense</Text>
      </View>
      <Pressable onPress={confirmSignOut} hitSlop={12} style={styles.avatarWrap}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials(user?.name, user?.email)}</Text>
        </View>
        <View style={styles.activeDot} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    height: 64,
    paddingHorizontal: Spacing.three,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: Colors.backgroundElement,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  brandRow: { flexDirection: "row", alignItems: "center", gap: Spacing.one + 2 },
  brand: { ...Type.headlineMd, color: Palette.primary, fontFamily: FontFamily.bold },
  avatarWrap: { width: 40, height: 40 },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Palette.primaryTint,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  avatarText: { fontFamily: FontFamily.bold, fontSize: 14, color: Palette.primary },
  activeDot: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: Palette.primary,
    borderWidth: 2,
    borderColor: Colors.backgroundElement,
  },
});
