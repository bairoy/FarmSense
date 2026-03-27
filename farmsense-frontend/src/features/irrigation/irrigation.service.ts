import { api } from "../../services/api";
import type { CreateIrrigationPayload } from "./irrigation.types";

export const createIrrigation = (data: CreateIrrigationPayload) =>
  api.post("/irrigation", data);

export const getIrrigationHistory = (cropId: string) =>
  api.get(`/irrigation/${cropId}`);

export const deleteIrrigation = (id: string) =>
  api.delete(`/irrigation/${id}`);