import axios from "axios";
import FormData from "form-data";
import { env } from "../config/env.ts";

export type DiseasePrediction = {
  disease: string;
  confidence: number;
  margin: number;
  probabilities: Record<string, number>;
  actionable: boolean;
  confidence_gate: number;
  original_bytes: number;
  stored_bytes: number;
  /** The compressed JPEG the AI service produced, ready to persist. */
  image: Buffer;
  /**
   * Grad-CAM++ overlay (JPEG, base64): where in the photo the evidence for the
   * predicted class came from. Shown to the farmer, never stored.
   */
  heatmap_b64: string | null;
};

/**
 * Calls the Python inference service.
 *
 * The service is internal and authenticated with a shared secret. Note this
 * is service-to-service auth and is entirely separate from the farmer's
 * Supabase session - the AI service has no idea who the user is, and does not
 * need to. User authorisation is settled in the backend before we get here.
 */
export const classifyCropImage = async (
  buffer: Buffer,
  filename: string
): Promise<DiseasePrediction> => {
  if (!env.aiServiceToken) {
    throw new Error(
      "AI_SERVICE_TOKEN is not set; refusing to call the inference service."
    );
  }

  const form = new FormData();
  form.append("file", buffer, filename);

  const { data } = await axios.post(
    `${env.aiServiceUrl}/detect-disease?heatmap=true`,
    form,
    {
      headers: {
        ...form.getHeaders(),
        Authorization: `Bearer ${env.aiServiceToken}`,
      },
      timeout: 30_000,
      // A phone photo can be several MB; the default axios body cap would
      // reject the base64-encoded response.
      maxBodyLength: 32 * 1024 * 1024,
      maxContentLength: 32 * 1024 * 1024,
    }
  );

  const { image_b64, heatmap_b64, ...prediction } = data;

  return {
    ...prediction,
    image: Buffer.from(image_b64, "base64"),
    heatmap_b64: heatmap_b64 ?? null,
  };
};

/** Identifier the AI service reports from /health. Must match ai/api.py. */
const AI_SERVICE_ID = "farmsense-ai";

/**
 * Checks the AI service is reachable AND is actually ours.
 *
 * Verifying the service identifier is not paranoia. A 200 on /health is a
 * near-universal convention, so a status-only check is satisfied by whatever
 * else happens to hold that port - during commissioning a Docker container on
 * the same port made this report healthy while disease detection was in fact
 * unreachable. A health check that can be satisfied by the wrong process is
 * worse than no health check, because it converts a loud failure into a silent
 * one.
 */
export const aiServiceHealthy = async (): Promise<boolean> => {
  try {
    const { status, data } = await axios.get(`${env.aiServiceUrl}/health`, {
      timeout: 3000,
    });
    return status === 200 && data?.service === AI_SERVICE_ID;
  } catch {
    return false;
  }
};
