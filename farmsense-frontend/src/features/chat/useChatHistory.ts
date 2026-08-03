import { useState, useEffect, useCallback } from "react";
import type { ChatMessage } from "./chat.types";

const STORAGE_KEY_PREFIX = "farmsense_chat_";

/**
 * Hook to manage chat history in sessionStorage.
 *
 * - History persists across page refreshes (sessionStorage)
 * - History is cleared when the browser tab/window closes
 * - Each crop has its own history
 */
export function useChatHistory(cropId: string) {
  const storageKey = `${STORAGE_KEY_PREFIX}${cropId}`;

  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const stored = sessionStorage.getItem(storageKey);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  // Persist to sessionStorage whenever messages change
  useEffect(() => {
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(messages));
    } catch {
      // sessionStorage might be full or unavailable
    }
  }, [messages, storageKey]);

  const addMessage = useCallback((message: ChatMessage) => {
    setMessages((prev) => [...prev, message]);
  }, []);

  const clearHistory = useCallback(() => {
    setMessages([]);
    try {
      sessionStorage.removeItem(storageKey);
    } catch {
      // Ignore storage errors
    }
  }, [storageKey]);

  // Convert to API format (without timestamps, includes tool messages if needed)
  const getApiHistory = useCallback((): Array<{ role: string; content: string }> => {
    return messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));
  }, [messages]);

  return {
    messages,
    addMessage,
    clearHistory,
    getApiHistory,
  };
}
