import axiosInstance from "@/config/axios-config";

import { getAuthHeaders } from "@/lib/auth-storage";
export interface PresetRequest {
  version_id: string;
  language: string;
}

export interface PresetResponse {
  id: string;
  subtask_id: string;
  version_id: string;
  language: string;
  created_at: string;
  created_by: string;
  updated_at?: string;
  updated_by?: string;
}

export const createOrUpdatePreset = async (
  subtaskId: string,
  preset: PresetRequest,
): Promise<PresetResponse> => {
  const { data } = await axiosInstance.post(
    `/api/v1/cms/sub-tasks/${subtaskId}/preset`,
    preset,
    {
      headers: getAuthHeaders(),
    },
  );
  return data;
};

export const getPreset = async (
  subtaskId: string,
): Promise<PresetResponse | null> => {
  try {
    const { data } = await axiosInstance.get(
      `/api/v1/cms/sub-tasks/${subtaskId}/preset`,
      {
        headers: getAuthHeaders(),
      },
    );
    return data;
  } catch (error: any) {
    if (error.response?.status === 404) {
      return null;
    }
    throw error;
  }
};

export const deletePreset = async (subtaskId: string): Promise<void> => {
  await axiosInstance.delete(`/api/v1/cms/sub-tasks/${subtaskId}/preset`, {
    headers: getAuthHeaders(),
  });
};
