import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useTranslate } from "@tolgee/react";
import { ROUTES } from "@/routes/paths";
import type { SeriesFormData } from "@/schema/SeriesSchema";
import {
  buildSeriesCreateBody,
  buildSeriesUpdateBody,
  mapSeriesDetailToFormData,
  postSeries,
  putUpdateSeries,
  type SeriesDetailDTO,
} from "@/components/routes/create-series/api/seriesApi";

type SaveSeriesInput = { data: SeriesFormData; featured: boolean };

type UseSaveSeriesParams = {
  isNew: boolean;
  seriesId?: string;
  groupId?: string;
  seriesData?: SeriesDetailDTO;
  onUpdated: (series: SeriesDetailDTO) => void;
  onUpdateFailed: () => void;
};

export const useSaveSeries = ({
  isNew,
  seriesId,
  groupId,
  seriesData,
  onUpdated,
  onUpdateFailed,
}: UseSaveSeriesParams) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { t } = useTranslate();

  return useMutation({
    mutationFn: async ({ data, featured }: SaveSeriesInput) => {
      if (isNew) {
        const body = buildSeriesCreateBody(data, featured, groupId);
        return postSeries(body);
      }
      if (!seriesId || !seriesData) {
        throw new Error(t("studio.series.save.missing_data"));
      }
      const body = buildSeriesUpdateBody(data, featured, {
        original: mapSeriesDetailToFormData(seriesData),
        originalFeatured: seriesData.featured,
      });
      return putUpdateSeries({ seriesId, body });
    },
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ["dashboard-items"] });
      if (isNew) {
        toast.success(t("studio.series.save.created"));
        navigate(ROUTES.series(result.id));
        return;
      }
      toast.success(t("studio.series.save.saved"));
      queryClient.setQueryData(["series", seriesId], result);
      onUpdated(result);
    },
    onError: (error: Error) => {
      toast.error(
        isNew
          ? t("studio.series.save.create_failed")
          : t("studio.series.save.update_failed"),
        {
          description: error.message,
        },
      );
      if (!isNew) {
        onUpdateFailed();
      }
    },
  });
};
