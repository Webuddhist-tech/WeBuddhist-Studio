import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { IoMdArrowBack } from "react-icons/io";
import { toast } from "sonner";
import { useTranslate } from "@tolgee/react";
import { Pecha } from "@/components/ui/shadimport";
import { useLanguages } from "@/hooks/useLanguages";
import type { LanguageCode } from "@/schema/SeriesSchema";
import { ROUTES } from "@/routes/paths";
import {
  getSeries,
  putSeriesPlans,
  resolveSeriesGroupId,
} from "@/components/routes/create-series/api/seriesApi";
import PlanSearchSelector from "@/components/routes/create-series/components/PlanSearchSelector";
import type { SeriesPlan } from "@/schema/SeriesSchema";
import { SeriesPlansTable } from "./SeriesPlansTable";
import {
  getLanguageTabCounts,
  getLanguagesWithPlans,
  getSeriesStartDateSettings,
  getSeriesTitleForLanguage,
  groupPlansByLanguage,
  plansByLanguageToIdMap,
  removePlanFromLanguage,
  reorderPlansInLanguage,
  seriesPlanRowsToSeriesPlans,
  seriesPlansToRows,
} from "./seriesDetailsMappers";
import type { PlansByLanguage } from "./seriesDetailsTypes";
import { useGroupContentPermissions } from "@/hooks/useGroupContentPermissions";
import { DropdownButton } from "@/components/ui/molecules/dropdown-button/DropdownButton";
import { SeriesLanguageActionsPanel } from "./SeriesLanguageActionsPanel";
import SeriesPartnersSection from "./SeriesPartnersSection";
import {
  buildSeriesLanguageParams,
  parseSeriesLanguageParam,
} from "./seriesDetailsUrlState";

