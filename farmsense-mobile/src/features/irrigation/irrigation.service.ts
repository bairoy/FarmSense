import { api } from "@/lib/api";
import type { CreateIrrigationPayload, IrrigationAction } from "./irrigation.types";

export const getIrrigationByCrop = async (cropId: string) => {
  const { data } = await api.get<IrrigationAction[]>(`/irrigation/${cropId}`);
  return data;
};

export const createIrrigation = async (payload: CreateIrrigationPayload) => {
  const { data } = await api.post<IrrigationAction>("/irrigation", payload);
  return data;
};
