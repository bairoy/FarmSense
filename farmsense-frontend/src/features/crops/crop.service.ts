import {api} from "../../services/api"
import type { Crop, CreateCropPayload, UpdateCropPayload } from "./crop.types";

export const createCrop = async (data: CreateCropPayload): Promise<Crop> => {
  const res = await api.post("/crops", data);
  return res.data;
};

export const getCropsByField = async (fieldId: string): Promise<Crop[]> => {
  const res = await api.get(`/crops/field/${fieldId}`);
  return res.data;
};

export const getCropById = async (cropId: string): Promise<Crop> => {
  const res = await api.get(`/crops/${cropId}`);
  return res.data;
};

export const updateCrop = async (
  cropId: string,
  data: UpdateCropPayload
): Promise<Crop> => {
  const res = await api.put(`/crops/${cropId}`, data);
  return res.data;
};

export const deleteCrop = async (cropId: string) => {
  const res = await api.delete(`/crops/${cropId}`);
  return res.data;
};
export const getCurrentCropState = async (cropId: string) => {
  const res = await api.get(`/crop-states/${cropId}/current`);
  return res.data;
};

export const getCropTimeline = async (cropId: string) => {
  const res = await api.get(`/crop-states/timeline/${cropId}`);
  return res.data;
};