import { api } from "../../services/api";
import type { AnalysisResult, CropImage } from "./disease.types";

/**
 * Uploads a leaf photo for diagnosis.
 *
 * The raw file goes up as-is; compression happens server-side in the AI
 * service, which decodes the image once and hands the same pixels to both the
 * model and R2. Compressing in the browser would mean the archived image and
 * the classified image are not provably identical.
 */
export const analyseCropImage = async (
  cropId: string,
  file: File,
  onProgress?: (pct: number) => void
): Promise<AnalysisResult> => {
  const form = new FormData();
  form.append("file", file);

  const { data } = await api.post<AnalysisResult>(
    `/disease/crop/${cropId}/analyse`,
    form,
    {
      headers: { "Content-Type": "multipart/form-data" },
      // Inference on CPU takes a few seconds; the default timeout is too short
      // for a large photo on a slow rural connection.
      timeout: 90_000,
      onUploadProgress: (event) => {
        if (onProgress && event.total) {
          onProgress(Math.round((event.loaded / event.total) * 100));
        }
      },
    }
  );

  return data;
};

export const getCropImages = async (cropId: string): Promise<CropImage[]> => {
  const { data } = await api.get<CropImage[]>(`/disease/crop/${cropId}/images`);
  return data;
};
