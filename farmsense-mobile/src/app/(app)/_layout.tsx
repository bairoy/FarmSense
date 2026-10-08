import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router, Tabs } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Colors, FontFamily, Palette } from "@/constants/theme";

export default function AppLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: Colors.backgroundElement,
          borderTopColor: Colors.border,
          borderTopWidth: 1,
          height: 64 + insets.bottom,
          paddingTop: 8,
          paddingBottom: insets.bottom,
        },
        tabBarActiveTintColor: Palette.primary,
        tabBarInactiveTintColor: Colors.textTertiary,
        tabBarLabelStyle: { fontFamily: FontFamily.semibold, fontSize: 12 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Dashboard",
          tabBarIcon: ({ color }) => <MaterialCommunityIcons name="leaf" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="fields"
        listeners={{
          tabPress: (e) => {
            e.preventDefault();
            router.navigate("/fields");
          },
        }}
        options={{
          title: "Fields",
          tabBarIcon: ({ color, focused }) => (
            <MaterialCommunityIcons name={focused ? "view-grid" : "view-grid-outline"} size={24} color={color} />
          ),
        }}
      />
      {/* Not a tab button — reached via Links from Dashboard/Fields. Keeping it
          inside this Tabs navigator (instead of a sibling root Stack) means the
          Dashboard/Fields tab bar stays visible while drilling into a crop. */}
      <Tabs.Screen name="crops" options={{ href: null }} />
    </Tabs>
  );
}
