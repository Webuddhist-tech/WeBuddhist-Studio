import axiosInstance from "@/config/axios-config";
import { tolgee } from "@/i18n/tolgee";
import type { FkOption } from "../components/FkMultiSearchSelector";

interface PresetMantraDTO {
  id: string;
  mantra: string;
  title?: string | null;
  pronunciation?: string | null;
  mala_image_url?: string | null;
}

interface PublicAccumulatorDTO {
  id: string;
  target_count?: number | null;
  mantra?: PresetMantraDTO | null;
  mala_image_url?: string | null;
  metadata?: { language: string; name: string }[];
}

interface PublicAccumulatorsResponse {
  accumulators: PublicAccumulatorDTO[];
  total: number;
  skip: number;
  limit: number;
}

function presetLabel(preset: PublicAccumulatorDTO): string {
  const mantraTitle = preset.mantra?.title?.trim();
  if (mantraTitle) return mantraTitle;
  const metaName = preset.metadata?.[0]?.name?.trim();
  if (metaName) return metaName;
  const mantraText = preset.mantra?.mantra?.trim();
  if (mantraText) {
    return mantraText.length > 60 ? `${mantraText.slice(0, 57)}…` : mantraText;
  }
  return tolgee.t("studio.groups.shared.untitled_preset");
}

export async function searchAccumulatorPresets(params: {
  search?: string;
  skip?: number;
  limit?: number;
}): Promise<{
  items: FkOption[];
  skip: number;
  limit: number;
  total: number;
}> {
  const skip = params.skip ?? 0;
  const limit = params.limit ?? 20;
  const { data } = await axiosInstance.get<PublicAccumulatorsResponse>(
    `/api/v1/accumulators/presets`,
    {
      params: {
        skip,
        limit,
        show_recitations: true,
        ...(params.search?.trim() && { search: params.search.trim() }),
      },
    },
  );

  return {
    items: data.accumulators.map((preset) => ({
      id: preset.id,
      title: presetLabel(preset),
      image_url:
        preset.mantra?.mala_image_url ?? preset.mala_image_url ?? undefined,
    })),
    skip: data.skip,
    limit: data.limit,
    total: data.total,
  };
}
