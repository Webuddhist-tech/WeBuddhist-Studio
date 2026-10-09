import axiosInstance from "@/config/axios-config";

import { getAuthHeaders } from "@/lib/auth-storage";
export interface CmsPlanSummary {
  id: string;
  title: string;
  language: string;
  total_days: number;
}

export interface CmsPlansResponse {
  plans: CmsPlanSummary[];
  skip: number;
  limit: number;
  total: number;
}

export const searchCmsPlans = async (params?: {
  search?: string;
  skip?: number;
  limit?: number;
}) => {
  const { data } = await axiosInstance.get<CmsPlansResponse>(
    `/api/v1/cms/plans`,
    {
      params: {
        search: params?.search?.trim() || undefined,
        skip: params?.skip ?? 0,
        limit: params?.limit ?? 10,
      },
      headers: getAuthHeaders(),
    },
  );
  return data;
};

export const fetchPlanDetails = async (plan_id: string) => {
  const { data } = await axiosInstance.get(`/api/v1/cms/plans/${plan_id}`, {
    headers: getAuthHeaders(),
  });
  return data;
};

export const fetchPlanDays = async (plan_id: string) => {
  const { data } = await axiosInstance.get(
    `/api/v1/cms/plans/${plan_id}/days`,
    {
      headers: getAuthHeaders(),
    },
  );
  return data;
};

export interface CreateDaysRequest {
  number_of_days?: number;
  source_day_id?: string;
  cascade?: boolean;
}

export interface DayDTO {
  id: string;
  day_number: number;
  tasks: Record<string, unknown>[];
}

export const createNewDays = async (
  plan_id: string,
  body?: CreateDaysRequest,
) => {
  const { data } = await axiosInstance.post<DayDTO[]>(
    `/api/v1/cms/plans/${plan_id}/days`,
    body ?? {},
    {
      headers: getAuthHeaders(),
    },
  );
  return data;
};

export const deleteDays = async (plan_id: string, day_ids: string[]) => {
  await axiosInstance.delete(`/api/v1/cms/plans/${plan_id}/days`, {
    data: { day_ids },
    headers: getAuthHeaders(),
  });
};

export const deleteTask = async (task_id: string) => {
  const { data } = await axiosInstance.delete(`/api/v1/cms/tasks/${task_id}`, {
    headers: getAuthHeaders(),
  });
  return data;
};

export const reorderDays = async (
  plan_id: string,
  days: Array<{ id: string; day_number: number }>,
) => {
  const { data } = await axiosInstance.put(
    `/api/v1/cms/plans/${plan_id}/reorder-days`,
    {
      days,
    },
    {
      headers: getAuthHeaders(),
    },
  );
  return data;
};

export interface PlanDayAudioUploadResponse {
  plan_item_id: string;
  audio_key: string;
  audio_url: string;
  duration_ms: number | null;
  message: string;
}

export interface PlanAudioDTO {
  id: string;
  audio_key: string;
  file_name: string;
  audio_url: string;
  duration_ms: number | null;
  mime_type: string | null;
  file_size_bytes: number | null;
  plan_item_id: string;
  plan_id: string;
  day_number: number;
  created_at: string;
}

export interface PlanAudioListResponse {
  audio: PlanAudioDTO[];
  skip: number;
  limit: number;
  total: number;
}

export const fetchPlanAudioList = async (params?: {
  search?: string;
  plan_id?: string;
  skip?: number;
  limit?: number;
}) => {
  const { data } = await axiosInstance.get<PlanAudioListResponse>(
    `/api/v1/cms/plans/audio`,
    {
      params: {
        search: params?.search?.trim() || undefined,
        plan_id: params?.plan_id || undefined,
        skip: params?.skip ?? 0,
        limit: params?.limit ?? 10,
      },
      headers: getAuthHeaders(),
    },
  );
  return data;
};

export const uploadDayAudio = async (
  day_id: string,
  file: File,
  duration_ms?: number,
) => {
  const formData = new FormData();
  formData.append("file", file);
  if (duration_ms != null) {
    formData.append("duration_ms", String(duration_ms));
  }
  const { data } = await axiosInstance.post<PlanDayAudioUploadResponse>(
    `/api/v1/cms/media/upload/day-audio`,
    formData,
    {
      params: { day_id },
      headers: getAuthHeaders(),
    },
  );
  return data;
};

