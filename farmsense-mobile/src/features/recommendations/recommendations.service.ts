import { api } from "@/lib/api";
import type { FusedCropState, RecommendationsBundle } from "./recommendations.types";

export const getCropState = async (cropId: string) => {
  const { data } = await api.get<FusedCropState>(`/recommendations/${cropId}/state`);
  return data;
};

export const getRecommendations = async (cropId: string) => {
  const { data } = await api.get<RecommendationsBundle>(`/recommendations/${cropId}`);
  return data;
};
