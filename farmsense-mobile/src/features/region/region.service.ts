import { api } from "@/lib/api";
import type { RegionInfo } from "./region.types";

export const getRegion = async () => {
  const { data } = await api.get<RegionInfo>("/region");
  return data;
};
