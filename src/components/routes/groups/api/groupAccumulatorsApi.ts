import axiosInstance from "@/config/axios-config";
import type { LanguageCode } from "@/lib/languageCodes";

export interface GroupAccumulatorImage {
  thumbnail: string;
  medium: string;
  original: string;
}

export interface GroupAccumulatorMetadataDTO {
  language: LanguageCode;
  /** Per-language title. The EN entry (or the first translated one) also
   * becomes the accumulator's default `title`. */
  title?: string | null;
  description: string | null;
}

export type GroupAccumulatorLinkType = "YOUTUBE" | "LINK";

export interface GroupAccumulatorLinkDTO {
  id: string;
  url: string;
  link_type: GroupAccumulatorLinkType;
  video_id: string | null;
  title: string | null;
  display_order: number;
}

/** Array order becomes `display_order`; `link_type` is derived server-side. */
export interface GroupAccumulatorLinkInput {
  url: string;
  title?: string | null;
}

export interface GroupAccumulatorDTO {
  id: string;
  preset_accumulator_id: string | null;
  group_id: string;
  /** Default title; per-language titles live in `metadata`. */
  title: string | null;
  image: GroupAccumulatorImage | null;
  image_key: string | null;
  target_count: number | null;
  start_date: string | null;
  end_date: string | null;
  metadata?: GroupAccumulatorMetadataDTO[] | null;
  links: GroupAccumulatorLinkDTO[];
  member_count?: number;
  created_at: string;
  updated_at: string | null;
}

export type GroupAccumulatorDetailDTO = GroupAccumulatorDTO;

export interface GroupAccumulatorsResponse {
  accumulators: GroupAccumulatorDTO[];
  total: number;
  skip: number;
  limit: number;
}

export interface CreateGroupAccumulatorRequest {
  accumulator_id?: string | null;
  title?: string | null;
  image_key?: string | null;
  target_count?: number | null;
  start_date?: string | null;
  end_date?: string | null;
  // Both arrays are a full replace, not a delta: omitting leaves existing rows
  // untouched, `[]` deletes them all. Always send the complete current list.
  metadata?: GroupAccumulatorMetadataDTO[] | null;
  links?: GroupAccumulatorLinkInput[] | null;
}

export type UpdateGroupAccumulatorRequest = CreateGroupAccumulatorRequest;

const getAuthHeaders = () => ({
  Authorization: `Bearer ${sessionStorage.getItem("accessToken")}`,
});

export const GROUP_ACCUMULATOR_LINK_URL_MAX = 2000;
export const GROUP_ACCUMULATOR_LINK_TITLE_MAX = 500;

/** Mirrors the server rule behind the 400 `INVALID_URL` response. */
export function isValidLinkUrl(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > GROUP_ACCUMULATOR_LINK_URL_MAX) return false;
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return false;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
  return Boolean(parsed.hostname);
}

export function resolveGroupAccumulatorImageUrl(
  accumulator: Pick<GroupAccumulatorDTO, "image">,
): string | null {
  const image = accumulator.image;
  if (!image) return null;
  return image.medium || image.thumbnail || image.original || null;
}

export const fetchGroupAccumulators = async (
  groupId: string,
  params?: { skip?: number; limit?: number; search?: string },
): Promise<GroupAccumulatorsResponse> => {
  const { data } = await axiosInstance.get<GroupAccumulatorsResponse>(
    `/api/v1/cms/groups/${groupId}/accumulators`,
    {
      headers: getAuthHeaders(),
      params: {
        skip: params?.skip ?? 0,
        limit: params?.limit ?? 100,
        ...(params?.search?.trim() && { search: params.search.trim() }),
      },
    },
  );
  return data;
};

export const makeGroupAccumulatorSearchFn =
  (groupId: string) =>
  async (params: { search?: string; skip?: number; limit?: number }) => {
    const skip = params.skip ?? 0;
    const limit = params.limit ?? 20;
    const data = await fetchGroupAccumulators(groupId, {
      skip,
      limit,
      search: params.search,
    });
    return {
      items: data.accumulators.map((accumulator) => ({
        id: accumulator.id,
        title: accumulator.title?.trim() || "Untitled accumulator",
        image_url: resolveGroupAccumulatorImageUrl(accumulator) ?? undefined,
      })),
      skip: data.skip,
      limit: data.limit,
      total: data.total,
    };
  };

export const fetchGroupAccumulator = async (
  groupId: string,
  groupAccumulatorId: string,
): Promise<GroupAccumulatorDetailDTO> => {
  const { data } = await axiosInstance.get<GroupAccumulatorDetailDTO>(
    `/api/v1/cms/groups/${groupId}/accumulators/${groupAccumulatorId}`,
    { headers: getAuthHeaders() },
  );
  return data;
};

export const createGroupAccumulator = async (
  groupId: string,
  payload: CreateGroupAccumulatorRequest,
): Promise<GroupAccumulatorDTO> => {
  const { data } = await axiosInstance.post<GroupAccumulatorDTO>(
    `/api/v1/cms/groups/${groupId}/accumulators`,
    payload,
    { headers: getAuthHeaders() },
  );
  return data;
};

export const updateGroupAccumulator = async (
  groupId: string,
  groupAccumulatorId: string,
  payload: UpdateGroupAccumulatorRequest,
): Promise<GroupAccumulatorDTO> => {
  const { data } = await axiosInstance.put<GroupAccumulatorDTO>(
    `/api/v1/cms/groups/${groupId}/accumulators/${groupAccumulatorId}`,
    payload,
    { headers: getAuthHeaders() },
  );
  return data;
};

export const deleteGroupAccumulator = async (
  groupId: string,
  groupAccumulatorId: string,
): Promise<void> => {
  await axiosInstance.delete(
    `/api/v1/cms/groups/${groupId}/accumulators/${groupAccumulatorId}`,
    { headers: getAuthHeaders() },
  );
};
