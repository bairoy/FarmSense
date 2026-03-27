import { api } from "../../services/api";
import type { CreateFertilizerPayload } from "./fertilizer.types";

export const createFertilizer = (data: CreateFertilizerPayload) =>
  api.post("/fertilizer", data);

export const getFertilizerHistory = (cropId: string) =>
  api.get(`/fertilizer/${cropId}`);

export const deleteFertilizer = (id: string) =>
  api.delete(`/fertilizer/${id}`);