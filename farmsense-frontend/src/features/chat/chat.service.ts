import { api } from "../../services/api";
import type { ChatResponse } from "./chat.types";

type ApiHistory = Array<{ role: string; content: string }>;

export const sendChatMessage = async (
  message: string,
  cropId: string,
  history?: ApiHistory
): Promise<ChatResponse> => {
  const { data } = await api.post<ChatResponse>("/chat", {
    message,
    crop_id: cropId,
    history,
  });
  return data;
};
