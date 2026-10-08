import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { create } from "zustand";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";

import { queryClient } from "@/lib/queryClient";

interface User {
  id: string;
  name: string;
  email: string;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  hasHydrated: boolean;

  login: (user: User, accessToken: string, refreshToken: string) => void;
  logout: () => void;
}

/**
 * expo-secure-store has no bulk API, so zustand's single-key JSON blob just
 * goes under one SecureStore key. Values must be under ~2KB on Android; an
 * access/refresh token pair plus a user profile comfortably fits.
 *
 * SecureStore has no web implementation at all (no Keychain/Keystore there).
 * The shipped app targets Android/iOS only, but falling back to AsyncStorage
 * on web keeps `expo start --web` usable for fast iteration instead of
 * crashing on every load.
 */
const secureStorage: StateStorage =
  Platform.OS === "web"
    ? {
        getItem: (name) => AsyncStorage.getItem(name),
        setItem: (name, value) => AsyncStorage.setItem(name, value),
        removeItem: (name) => AsyncStorage.removeItem(name),
      }
    : {
        getItem: (name) => SecureStore.getItemAsync(name),
        setItem: (name, value) => SecureStore.setItemAsync(name, value),
        removeItem: (name) => SecureStore.deleteItemAsync(name),
      };

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      hasHydrated: false,

      login: (user, accessToken, refreshToken) => {
        // The React Query cache is persisted to disk and keyed by resource
        // (e.g. ["fields"]), not by user. Without clearing it here, logging
        // into a different account would briefly render the previous
        // account's cached fields/crops until a refetch overwrote them.
        queryClient.clear();
        set({ user, accessToken, refreshToken });
      },

      logout: () => {
        queryClient.clear();
        set({ user: null, accessToken: null, refreshToken: null });
      },
    }),
    {
      name: "farmsense-auth",
      storage: createJSONStorage(() => secureStorage),
      onRehydrateStorage: () => () => {
        useAuthStore.setState({ hasHydrated: true });
      },
    }
  )
);
