import axios from "axios";
import type { Request, Response } from "../../types/http.ts";
import { env } from "../../config/env.ts";

type ChatRequestBody = {
  message: string;
  crop_id: string;
  history?: Array<{ role: string; content: string }>;
};

/**
 * Proxies chat requests to the AI service.
 *
 * The backend sits between the frontend and the AI service for two reasons:
 * 1. The AI service is authenticated with AI_SERVICE_TOKEN (service-to-service)
 * 2. The user's Supabase token is forwarded in X-User-Token so tools can
 *    call backend endpoints as that user, preserving ownership checks.
 */
export const chatHandler = async (req: Request, res: Response) => {
  const { message, crop_id, history } = req.body as ChatRequestBody;

  if (!message || !crop_id) {
    return res.status(400).json({ error: "message and crop_id are required" });
  }

  if (!env.aiServiceToken) {
    return res.status(503).json({
      error: "Chat is not configured. AI_SERVICE_TOKEN is not set.",
    });
  }

  // The user's own Supabase token, extracted by requireAuth middleware
  const userToken = req.headers.authorization?.replace("Bearer ", "");

  try {
    const { data } = await axios.post(
      `${env.aiServiceUrl}/chat`,
      { message, crop_id, history },
      {
        headers: {
          Authorization: `Bearer ${env.aiServiceToken}`,
          "X-User-Token": userToken,
          "Content-Type": "application/json",
        },
        timeout: 60_000, // Chat can take a while with multiple tool calls
      }
    );

    res.json(data);
  } catch (err: any) {
    console.error("Chat proxy error:", err.response?.data || err.message);

    const status = err.response?.status || 500;
    const message =
      err.response?.data?.detail ||
      err.response?.data?.error ||
      "Chat service unavailable";

    res.status(status).json({ error: message });
  }
};
