import axiosInstance from "@/config/axios-config";
import type { LanguageCode } from "@/schema/SeriesSchema";

import { getAuthHeaders } from "@/lib/auth-storage";
export interface TraditionMetadataDTO {
  id: string;
  language: string;
  name: string;
  description: string | null;
  other_names?: string[] | null;
}

export interface TraditionMetadataInput {
  language: LanguageCode;
  name: string;
  description?: string | null;
  other_names?: string[] | null;
}

export interface Tradition {
  id: string;
  code: string;
  regions: string[];
  parent_id: string | null;
  name: string;
  description: string | null;
  metadata: TraditionMetadataDTO[];
}

export interface TraditionsListResponse {
  traditions: Tradition[];
  skip: number;
  limit: number;
  total: number;
}

export interface TraditionPayload {
  code: string;
  regions?: string[];
  parent_id?: string | null;
  metadata: TraditionMetadataInput[];
}

export const fetchTraditions = async (
  page: number,
  limit: number,
  search: string,
): Promise<TraditionsListResponse> => {
  const skip = (page - 1) * limit;
  const { data } = await axiosInstance.get<TraditionsListResponse>(
    `/api/v1/cms/traditions`,
    {
      headers: getAuthHeaders(),
      params: {
        skip,
        limit,
        ...(search && { search }),
      },
    },
  );
  return data;
};

export const createTradition = async (
  payload: TraditionPayload,
): Promise<Tradition> => {
  const { data } = await axiosInstance.post<Tradition>(
    `/api/v1/cms/traditions`,
    payload,
    { headers: getAuthHeaders() },
  );
  return data;
};

export const updateTradition = async (
  traditionId: string,
  payload: TraditionPayload,
): Promise<Tradition> => {
  const { data } = await axiosInstance.put<Tradition>(
    `/api/v1/cms/traditions/${traditionId}`,
    payload,
    { headers: getAuthHeaders() },
  );
  return data;
};

export const deleteTradition = async (traditionId: string): Promise<void> => {
  await axiosInstance.delete(`/api/v1/cms/traditions/${traditionId}`, {
    headers: getAuthHeaders(),
  });
};