export const attachDayAudio = async (
  day_id: string,
  audio_key: string,
  duration_ms?: number | null,
) => {
  const { data } = await axiosInstance.patch<PlanDayAudioUploadResponse>(
    `/api/v1/cms/plans/days/${day_id}/audio`,
    {
      audio_key,
      ...(duration_ms != null ? { duration_ms } : {}),
    },
    { headers: getAuthHeaders() },
  );
  return data;
};

export const deleteDayAudio = async (day_id: string) => {
  await axiosInstance.delete(`/api/v1/cms/plans/days/${day_id}/audio`, {
    headers: getAuthHeaders(),
  });
};

export type DayShareableImageType = "thumbnail" | "shareable_image";

export interface PlanDayShareableImageUploadResponse {
  plan_item_id: string;
  image_type: DayShareableImageType;
  image_key: string;
  image_url: string;
  message: string;
}

export const uploadDayShareableImage = async (
  day_id: string,
  image_type: DayShareableImageType,
  file: File,
) => {
  const formData = new FormData();
  formData.append("file", file);
  const { data } =
    await axiosInstance.post<PlanDayShareableImageUploadResponse>(
      `/api/v1/cms/media/upload/day-shareable-image`,
      formData,
      {
        params: { day_id, image_type },
        headers: getAuthHeaders(),
      },
    );
  return data;
};

export const deleteDayShareableImage = async (
  day_id: string,
  image_type: DayShareableImageType,
) => {
  await axiosInstance.delete(
    `/api/v1/cms/plans/days/${day_id}/shareable-images/${image_type}`,
    { headers: getAuthHeaders() },
  );
};

export interface DayVideo {
  id: string;
  day_id: string;
  url: string;
  video_id: string | null;
  title: string | null;
  display_order: number;
  created_at: string;
}

export type DayVideoSummary = Pick<
  DayVideo,
  "id" | "url" | "video_id" | "title" | "display_order"
>;

export interface AddDayVideoPayload {
  url: string;
  title?: string | null;
}

export const addDayVideo = async (
  day_id: string,
  payload: AddDayVideoPayload,
) => {
  const { data } = await axiosInstance.post<DayVideo>(
    `/api/v1/cms/plans/days/${day_id}/videos`,
    payload,
    { headers: getAuthHeaders() },
  );
  return data;
};

export const deleteDayVideo = async (day_id: string, video_id: string) => {
  await axiosInstance.delete(
    `/api/v1/cms/plans/days/${day_id}/videos/${video_id}`,
    { headers: getAuthHeaders() },
  );
};

export const reorderDayVideos = async (
  day_id: string,
  videos: Array<{ id: string; display_order: number }>,
) => {
  const { data } = await axiosInstance.put<{ videos: DayVideo[] }>(
    `/api/v1/cms/plans/days/${day_id}/videos/order`,
    { videos },
    { headers: getAuthHeaders() },
  );
  return data.videos;
};

export interface PlanVideoDTO {
  id: string;
  plan_id: string;
  url: string;
  video_id: string | null;
  title: string | null;
  display_order: number;
  created_at: string | null;
}

export type PlanVideoSummary = Pick<
  PlanVideoDTO,
  "id" | "url" | "video_id" | "title" | "display_order"
>;

export interface AddPlanVideoPayload {
  url: string;
  title?: string | null;
}

export const fetchPlanVideos = async (plan_id: string) => {
  const { data } = await axiosInstance.get<{ videos: PlanVideoDTO[] }>(
    `/api/v1/cms/plans/${plan_id}/videos`,
    { headers: getAuthHeaders() },
  );
  return data.videos;
};

export const addPlanVideo = async (
  plan_id: string,
  payload: AddPlanVideoPayload,
) => {
  const { data } = await axiosInstance.post<PlanVideoDTO>(
    `/api/v1/cms/plans/${plan_id}/videos`,
    payload,
    { headers: getAuthHeaders() },
  );
  return data;
};

export const deletePlanVideo = async (plan_id: string, video_id: string) => {
  await axiosInstance.delete(
    `/api/v1/cms/plans/${plan_id}/videos/${video_id}`,
    { headers: getAuthHeaders() },
  );
};

export const reorderPlanVideos = async (
  plan_id: string,
  videos: Array<{ id: string; display_order: number }>,
) => {
  const { data } = await axiosInstance.put<{ videos: PlanVideoDTO[] }>(
    `/api/v1/cms/plans/${plan_id}/videos/order`,
    { videos },
    { headers: getAuthHeaders() },
  );
  return data.videos;
};
