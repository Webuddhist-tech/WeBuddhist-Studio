import axiosInstance from "@/config/axios-config";

export interface PrayerIntention {
  id: string;
  slug: string;
  label: string;
  color: string;
  description: string;
  display_order: number;
  linked_event_count: number;
}

export interface PrayerIntentionsListResponse {
  intentions: PrayerIntention[];
}

export interface CreatePrayerIntentionPayload {
  slug: string;
  label: string;
  color: string;
  description: string;
  display_order: number;
}

export interface PatchPrayerIntentionPayload {
  label?: string;
  color?: string;
  description?: string;
  display_order?: number;
}

const getAuthHeaders = () => ({
  Authorization: `Bearer ${sessionStorage.getItem("accessToken")}`,
});

export const fetchPrayerIntentions =
  async (): Promise<PrayerIntentionsListResponse> => {
    const { data } = await axiosInstance.get<PrayerIntentionsListResponse>(
      `/api/v1/cms/intentions`,
      { headers: getAuthHeaders() },
    );
    return data;
  };

export const createPrayerIntention = async (
  payload: CreatePrayerIntentionPayload,
): Promise<PrayerIntention> => {
  const { data } = await axiosInstance.post<PrayerIntention>(
    `/api/v1/cms/intentions`,
    payload,
    { headers: getAuthHeaders() },
  );
  return data;
};

export const patchPrayerIntention = async (
  intentionId: string,
  payload: PatchPrayerIntentionPayload,
): Promise<PrayerIntention> => {
  const { data } = await axiosInstance.patch<PrayerIntention>(
    `/api/v1/cms/intentions/${intentionId}`,
    payload,
    { headers: getAuthHeaders() },
  );
  return data;
};
