import { api } from "@/lib/api";
import type { AnswerCheckinResponse, Checkin, DueCheckinResponse } from "./checkin.types";

export const getDueCheckin = async (cropId: string) => {
  const { data } = await api.get<DueCheckinResponse>(`/checkins/crop/${cropId}/due`);
  return data;
};

export const getCheckinHistory = async (cropId: string) => {
  const { data } = await api.get<Checkin[]>(`/checkins/crop/${cropId}/history`);
  return data;
};

export const answerCheckin = async (checkinId: string, answer: string) => {
  const { data } = await api.post<AnswerCheckinResponse>(`/checkins/${checkinId}/answer`, {
    answer,
  });
  return data;
};
