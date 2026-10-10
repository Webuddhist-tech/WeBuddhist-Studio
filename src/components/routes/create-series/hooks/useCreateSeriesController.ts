import { useEffect, useMemo, useRef, useState } from "react";
import { useBlocker, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useTranslate } from "@tolgee/react";
import { ROUTES } from "@/routes/paths";
import { sortLanguageCodes } from "@/lib/languageCodes";
import type { LanguageCode, SeriesFormData } from "@/schema/SeriesSchema";
import { useGroupContentPermissions } from "@/hooks/useGroupContentPermissions";
import { canWriteCms } from "@/lib/platformAccess";
import { useSeriesForm } from "@/components/routes/create-series/hooks/useSeriesForm";
import { useSeriesImage } from "@/components/routes/create-series/hooks/useSeriesImage";
import { useSaveSeries } from "@/components/routes/create-series/hooks/useSaveSeries";
import {
  getSeries,
  mapSeriesDetailToFormData,
  resolveSeriesGroupId,
} from "@/components/routes/create-series/api/seriesApi";
import { resolveDashboardItemImageUrl } from "@/components/routes/dashboard/dashboardTable";

export const useCreateSeriesController = () => {
  const { seriesId, groupId } = useParams<{
    seriesId?: string;
    groupId?: string;
  }>();
  const navigate = useNavigate();
  const { t } = useTranslate();
  const isNew = !seriesId;

  useEffect(() => {
    if (isNew && !groupId) {
      navigate(ROUTES.groups, { replace: true });
    }
  }, [isNew, groupId, navigate]);

  const seriesForm = useSeriesForm();
  const { form, languages, setImageUrl } = seriesForm;

  const seriesQuery = useQuery({
    queryKey: ["series", seriesId],
    queryFn: () => getSeries(seriesId ?? ""),
    enabled: Boolean(seriesId) && !isNew,
    refetchOnWindowFocus: false,
  });
  const seriesData = seriesQuery.data;

  const seriesGroupId = groupId ?? resolveSeriesGroupId(seriesData);
  const seriesStatus = isNew ? "DRAFT" : (seriesData?.status ?? "DRAFT");
  const {
    userInfo,
    groupRole,
    platformReadOnly,
    canEdit: canEditSeries,
  } = useGroupContentPermissions(seriesGroupId, seriesStatus);

  const canSaveSeries =
    !platformReadOnly &&
    (isNew
      ? Boolean(seriesGroupId) &&
        canWriteCms(userInfo) &&
        groupRole != null &&
        groupRole !== "VIEWER"
      : canEditSeries);

  const formReadOnly = !canSaveSeries;

  const image = useSeriesImage({ isNew, seriesId, setImageUrl });
  const { setImagePreview, setSelectedImage } = image;

  const [activePlansLanguage, setActivePlansLanguage] =
    useState<LanguageCode | null>(null);
  const [showNavigationDialog, setShowNavigationDialog] = useState(false);

  const seriesHydratedIdRef = useRef<string | null>(null);
  useEffect(() => {
    seriesHydratedIdRef.current = null;
  }, [seriesId]);

  const pendingImageSnapshotRef = useRef<{
    file: File | null;
    preview: string | null;
  }>({ file: null, preview: null });
  const preSubmitBaselineRef = useRef<SeriesFormData | null>(null);
  const submittedSeriesIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (isNew || !seriesData) return;
    if (seriesHydratedIdRef.current === seriesData.id) return;
    seriesHydratedIdRef.current = seriesData.id;
    form.reset(mapSeriesDetailToFormData(seriesData));
    const resolvedImageUrl = resolveDashboardItemImageUrl({
      image_url: seriesData.image_url,
      image_key: seriesData.image_key,
      image: seriesData.image,
    });
    setImagePreview(resolvedImageUrl || null);
    setSelectedImage(null);
  }, [isNew, seriesData, form, setImagePreview, setSelectedImage]);

  const orderedAddedLanguages = useMemo(
    () =>
      sortLanguageCodes(
        Object.keys(languages).filter((code) => languages[code] != null),
      ),
    [languages],
  );

  useEffect(() => {
    if (orderedAddedLanguages.length === 0) {
      setActivePlansLanguage(null);
      return;
    }
    if (
      activePlansLanguage == null ||
      !orderedAddedLanguages.includes(activePlansLanguage)
    ) {
      setActivePlansLanguage(orderedAddedLanguages[0]);
    }
  }, [orderedAddedLanguages, activePlansLanguage]);

  const saveSeriesMutation = useSaveSeries({
    isNew,
    seriesId,
    groupId,
    seriesData,
    onUpdated: (updated) => {
      if (submittedSeriesIdRef.current !== seriesId) {
        // The route has since navigated to a different series; the form
        // now mounted belongs to that other record, so applying this
        // response here would silently overwrite it with the wrong
        // series' content.
        return;
      }
      seriesHydratedIdRef.current = updated.id;
      // The onSubmit handler already rebased dirty-tracking onto the
      // submitted snapshot, so any field still dirty here was edited *after*
      // submission and is preserved; everything else takes the fresh
      // server-normalized value and becomes the new clean baseline.
      form.reset(mapSeriesDetailToFormData(updated), {
        keepDirtyValues: true,
      });

      const imageChangedDuringSave =
        image.selectedImage !== pendingImageSnapshotRef.current.file ||
        image.imagePreview !== pendingImageSnapshotRef.current.preview;
      if (!imageChangedDuringSave) {
        const resolvedImageUrl = resolveDashboardItemImageUrl({
          image_url: updated.image_url,
          image_key: updated.image_key,
          image: updated.image,
        });
        setImagePreview(resolvedImageUrl || null);
        setSelectedImage(null);
      }
      preSubmitBaselineRef.current = null;
    },
    onUpdateFailed: () => {
      if (submittedSeriesIdRef.current !== seriesId) {
        // Same guard as onUpdated: this failure belongs to a series that's
        // no longer mounted, so there's no local baseline to restore here.
        return;
      }
      // The submit rebase already stamped the in-flight values as "clean"
      // optimistically; since persistence failed, restore the prior
      // baseline so those unsaved edits are dirty again, Save re-enables,
      // and the unsaved-changes navigation guard protects them.
      if (preSubmitBaselineRef.current) {
        form.reset(preSubmitBaselineRef.current, { keepValues: true });
        preSubmitBaselineRef.current = null;
      }
    },
  });

  const hasUnsavedChanges =
    (form.formState.isDirty && !form.formState.isSubmitSuccessful) ||
    (!isNew && saveSeriesMutation.isPending);

  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      hasUnsavedChanges && currentLocation.pathname !== nextLocation.pathname,
  );

  useEffect(() => {
    if (blocker.state === "blocked") {
      setShowNavigationDialog(true);
    }
  }, [blocker.state]);

  const onSubmit = form.handleSubmit((data) => {
    if (formReadOnly) return;
    const featured = isNew ? false : (seriesData?.featured ?? false);
    pendingImageSnapshotRef.current = {
      file: image.selectedImage,
      preview: image.imagePreview,
    };
    if (!isNew) {
      // Tag this request with the series it was submitted for, so a
      // response that arrives after the route has moved on to a different
      // series can be told apart and ignored instead of misapplied.
      submittedSeriesIdRef.current = seriesId ?? null;
      // Snapshot the current baseline so a failed save can restore it.
      preSubmitBaselineRef.current = structuredClone(
        form.formState.defaultValues,
      ) as SeriesFormData;
      // Rebase the clean baseline onto exactly what's being submitted, so
      // dirty-tracking during the pending request only flags edits made
      // *after* this point, letting onUpdated tell those apart from the
      // fields that were simply part of this save.
      form.reset(data, { keepValues: true });
    }
    saveSeriesMutation.mutate({ data, featured });
  });

  const confirmNavigation = () => {
    setShowNavigationDialog(false);
    blocker.proceed?.();
  };

  const cancelNavigation = () => {
    setShowNavigationDialog(false);
    blocker.reset?.();
  };

  const submitEnabled =
    seriesForm.canSubmit &&
    !saveSeriesMutation.isPending &&
    seriesForm.imageUrl.trim().length > 0 &&
    (isNew || !!seriesData);

  const saveDisabled =
    formReadOnly || !submitEnabled || (!isNew && !form.formState.isDirty);

  const getSaveLabel = () => {
    if (saveSeriesMutation.isPending) {
      return isNew ? t("studio.common.creating") : t("studio.common.saving");
    }
    return isNew
      ? t("studio.series.form.create_series")
      : t("studio.series.form.save_changes");
  };
  const saveLabel = getSaveLabel();

  return {
    isNew,
    navigate,
    seriesForm,
    seriesGroupId,
    formReadOnly,
    platformReadOnly,
    image,
    orderedAddedLanguages,
    activePlansLanguage,
    setActivePlansLanguage,
    showNavigationDialog,
    setShowNavigationDialog,
    isSeriesLoading: seriesQuery.isLoading,
    isSeriesError: seriesQuery.isError,
    seriesError: seriesQuery.error,
    onSubmit,
    confirmNavigation,
    cancelNavigation,
    saveDisabled,
    saveLabel,
  };
};
