import { api } from "@/lib/api";
import type { ChatMessage, ChatResponse } from "./chat.types";

export const sendChatMessage = async (
  message: string,
  cropId: string,
  history: { role: string; content: string }[]
) => {
  const { data } = await api.post<ChatResponse>(
    "/chat",
    { message, crop_id: cropId, history },
    // A hosted model answers in seconds; a local one can take minutes.
    { timeout: 120_000 }
  );
  return data;
};

export const toApiHistory = (messages: ChatMessage[]) =>
  messages.map(({ role, content }) => ({ role, content }));
