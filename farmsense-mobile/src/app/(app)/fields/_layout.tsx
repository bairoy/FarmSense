import { Stack } from "expo-router";

import { Colors, FontFamily, Palette } from "@/constants/theme";

export default function FieldsStackLayout() {
  return (
    <Stack
      initialRouteName="index"
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
