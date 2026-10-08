import { Stack } from "expo-router";

import { Colors, FontFamily, Palette } from "@/constants/theme";

export default function CropsStackLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: Colors.backgroundElement },
        headerShadowVisible: false,
        headerTintColor: Palette.primary,
        headerTitleStyle: { fontFamily: FontFamily.semibold, fontSize: 18, color: Colors.text },
        contentStyle: { backgroundColor: Colors.background },
      }}
    />
  );
}
