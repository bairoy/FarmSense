import NetInfo from "@react-native-community/netinfo";
import { useEffect } from "react";
import { AppState } from "react-native";

import { flushOutbox } from "@/lib/outbox";
import { useOutboxStore } from "@/store/outboxStore";

/**
 * Drains the offline outbox whenever connectivity returns or the app comes
 * back to the foreground. Mounted once at the root so it runs regardless of
 * which screen is active.
 */
export const useOutboxFlush = (enabled: boolean) => {
  useEffect(() => {
    if (!enabled) return;

    useOutboxStore.getState().refresh();

    let wasConnected = true;

    const netUnsubscribe = NetInfo.addEventListener((state) => {
      const isConnected = Boolean(state.isConnected && state.isInternetReachable !== false);
      if (isConnected && !wasConnected) {
        flushOutbox();
      }
      wasConnected = isConnected;
    });

    const appStateSubscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") {
        flushOutbox();
      }
    });

    flushOutbox();

    return () => {
      netUnsubscribe();
      appStateSubscription.remove();
    };
  }, [enabled]);
};
