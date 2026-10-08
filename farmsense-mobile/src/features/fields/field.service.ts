import { api } from "@/lib/api";
import type { CreateFieldPayload, Field } from "./field.types";

export const getFields = async () => {
  const { data } = await api.get<Field[]>("/fields");
  return data;
};

export const getFieldById = async (id: string) => {
  const { data } = await api.get<Field>(`/fields/${id}`);
  return data;
};

export const createField = async (payload: CreateFieldPayload) => {
  const { data } = await api.post<Field>("/fields", payload);
  return data;
};
