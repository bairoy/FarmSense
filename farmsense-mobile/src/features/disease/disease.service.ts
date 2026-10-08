import { api } from "@/lib/api";
import type { AnalysisResult, CropImage } from "./disease.types";

/**
 * Uploads a leaf photo for diagnosis from a local file URI (camera capture or
 * picker result), mirroring the web client's multipart pattern.
 */
export const analyseCropImage = async (
  cropId: string,
  photoUri: string,
  takenOn: string,
  clientRequestId?: string,
  onProgress?: (pct: number) => void
): Promise<AnalysisResult> => {
  const form = new FormData();
  form.append("file", {
    uri: photoUri,
    name: "leaf.jpg",
    type: "image/jpeg",
  } as unknown as Blob);
  form.append("taken_on", takenOn);
  if (clientRequestId) form.append("client_request_id", clientRequestId);

  const { data } = await api.post<AnalysisResult>(`/disease/crop/${cropId}/analyse`, form, {
    headers: { "Content-Type": "multipart/form-data" },
    // Inference on CPU takes a few seconds; the default timeout is too short
    // for a large photo on a slow rural connection.
    timeout: 90_000,
    onUploadProgress: (event) => {
      if (onProgress && event.total) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    },
  });

  return data;
};

export const getCropImages = async (cropId: string) => {
  const { data } = await api.get<CropImage[]>(`/disease/crop/${cropId}/images`);
  return data;
};
