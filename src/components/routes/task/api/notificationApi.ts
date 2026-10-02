import axiosInstance from "@/config/axios-config";

import { getAuthHeaders } from "@/lib/auth-storage";
export interface NotificationResponse {
  id: string;
  day_id: string;
  title: string;
  body: string;
  image_type: "PLAN" | "CUSTOM" | null;
  image_url: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface NotificationPayload {
  title: string;
  body: string;
  image_type: "PLAN" | "CUSTOM" | null;
  image_url: string | null;
}

export const getNotification = async (
  day_id: string,
): Promise<NotificationResponse | null> => {
  try {
    const { data } = await axiosInstance.get<NotificationResponse>(
      `/api/v1/cms/notifications/${day_id}`,
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

export const createNotification = async (
  day_id: string,
  payload: NotificationPayload,
): Promise<NotificationResponse> => {
  const { data } = await axiosInstance.post<NotificationResponse>(
    `/api/v1/cms/notifications/${day_id}`,
    payload,
    {
      headers: getAuthHeaders(),
    },
  );
  return data;
};

export const updateNotification = async (
  day_id: string,
  payload: NotificationPayload,
): Promise<NotificationResponse> => {
  const { data } = await axiosInstance.put<NotificationResponse>(
    `/api/v1/cms/notifications/${day_id}`,
    payload,
    {
      headers: getAuthHeaders(),
    },
  );
  return data;
};

export const deleteNotification = async (day_id: string): Promise<void> => {
  await axiosInstance.delete(`/api/v1/cms/notifications/${day_id}`, {
    headers: getAuthHeaders(),
  });
};
