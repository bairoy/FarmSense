import axios from "axios";
import type { Request, Response } from "../../types/http.ts";
import { env } from "../../config/env.ts";
import { ValidationError } from "../../utils/errors.ts";

type ChatRequestBody = {
  message: string;
  crop_id: string;
  history?: Array<{ role: string; content: string }>;
};

export const chatHandler = async (req: Request, res: Response) => {
  const { message, crop_id, history } = req.body as ChatRequestBody;

  if (!message || !crop_id) {
    throw new ValidationError("message and crop_id are required");
  }

  if (!env.aiServiceToken) {
    return res.status(503).json({
      error: "Chat is not configured. AI_SERVICE_TOKEN is not set.",
    });
  }

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
        // A hosted model answers in seconds; a local one on consumer hardware
        // takes minutes, because a ReAct turn is several full generations -
        // decide to call a tool, read the result, decide again, then write the
        // answer. 60s was tuned for OpenAI and silently converted every local
        // reply into "Chat service unavailable".
        timeout: env.chatTimeoutMs,
      }
    );

    res.json(data);
  } catch (err: any) {
    const timedOut = err.code === "ECONNABORTED";
    console.error("Chat proxy error:", err.response?.data || err.message);

    if (timedOut) {
      // Distinguish "still thinking" from "broken". Telling a farmer the
      // service is unavailable when the model simply needs longer sends them
      // to an extension officer for no reason.
      return res.status(504).json({
        error:
          "The assistant is taking longer than usual to answer. Please try again in a moment.",
      });
    }

    const status = err.response?.status || 500;
    const errorMsg =
      err.response?.data?.detail ||
      err.response?.data?.error ||
      "Chat service unavailable";

    res.status(status).json({ error: errorMsg });
  }
};
