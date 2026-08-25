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
            ? "bg-green-600 text-white rounded-br-md"
            : "bg-gray-100 text-gray-800 rounded-bl-md"
        }`}
      >
        <div className="whitespace-pre-wrap break-words leading-relaxed">
          {message.content}
        </div>
        <p
          className={`text-[10px] mt-1.5 ${
            isUser ? "text-green-200" : "text-gray-400"
          }`}
        >
          {new Date(message.timestamp).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
      </div>
    </div>
  );
}
