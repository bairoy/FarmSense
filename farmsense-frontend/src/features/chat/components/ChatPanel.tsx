import { useState, useRef, useEffect } from "react";
import { useChatHistory } from "../useChatHistory";
import { sendChatMessage } from "../chat.service";
import { ChatMessage } from "./ChatMessage";
import { ChatInput } from "./ChatInput";

type Props = {
  cropId: string;
  isOpen: boolean;
  onClose: () => void;
};

export function ChatPanel({ cropId, isOpen, onClose }: Props) {
  const { messages, addMessage, clearHistory, getApiHistory } =
    useChatHistory(cropId);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async (message: string) => {
    setError(null);

    // Add user message immediately
    addMessage({
      role: "user",
      content: message,
      timestamp: Date.now(),
    });

    setLoading(true);

    try {
      const response = await sendChatMessage(message, cropId, getApiHistory());

      addMessage({
        role: "assistant",
        content: response.reply,
        timestamp: Date.now(),
      });
    } catch (err: any) {
      const errorMsg =
        err.response?.data?.error ||
        err.message ||
        "Failed to send message. Please try again.";
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed bottom-20 right-4 w-[360px] max-w-[calc(100vw-2rem)] h-[500px] max-h-[calc(100vh-8rem)] bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col z-50">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-green-600 rounded-t-2xl">
        <div className="flex items-center gap-2">
          <span className="text-lg">🌾</span>
          <h3 className="font-semibold text-white">Crop Assistant</h3>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={clearHistory}
            className="p-1.5 text-green-100 hover:text-white hover:bg-green-700 rounded-lg transition"
            title="Clear history"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="w-4 h-4"
            >
              <path
                fillRule="evenodd"
                d="M8.75 1A2.75 2.75 0 0 0 6 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 1 0 .23 1.482l.149-.022.841 10.518A2.75 2.75 0 0 0 7.596 19h4.807a2.75 2.75 0 0 0 2.742-2.53l.841-10.52.149.023a.75.75 0 0 0 .23-1.482A41.03 41.03 0 0 0 14 4.193V3.75A2.75 2.75 0 0 0 11.25 1h-2.5ZM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4ZM8.58 7.72a.75.75 0 0 0-1.5.06l.3 7.5a.75.75 0 1 0 1.5-.06l-.3-7.5Zm4.34.06a.75.75 0 1 0-1.5-.06l-.3 7.5a.75.75 0 1 0 1.5.06l.3-7.5Z"
                clipRule="evenodd"
              />
            </svg>
          </button>
          <button
            onClick={onClose}
            className="p-1.5 text-green-100 hover:text-white hover:bg-green-700 rounded-lg transition"
            title="Close"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="w-4 h-4"
            >
              <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <div className="text-center text-gray-500 text-sm py-8">
            <p className="mb-2">Ask me about your crop!</p>
            <p className="text-xs text-gray-400">
              Try: "How is my crop doing?" or "Should I irrigate?"
            </p>
          </div>
        )}
        {messages.map((msg, idx) => (
          <ChatMessage key={idx} message={msg} />
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 rounded-2xl rounded-bl-md px-4 py-3">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                <span
                  className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                  style={{ animationDelay: "0.1s" }}
                />
                <span
                  className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                  style={{ animationDelay: "0.2s" }}
                />
              </div>
            </div>
          </div>
        )}
        {error && (
          <div className="text-center text-red-500 text-sm py-2 px-4 bg-red-50 rounded-lg">
            {error}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <ChatInput onSend={handleSend} disabled={loading} />
    </div>
  );
}
