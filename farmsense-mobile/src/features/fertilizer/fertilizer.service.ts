import { api } from "@/lib/api";
import type { CreateFertilizerPayload, FertilizerAction } from "./fertilizer.types";

export const getFertilizerByCrop = async (cropId: string) => {
  const { data } = await api.get<FertilizerAction[]>(`/fertilizer/${cropId}`);
  return data;
};

export const createFertilizer = async (payload: CreateFertilizerPayload) => {
  const { data } = await api.post<FertilizerAction>("/fertilizer", payload);
  return data;
};
