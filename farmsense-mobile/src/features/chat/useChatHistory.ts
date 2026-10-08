import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useState } from "react";

import type { ChatMessage } from "./chat.types";

const MAX_HISTORY = 20;

/** Per-crop chat history, persisted locally so it survives an app restart. */
export function useChatHistory(cropId: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const storageKey = `chat-history-${cropId}`;

  useEffect(() => {
    AsyncStorage.getItem(storageKey).then((raw) => {
      if (raw) setMessages(JSON.parse(raw));
    });
  }, [storageKey]);

  const persistAndReturn = useCallback(
    (next: ChatMessage[]) => {
      const trimmed = next.slice(-MAX_HISTORY);
      AsyncStorage.setItem(storageKey, JSON.stringify(trimmed));
      return trimmed;
    },
    [storageKey]
  );

  // Functional setState: `send()` in the chat screen calls addMessage twice in
  // one invocation (user message, then — after awaiting the API response —
  // the assistant's reply). A plain closure over `messages` would have both
  // calls see the same pre-update snapshot, so the second call would overwrite
  // the first message instead of appending after it.
  const addMessage = useCallback(
    (message: ChatMessage) => {
      setMessages((prev) => persistAndReturn([...prev, message]));
    },
    [persistAndReturn]
  );

  const clearHistory = useCallback(() => {
    setMessages(persistAndReturn([]));
  }, [persistAndReturn]);

  return { messages, addMessage, clearHistory };
}
