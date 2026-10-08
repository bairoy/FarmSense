import { useEffect, useRef, useState } from "react";
import { Sprout, Trash2, X } from "lucide-react";

import { useChatHistory } from "../useChatHistory";
import { sendChatMessage } from "../chat.service";
import { ChatMessage } from "./ChatMessage";
import { ChatInput } from "./ChatInput";
import { apiErrorMessage } from "../../../services/apiError";

type Props = {
  cropId: string;
  isOpen: boolean;
  onClose: () => void;
};

const QUICK_QUESTIONS = [
  "How is my crop doing?",
  "Should I irrigate?",
  "What fertilizer do I need?",
];

export function ChatPanel({ cropId, isOpen, onClose }: Props) {
  const { messages, addMessage, clearHistory, getApiHistory } =
    useChatHistory(cropId);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastToolsUsed, setLastToolsUsed] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  const handleSend = async (message: string) => {
    setError(null);
    setLastToolsUsed([]);

    addMessage({ role: "user", content: message, timestamp: Date.now() });
    setLoading(true);

    try {
      const response = await sendChatMessage(message, cropId, getApiHistory());

      setLastToolsUsed(response.tools_used || []);
      addMessage({
        role: "assistant",
        content: response.reply,
        timestamp: Date.now(),
      });
    } catch (err) {
      setError(
        apiErrorMessage(
          err,
          err instanceof Error && err.message
            ? err.message
            : "Failed to send message. Please try again."
        )
      );
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    // On a phone this is a sheet filling the lower screen, not a 360px card
    // floating over content it is too small to cover.
    <div
      role="dialog"
      aria-label="Crop assistant"
      className="fixed inset-x-0 bottom-0 z-60 flex h-[72dvh] flex-col rounded-t-2xl border border-clay-200 bg-white shadow-float sm:inset-x-auto sm:bottom-24 sm:right-6 sm:h-[540px] sm:w-96 sm:rounded-2xl"
    >
      <header className="flex items-center justify-between gap-2 rounded-t-2xl bg-field-700 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/15">
            <Sprout className="h-4 w-4 text-white" />
          </span>
          <div className="min-w-0">
            <h3 className="truncate font-bold text-white">Crop assistant</h3>
            <p className="truncate text-xs text-field-100">
              Answers come from your own field data
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <button
            onClick={clearHistory}
            title="Clear this conversation"
            aria-label="Clear this conversation"
            className="flex h-10 w-10 items-center justify-center rounded-lg text-field-100 transition-colors hover:bg-field-800 hover:text-white"
          >
            <Trash2 className="h-4 w-4" />
          </button>
          <button
            onClick={onClose}
            title="Close"
            aria-label="Close the crop assistant"
            className="flex h-10 w-10 items-center justify-center rounded-lg text-field-100 transition-colors hover:bg-field-800 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </header>

      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 && !loading && (
          <div className="py-4 text-center">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-field-100 text-field-700">
              <Sprout className="h-6 w-6" />
            </span>
            <p className="mt-3 font-bold text-clay-900">Ask about this crop</p>
            <p className="mx-auto mt-1 max-w-xs text-sm text-clay-500">
              Every number in an answer comes back from your field&rsquo;s own
              data, not from the model&rsquo;s memory.
            </p>

            <div className="mt-4 space-y-2">
              {QUICK_QUESTIONS.map((question) => (
                <button
                  key={question}
                  onClick={() => handleSend(question)}
                  className="w-full rounded-xl border border-field-200 bg-field-50 px-3 py-2.5 text-left text-sm font-medium text-field-800 transition-colors hover:border-field-400 hover:bg-field-100"
                >
                  {question}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((message, index) => (
          <ChatMessage key={index} message={message} />
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="rounded-2xl rounded-bl-md bg-clay-100 px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="flex gap-1">
                  {[0, 0.15, 0.3].map((delay) => (
                    <span
                      key={delay}
                      className="h-2 w-2 animate-bounce rounded-full bg-clay-400"
                      style={{ animationDelay: `${delay}s` }}
                    />
                  ))}
                </div>
                <span className="text-xs text-clay-500">Checking your crop...</span>
              </div>
            </div>
          </div>
        )}

        {error && (
          <p
            role="alert"
            className="rounded-xl border border-alert-200 bg-alert-50 px-3 py-2 text-center text-sm text-alert-800"
          >
            {error}
          </p>
        )}

        {/* Which backend tools produced the answer. This is the grounding rule
            made visible: the assistant explains, it never originates. */}
        {lastToolsUsed.length > 0 && messages.length > 0 && !loading && (
          <p className="text-center">
            <span className="rounded-full bg-clay-100 px-2.5 py-1 text-[11px] text-clay-500">
              Checked: {lastToolsUsed.map((t) => t.replace(/_/g, " ")).join(", ")}
            </span>
          </p>
        )}

        <div ref={messagesEndRef} />
      </div>

      <ChatInput onSend={handleSend} disabled={loading} />
    </div>
  );
}
