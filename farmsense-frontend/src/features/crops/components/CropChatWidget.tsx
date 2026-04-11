import React, { useState } from "react";
import { useAuthStore } from "../../../store/authStore";
import axios from "axios";

interface CropChatWidgetProps {
  cropId: string;
}

export default function CropChatWidget({ cropId }: CropChatWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<{ role: "user" | "ai"; text: string }[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const token = useAuthStore((state) => state.accessToken);

  const toggleChat = () => setIsOpen(!isOpen);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !token) return;

    const userMessage = input.trim();
    setMessages((prev) => [...prev, { role: "user", text: userMessage }]);
    setInput("");
    setLoading(true);

    try {
      const response = await axios.post(
        "http://localhost:8000/chat",
        {
          message: userMessage,
          crop_id: cropId,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      setMessages((prev) => [
        ...prev,
        { role: "ai", text: response.data.reply },
      ]);
    } catch (error) {
      console.error(error);
      setMessages((prev) => [
        ...prev,
        { role: "ai", text: "Sorry, I couldn't process your request." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Floating Action Button */}
      <button
        onClick={toggleChat}
        className="fixed bottom-6 right-6 bg-green-600 text-white p-4 rounded-full shadow-lg hover:bg-green-700 transition z-50 flex items-center justify-center"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
          className="w-6 h-6"
        >
          {isOpen ? (
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          )}
        </svg>
      </button>

      {/* Chat Window */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 w-96 max-w-[90vw] bg-white rounded-2xl shadow-xl border border-gray-200 z-50 overflow-hidden flex flex-col h-[500px] max-h-[70vh]">
          <div className="bg-green-600 p-4 text-white font-semibold flex justify-between items-center">
            <span>Crop Assistant 🌾</span>
            <button onClick={toggleChat} className="text-white hover:text-green-200">
              ✖
            </button>
          </div>

          <div className="flex-1 p-4 overflow-y-auto bg-gray-50 flex flex-col gap-3">
            {messages.length === 0 && (
              <p className="text-gray-500 text-center text-sm mt-4">
                Ask me anything about your crop, fertilizers, or irrigation!
              </p>
            )}
            {messages.map((m, idx) => (
              <div
                key={idx}
                className={`max-w-[80%] p-3 rounded-lg text-sm ${
                  m.role === "user"
                    ? "bg-green-600 text-white self-end rounded-br-none"
                    : "bg-white text-gray-800 border border-gray-200 self-start rounded-bl-none shadow-sm whitespace-pre-wrap"
                }`}
              >
                {m.text}
              </div>
            ))}
            {loading && (
              <div className="bg-white text-gray-400 border border-gray-200 self-start rounded-bl-none shadow-sm p-3 rounded-lg text-sm italic">
                Thinking...
              </div>
            )}
          </div>

          <form onSubmit={handleSend} className="p-3 bg-white border-t flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about fertilizer, irrigation..."
              className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-500"
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading}
              className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-green-700 disabled:opacity-50 transition"
            >
              Send
            </button>
          </form>
        </div>
      )}
    </>
  );
}
