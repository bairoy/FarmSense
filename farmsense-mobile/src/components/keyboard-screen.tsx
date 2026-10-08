import { useEffect, useState, type ReactNode } from "react";
import { Keyboard, KeyboardAvoidingView, Platform, StyleSheet, View, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BottomTabHeight } from "@/constants/theme";

interface KeyboardScreenProps {
  children: ReactNode;
  /** True when the screen sits under the bottom tab bar, which the keyboard covers first. */
  tabBar?: boolean;
  iosOffset?: number;
  style?: ViewStyle;
}

/**
 * Keeps the focused input above the keyboard on both platforms.
 *
 * Android runs edge-to-edge, so the system no longer resizes the window for the
 * keyboard and KeyboardAvoidingView does nothing there. Instead the screen is
 * padded by the keyboard height (less the tab bar, which sits under the keyboard
 * anyway).
 */
export function KeyboardScreen({ children, tabBar = false, iosOffset = 0, style }: KeyboardScreenProps) {
  const insets = useSafeAreaInsets();
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    if (Platform.OS !== "android") return;
    const show = Keyboard.addListener("keyboardDidShow", (e) => setKeyboardHeight(e.endCoordinates.height));
    const hide = Keyboard.addListener("keyboardDidHide", () => setKeyboardHeight(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  if (Platform.OS === "ios") {
    return (
      <KeyboardAvoidingView behavior="padding" keyboardVerticalOffset={iosOffset} style={[styles.flex, style]}>
        {children}
      </KeyboardAvoidingView>
    );
  }

  const tabHeight = tabBar ? BottomTabHeight + insets.bottom : 0;
  const lift = Math.max(0, keyboardHeight - tabHeight);
  return <View style={[styles.flex, style, { paddingBottom: lift }]}>{children}</View>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
});
