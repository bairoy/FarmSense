export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
};

export type ChatHistory = {
  messages: ChatMessage[];
  cropId: string;
};

export type ChatResponse = {
  reply: string;
  tools_used: string[];
  history: Array<{ role: string; content: string }>;
};
