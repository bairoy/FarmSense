import { api } from "../../services/api";
import type { CreateFieldPayload } from "./field.types";

export const getFields = () => api.get("/fields");

export const getFieldById = (id: string) =>
  api.get(`/fields/${id}`);

export const createField = (data: CreateFieldPayload) =>
  api.post("/fields", data);

export const updateField = (id: string, data: CreateFieldPayload) =>
  api.put(`/fields/${id}`, data);

export const deleteField = (id: string) =>
  api.delete(`/fields/${id}`);