const SeriesDetailsPage = () => {
  const { seriesId } = useParams<{ seriesId: string }>();
  const navigate = useNavigate();
  const { t } = useTranslate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const [plansByLang, setPlansByLang] = useState<PlansByLanguage>({});
  const { languageOptions } = useLanguages();

  const activeLanguage = useMemo(
    () => parseSeriesLanguageParam(searchParams),
    [searchParams],
  );

  const setActiveLanguage = useCallback(
    (code: LanguageCode) => {
      setSearchParams(buildSeriesLanguageParams(searchParams, code), {
        replace: true,
      });
    },
    [searchParams, setSearchParams],
  );

  const {
    data: seriesData,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["series", seriesId],
    queryFn: () => getSeries(seriesId!),
    enabled: Boolean(seriesId),
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (!seriesData) return;
    setPlansByLang(groupPlansByLanguage(seriesData.plans ?? []));
  }, [seriesData]);

  const tabCounts = useMemo(
    () => getLanguageTabCounts(plansByLang),
    [plansByLang],
  );

  const headerTitle = getSeriesTitleForLanguage(
    seriesData?.metadata,
    activeLanguage,
    t("studio.dashboard.untitled_series"),
  );

  const activePlans = plansByLang[activeLanguage] ?? [];
  const activeSeriesPlans = useMemo(
    () => seriesPlanRowsToSeriesPlans(activePlans),
    [activePlans],
  );
  const cloneSourceLanguages = useMemo(
    () => getLanguagesWithPlans(tabCounts, activeLanguage),
    [tabCounts, activeLanguage],
  );
  const seriesStartDate = useMemo(
    () => getSeriesStartDateSettings(seriesData?.plans ?? []),
    [seriesData?.plans],
  );

  const seriesGroupId = useMemo(
    () => resolveSeriesGroupId(seriesData),
    [seriesData],
  );

  const seriesStatus = seriesData?.status ?? "DRAFT";
  const {
    platformRole,
    groupRole,
    platformReadOnly,
    canEdit: canEditSeries,
    canChangeStatus: canManageSeriesGroup,
    canTransfer: canTransferSeries,
  } = useGroupContentPermissions(seriesGroupId, seriesStatus);

  const canManageSeriesPlans = canEditSeries && !platformReadOnly;
  const canManageSeriesPartners = canManageSeriesGroup && !platformReadOnly;
  const showClonePlansPanel =
    canManageSeriesPlans &&
    activePlans.length === 0 &&
    cloneSourceLanguages.length > 0;

  const persistPlansMutation = useMutation({
    mutationFn: (grouped: PlansByLanguage) =>
      putSeriesPlans(seriesId!, plansByLanguageToIdMap(grouped)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["series", seriesId] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-items"] });
    },
    onError: (err: unknown) => {
      const message =
        (err as { response?: { data?: { detail?: { message?: string } } } })
          ?.response?.data?.detail?.message ??
        t("studio.series.plans_update_failed");
      toast.error(message);
    },
  });

  const applyGrouped = (next: PlansByLanguage) => {
    setPlansByLang(next);
    persistPlansMutation.mutate(next);
  };

  const handleActivePlansChange = (next: SeriesPlan[]) => {
    if (!canManageSeriesPlans) return;
    const nextRows = seriesPlansToRows(next, activeLanguage, activePlans);
    applyGrouped({ ...plansByLang, [activeLanguage]: nextRows });
  };

  const handleRemove = (planId: string) => {
    if (!canManageSeriesPlans) return;
    applyGrouped(removePlanFromLanguage(plansByLang, activeLanguage, planId));
  };

  const handleReorder = (activeId: string, overId: string) => {
    if (!canManageSeriesPlans) return;
    applyGrouped(
      reorderPlansInLanguage(plansByLang, activeLanguage, activeId, overId),
    );
  };

  const tabClass = (active: boolean) =>
    `border-b-2 px-1 pb-2 text-sm font-semibold transition-colors ${
      active
        ? "border-[#A51C21] text-foreground"
        : "border-transparent text-muted-foreground hover:text-foreground"
    }`;

  if (!seriesId) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="flex h-[calc(100vh-40px)] items-center justify-center max-md:h-full">
        <p className="text-muted-foreground">{t("studio.common.loading")}</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex h-[calc(100vh-40px)] flex-col items-center justify-center gap-4 max-md:h-full">
        <p className="text-destructive">
          {String(error?.message ?? t("studio.common.error"))}
        </p>
        <Pecha.Button
          variant="outline"
          onClick={() => navigate(ROUTES.dashboard)}
        >
          {t("studio.series.back_to_dashboard")}
        </Pecha.Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col border h-[calc(100vh-40px)] overflow-auto bg-[#F5F5F5] dark:bg-[#181818] my-4 rounded-l-2xl font-dynamic max-md:my-0 max-md:h-full max-md:rounded-none max-md:border-0">
      <div className="flex flex-wrap items-center gap-3 border-b border-dashed border-gray-300 px-4 py-4 dark:border-input">
        <Pecha.Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={t("studio.series.back_to_dashboard")}
          onClick={() => navigate("-1")}
        >
          <IoMdArrowBack className="h-4 w-4" />
        </Pecha.Button>
        <h1 className="text-lg font-semibold">{headerTitle}</h1>
        {canEditSeries && !platformReadOnly ? (
          <Link
            to={ROUTES.seriesEdit(seriesId)}
            className="text-sm text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
          >
            {t("studio.series.edit_series")}
          </Link>
        ) : null}
        {canTransferSeries && seriesGroupId && !platformReadOnly ? (
          <DropdownButton
            id={seriesId}
            entityType="series"
            currentStatus={seriesStatus}
            triggerVariant="icon"
            platformRole={platformRole}
            groupRole={groupRole}
            sourceGroupId={seriesGroupId}
            contentTitle={headerTitle}
          />
        ) : null}
      </div>

      {platformReadOnly && (
        <p className="mx-4 mt-2 text-sm text-muted-foreground">
          {t("studio.series.read_only_notice")}
        </p>
      )}
      {!platformReadOnly && !canEditSeries && (
        <p className="mx-4 mt-2 text-sm text-muted-foreground">
          {t("studio.series.cannot_edit_notice")}
        </p>
      )}

      <div className="flex flex-wrap items-end justify-between gap-4 px-4 py-3">
        <div className="flex flex-wrap gap-6">
          {languageOptions.map(({ label, value }) => {
            const code = value as LanguageCode;
            const count = tabCounts[code] ?? 0;
            return (
              <button
                key={code}
                type="button"
                className={tabClass(activeLanguage === code)}
                onClick={() => setActiveLanguage(code)}
              >
                {label} ({count})
              </button>
            );
          })}
        </div>
        {canManageSeriesPlans ? (
          <div className="w-full max-w-md min-w-[280px]">
            <PlanSearchSelector
              value={activeSeriesPlans}
              onChange={handleActivePlansChange}
              searchLanguage={activeLanguage}
              groupId={seriesGroupId}
              hideSelectedList
              searchPlaceholder={t("studio.series.find_plans_placeholder")}
            />
          </div>
        ) : null}
      </div>

      <div className="flex-1 px-4 pb-6">
        {activePlans.length > 0 ? (
          <div className="overflow-x-auto">
            <SeriesPlansTable
              plans={activePlans}
              seriesId={seriesId}
              sourceGroupId={seriesGroupId}
              groupRole={groupRole}
              platformRole={platformRole}
              readOnly={platformReadOnly || !canManageSeriesPlans}
              onReorder={handleReorder}
              onRemoveFromSeries={handleRemove}
            />
          </div>
        ) : null}

        {canManageSeriesPlans && seriesGroupId ? (
          <SeriesLanguageActionsPanel
            seriesId={seriesId}
            groupId={seriesGroupId}
            activeLanguage={activeLanguage}
            hasActivePlans={activePlans.length > 0}
            showClonePanel={showClonePlansPanel}
            cloneSourceLanguages={cloneSourceLanguages}
            seriesStartDate={seriesStartDate}
          />
        ) : null}

        <SeriesPartnersSection
          seriesId={seriesId}
          ownerGroupId={seriesGroupId}
          language={activeLanguage}
          canManage={canManageSeriesPartners}
        />
      </div>
    </div>
  );
};

export default SeriesDetailsPage;
