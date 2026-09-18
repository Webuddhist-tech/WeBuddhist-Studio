import axiosInstance from "@/config/axios-config";

export interface VerseContent {
  [lang: string]: string;
}

export interface VerseOfDayPayload {
  verses: VerseContent;
  image_urls: string[];
  verse_id: string;
  ref_id: string;
  source?: string | null;
  ref_type: string;
  group_id: string;
  date: string;
}

export interface GroupInfo {
  id: string;
  title: string;
  sub_title: string;
  description: string;
  language: string;
}

export interface VerseOfDayItem {
  id: string;
  verses: VerseContent;
  verse: string | null;
  image_url: string | null;
  ref_id: string;
  source?: string | null;
  ref_type: string;
  date: string;
  group_id: string | null;
  group_info: GroupInfo[];
}

export interface VerseOfDayListResponse {
  verses: VerseOfDayItem[];
  total: number;
}

export interface VerseOfDayResponse {
  id: string;
  verses: VerseContent;
  image_urls: string[];
  verse_id: string;
  ref_id: string;
  source?: string | null;
  ref_type: string;
  group_id: string;
  date: string;
  created_at: string;
  updated_at: string;
}

const getAuthHeaders = () => ({
  Authorization: `Bearer ${sessionStorage.getItem("accessToken")}`,
});

export type SortOrder = "asc" | "desc";

export type FetchVerseOfDayParams = {
  page?: number;
  limit?: number;
  search?: string;
  sortOrder?: SortOrder;
};

export const fetchVerseOfDayList = async (
  params: FetchVerseOfDayParams = {},
): Promise<VerseOfDayListResponse> => {
  const { page = 1, limit = 10, search = "", sortOrder = "desc" } = params;
  const { data } = await axiosInstance.get<VerseOfDayListResponse>(
    `/api/v1/cms/verse-of-day`,
    {
      headers: getAuthHeaders(),
      params: {
        skip: (page - 1) * limit,
        limit,
        sort_order: sortOrder,
        ...(search.trim() && { search: search.trim() }),
      },
    },
  );
  return data;
};

export const createVerseOfDay = async (
  payload: VerseOfDayPayload,
): Promise<VerseOfDayResponse> => {
  const { data } = await axiosInstance.post<VerseOfDayResponse>(
    `/api/v1/cms/verse-of-day`,
    payload,
    {
      headers: getAuthHeaders(),
    },
  );
  return data;
};

export const updateVerseOfDay = async (
  id: string,
  payload: VerseOfDayPayload,
): Promise<VerseOfDayResponse> => {
  const { data } = await axiosInstance.put<VerseOfDayResponse>(
    `/api/v1/cms/verse-of-day/${id}`,
    payload,
    {
      headers: getAuthHeaders(),
    },
  );
  return data;
};

export const deleteVerseOfDay = async (id: string): Promise<void> => {
  await axiosInstance.delete(`/api/v1/cms/verse-of-day/${id}`, {
    headers: getAuthHeaders(),
  });
};
