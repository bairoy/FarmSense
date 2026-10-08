import { useEffect, useRef, useState } from "react";
import { SendHorizontal } from "lucide-react";

type Props = {
  onSend: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
};

export function ChatInput({
  onSend,
  disabled = false,
  placeholder = "Ask about your crop...",
}: Props) {
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
    }
  }, [input]);

  const handleSubmit = () => {
    const trimmed = input.trim();
    if (!trimmed || disabled) return;

    onSend(trimmed);
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div
      className="flex items-end gap-2 border-t border-clay-200 bg-white p-3"
      style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}
    >
      <textarea
        ref={textareaRef}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        aria-label="Your question"
        disabled={disabled}
        rows={1}
        className="flex-1 resize-none rounded-xl border border-clay-300 px-3 py-2.5 text-base text-clay-900 placeholder:text-clay-400 focus:border-field-500 focus:outline-none focus:ring-4 focus:ring-field-500/15 disabled:bg-clay-100"
      />
      <button
        onClick={handleSubmit}
        disabled={disabled || !input.trim()}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-field-700 text-white transition-colors hover:bg-field-800 disabled:bg-clay-300"
        aria-label="Send message"
      >
        <SendHorizontal className="h-5 w-5" />
      </button>
    </div>
  );
}
