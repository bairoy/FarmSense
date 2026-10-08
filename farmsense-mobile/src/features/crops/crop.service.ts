import { api } from "@/lib/api";
import type { CreateCropPayload, CropInstance } from "./crop.types";

export const getCropsByField = async (fieldId: string) => {
  const { data } = await api.get<CropInstance[]>(`/crops/field/${fieldId}`);
  return data;
};

export const getCropById = async (cropId: string) => {
  const { data } = await api.get<CropInstance>(`/crops/${cropId}`);
  return data;
};

export const createCrop = async (payload: CreateCropPayload) => {
  const { data } = await api.post<CropInstance>("/crops", payload);
  return data;
};
