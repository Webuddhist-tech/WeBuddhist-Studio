import axiosInstance from "@/config/axios-config";
import type { LanguageCode } from "@/schema/SeriesSchema";
import { capitalizeFirstLetter } from "@/lib/textUtils";
import type { ImageUrlModel } from "./mantrasApi";

export interface AccumulatorMetadataDTO {
  language: string;
  name: string;
  description?: string | null;
}

export interface PresetMantraDTO {
  id: string;
  mantra: string;
  title?: string | null;
  pronunciation?: string | null;
  audio_url?: string | null;
  mala_image_id?: string | null;
  mala_image_url?: string | null;
  deity_image?: ImageUrlModel | null;
}

export interface AccumulatorPreset {
  id: string;
  group_id: string | null;
  type: string;
  target_count: number | null;
  current_count: number;
  text_id: string | null;
  mantra: PresetMantraDTO | null;
  mala_image_id: string | null;
  mala_image_url: string | null;
  metadata: AccumulatorMetadataDTO[];
  created_at: string;
  updated_at: string | null;
}

export interface AccumulatorPresetsListResponse {
  accumulators: AccumulatorPreset[];
  total: number;
  skip: number;
  limit: number;
}

export interface AccumulatorMetadataInput {
  language: LanguageCode;
  name: string;
  description?: string | null;
}

export interface AccumulatorPresetPayload {
  target_count?: number | null;
  text_id?: string | null;
  mantra_id?: string | null;
  mala_image_id?: string | null;
  metadata: AccumulatorMetadataInput[];
}

export interface UpdateAccumulatorPresetPayload {
  target_count?: number | null;
  text_id?: string | null;
  mantra_id?: string | null;
  mala_image_id?: string | null;
  metadata?: AccumulatorMetadataInput[];
}

const getAuthHeaders = () => ({
  Authorization: `Bearer ${sessionStorage.getItem("accessToken")}`,
});

export const fetchAccumulatorPresets = async (
  page: number,
  limit: number,
  search: string,
): Promise<AccumulatorPresetsListResponse> => {
  const skip = (page - 1) * limit;
  const { data } = await axiosInstance.get<AccumulatorPresetsListResponse>(
    `/api/v1/cms/accumulators/presets`,
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

export const fetchAccumulatorPreset = async (
  presetId: string,
): Promise<AccumulatorPreset> => {
  const { data } = await axiosInstance.get<AccumulatorPreset>(
    `/api/v1/cms/accumulators/presets/${presetId}`,
    { headers: getAuthHeaders() },
  );
  return data;
};

export const createAccumulatorPreset = async (
  payload: AccumulatorPresetPayload,
): Promise<AccumulatorPreset> => {
  const { data } = await axiosInstance.post<AccumulatorPreset>(
    `/api/v1/cms/accumulators/presets`,
    payload,
    { headers: getAuthHeaders() },
  );
  return data;
};

export const updateAccumulatorPreset = async (
  presetId: string,
  payload: UpdateAccumulatorPresetPayload,
): Promise<AccumulatorPreset> => {
  const { data } = await axiosInstance.put<AccumulatorPreset>(
    `/api/v1/cms/accumulators/presets/${presetId}`,
    payload,
    { headers: getAuthHeaders() },
  );
  return data;
};

export const deleteAccumulatorPreset = async (
  presetId: string,
): Promise<void> => {
  await axiosInstance.delete(`/api/v1/cms/accumulators/presets/${presetId}`, {
    headers: getAuthHeaders(),
  });
};

export function presetDisplayName(preset: AccumulatorPreset): string {
  const metaName = preset.metadata?.[0]?.name?.trim();
  if (metaName) return capitalizeFirstLetter(metaName);
  const mantraTitle = preset.mantra?.title?.trim();
  if (mantraTitle) return capitalizeFirstLetter(mantraTitle);
  const mantraText = preset.mantra?.mantra?.trim();
  if (mantraText) {
    const truncated =
      mantraText.length > 60 ? `${mantraText.slice(0, 57)}…` : mantraText;
    return capitalizeFirstLetter(truncated);
  }
  return "Untitled preset";
}
