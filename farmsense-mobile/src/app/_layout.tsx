import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, useFonts } from "@expo-google-fonts/inter";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { DefaultTheme, Stack, ThemeProvider } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { LogBox, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { SyncStatusBar } from "@/components/sync-status-bar";
import { Colors, Palette } from "@/constants/theme";
import { queryClient } from "@/lib/queryClient";
import { useOutboxFlush } from "@/lib/useOutboxFlush";
import { useAuthStore } from "@/store/authStore";

const NavTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: Palette.primary,
    background: Colors.background,
    card: Colors.backgroundElement,
    text: Colors.text,
    border: Colors.border,
  },
};

// expo-router's internal initial-URL handling sets state before mount on launch; harmless.
LogBox.ignoreLogs(["Can't perform a React state update on a component that hasn't mounted yet"]);

SplashScreen.preventAutoHideAsync();

const asyncStoragePersister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: "farmsense-query-cache",
});

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });
  const hasHydrated = useAuthStore((state) => state.hasHydrated);
  const accessToken = useAuthStore((state) => state.accessToken);

  useOutboxFlush(hasHydrated && !!accessToken);

  const ready = hasHydrated && fontsLoaded;

  useEffect(() => {
    if (ready) {
      SplashScreen.hideAsync();
    }
  }, [ready]);

  // Wait for the secure-store-backed auth state and the Inter font to load
  // before deciding which route group to show — otherwise a logged-in user
  // flashes the login screen, or every screen flashes the system font, on
  // every cold start.
  if (!ready) {
    return null;
  }

  return (
    <PersistQueryClientProvider client={queryClient} persistOptions={{ persister: asyncStoragePersister }}>
      <ThemeProvider value={NavTheme}>
        <View style={{ flex: 1, backgroundColor: Colors.background }}>
          {accessToken && (
            <SafeAreaView edges={["top"]} style={{ backgroundColor: Colors.background }}>
              <SyncStatusBar />
            </SafeAreaView>
          )}
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Protected guard={!!accessToken}>
              <Stack.Screen name="(app)" />
            </Stack.Protected>

            <Stack.Protected guard={!accessToken}>
              <Stack.Screen name="(auth)" />
            </Stack.Protected>
          </Stack>
        </View>
      </ThemeProvider>
    </PersistQueryClientProvider>
  );
}
