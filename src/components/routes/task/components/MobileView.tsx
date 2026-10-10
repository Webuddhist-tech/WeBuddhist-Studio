import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useTranslate } from "@tolgee/react";
import { fetchPlanDetails } from "../api/planApi";

const MobileView = () => {
  const { planId } = useParams<{ planId: string }>();
  const { t } = useTranslate();
  const { data: planDetails, isLoading } = useQuery({
    queryKey: ["planDetails", planId],
    queryFn: () => fetchPlanDetails(planId!),
    enabled: !!planId,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-white mx-auto"></div>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            {t("studio.task.preview.loading_plan")}
          </p>
        </div>
      </div>
    );
  }

  if (!planDetails) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {t("studio.task.preview.plan_not_found")}
          </p>
        </div>
      </div>
    );
  }

  const isPlanPublished = planDetails.status === "PUBLISHED";
  if (!isPlanPublished) {
    return null;
  }

  const viewerBase =
    import.meta.env.VITE_WEBUDDHIST_PLAN_VIEWER_URL ??
    "https://plans.webuddhist.com";
  const viewUrl = `${viewerBase}/plan/${planId}`;

  return (
    <div className="flex h-full items-center justify-center bg-muted/20 p-4">
      <div
        className="flex h-full max-h-[min(844px,100%)] w-full max-w-[390px] flex-col rounded-[2.75rem] border-[10px] border-gray-900 bg-gray-900 shadow-2xl dark:border-gray-600"
        aria-label={t("studio.task.preview.mobile_preview_aria")}
      >
        <div
          className="mx-auto mt-2 h-1.5 w-24 shrink-0 rounded-full bg-gray-700"
          aria-hidden
        />
        <div className="min-h-0 flex-1 overflow-hidden rounded-[2rem] bg-white">
          {planId && (
            <iframe
              src={viewUrl}
              className="block h-full w-full border-0"
              title={t("studio.task.preview.viewer_title", { planId })}
              sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
            />
          )}
        </div>
        <div
          className="mx-auto mb-2 mt-1 h-1 w-28 shrink-0 rounded-full bg-gray-700"
          aria-hidden
        />
      </div>
    </div>
  );
};

export default MobileView;
