import type { ChatMessage as ChatMessageType } from "../chat.types";

type Props = {
  message: ChatMessageType;
};

export function ChatMessage({ message }: Props) {
  const isUser = message.role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
          isUser
            ? "rounded-br-md bg-field-700 text-white"
            : "rounded-bl-md bg-clay-100 text-clay-800"
        }`}
      >
        <div className="leading-relaxed break-words whitespace-pre-wrap">
          {message.content}
        </div>
        <time
          className={`mt-1.5 block text-[11px] ${
            isUser ? "text-field-200" : "text-clay-400"
          }`}
        >
          {new Date(message.timestamp).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </time>
      </div>
    </div>
  );
}
