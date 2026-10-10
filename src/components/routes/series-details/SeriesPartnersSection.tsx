import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTranslate } from "@tolgee/react";
import { IoMdClose } from "react-icons/io";
import { IoInformationCircleOutline } from "react-icons/io5";
import { FiPlus } from "react-icons/fi";
import { Pecha } from "@/components/ui/shadimport";
import EventLinkPicker from "@/components/routes/groups/components/events/EventLinkPicker";
import type { FkOption } from "@/components/routes/groups/components/FkMultiSearchSelector";
import { makeGroupPartnerSearchFn } from "@/components/routes/groups/api/groupPickerApi";
import { getApiErrorMessage } from "@/lib/apiErrors";
import {
  addSeriesPartner,
  listSeriesPartners,
  removeSeriesPartner,
  type SeriesPartnerItemDTO,
} from "@/components/routes/create-series/api/seriesPartnersApi";

type SeriesPartnersSectionProps = {
  seriesId: string;
  ownerGroupId?: string;
  language?: string;
  canManage: boolean;
};

type PartnerRowProps = {
  partner: SeriesPartnerItemDTO;
  canManage: boolean;
  isRemoving: boolean;
  onRemove: (partner: SeriesPartnerItemDTO) => void;
};

const PartnerRow = ({
  partner,
  canManage,
  isRemoving,
  onRemove,
}: PartnerRowProps) => {
  const { t } = useTranslate();
  const showRemove = canManage && !partner.is_owner;
  return (
    <div
      className={`group flex items-center gap-3 rounded-md border border-input bg-white p-2 transition-opacity dark:bg-[#262626] ${
        isRemoving ? "opacity-50" : ""
      }`}
    >
      <Pecha.Avatar className="h-9 w-9 shrink-0">
        {partner.group_image ? (
          <Pecha.AvatarImage
            src={partner.group_image}
            alt={partner.group_name}
          />
        ) : null}
        <Pecha.AvatarFallback>
          {partner.group_name.charAt(0).toUpperCase() || "G"}
        </Pecha.AvatarFallback>
      </Pecha.Avatar>

      <span className="min-w-0 flex-1 truncate text-sm">
        {partner.group_name}
      </span>

      {partner.is_owner ? (
        <Pecha.Badge variant="secondary" className="shrink-0">
          {t("studio.series.partners.owner")}
        </Pecha.Badge>
      ) : null}

      {showRemove ? (
        <Pecha.Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={isRemoving}
          className="shrink-0 text-muted-foreground hover:text-destructive"
          onClick={() => onRemove(partner)}
        >
          {isRemoving
            ? t("studio.series.partners.removing")
            : t("studio.common.remove")}
        </Pecha.Button>
      ) : null}
    </div>
  );
};

const SeriesPartnersSection = ({
  seriesId,
  ownerGroupId,
  language,
  canManage,
}: SeriesPartnersSectionProps) => {
  const queryClient = useQueryClient();
  const { t } = useTranslate();
  const partnersKey = ["series-partners", seriesId, language ?? null];
  const [pendingRemove, setPendingRemove] =
    useState<SeriesPartnerItemDTO | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  const {
    data: partners = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: partnersKey,
    queryFn: () => listSeriesPartners(seriesId, language),
    enabled: Boolean(seriesId),
    refetchOnWindowFocus: false,
  });

  const excludeIds = useMemo(() => {
    const ids = partners.map((p) => p.group_id);
    if (ownerGroupId) ids.push(ownerGroupId);
    return ids;
  }, [partners, ownerGroupId]);

  const searchFn = useMemo(
    () => makeGroupPartnerSearchFn(excludeIds),
    [excludeIds],
  );

  const addMutation = useMutation({
    mutationFn: (groupId: string) =>
      addSeriesPartner(seriesId, groupId, language),
    onSuccess: () => {
      setIsAdding(false);
      queryClient.invalidateQueries({
        queryKey: ["series-partners", seriesId],
      });
    },
    onError: (err) =>
      toast.error(
        getApiErrorMessage(err, t("studio.series.partners.add_failed")),
      ),
  });

  const removeMutation = useMutation({
    mutationFn: (groupId: string) => removeSeriesPartner(seriesId, groupId),
    onSuccess: () => {
      setPendingRemove(null);
      queryClient.invalidateQueries({
        queryKey: ["series-partners", seriesId],
      });
    },
    onError: (err) =>
      toast.error(
        getApiErrorMessage(err, t("studio.series.partners.remove_failed")),
      ),
  });

  const removingGroupId = removeMutation.isPending
    ? removeMutation.variables
    : undefined;

  const handleAdd = (item: FkOption | null) => {
    if (!item) return;
    addMutation.mutate(item.id);
  };

  const onlyOwner = partners.length <= 1;
  const emptyHint = canManage
    ? t("studio.series.partners.empty_hint_manage")
    : t("studio.series.partners.empty_hint");

  return (
    <section className="mt-6 rounded-xl border border-dashed border-gray-300 bg-white/60 p-4 dark:border-input dark:bg-[#1f1f1f]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-1.5">
          <h2 className="text-sm font-semibold">
            {t("studio.series.partners.title")}{" "}
            <span className="text-muted-foreground">({partners.length})</span>
          </h2>
          <Pecha.TooltipProvider>
            <Pecha.Tooltip>
              <Pecha.TooltipTrigger asChild>
                <button
                  type="button"
                  aria-label={t("studio.series.partners.about_aria")}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <IoInformationCircleOutline className="h-4 w-4" />
                </button>
              </Pecha.TooltipTrigger>
              <Pecha.TooltipContent side="right" className="max-w-xs text-xs">
                {t("studio.series.partners.about_tooltip")}
              </Pecha.TooltipContent>
            </Pecha.Tooltip>
          </Pecha.TooltipProvider>
        </div>

        {canManage && !isAdding ? (
          <Pecha.Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0"
            onClick={() => setIsAdding(true)}
          >
            <FiPlus className="h-4 w-4" />
            {t("studio.series.partners.add_partner")}
          </Pecha.Button>
        ) : null}
      </div>

      {canManage && isAdding ? (
        <div className="mt-3 flex items-start gap-2">
          <div className="max-w-md flex-1">
            <EventLinkPicker
              label={t("studio.series.partners.group_label")}
              value={null}
              onChange={handleAdd}
              searchFn={searchFn}
              queryKeyPrefix={`series-partner-picker-${seriesId}`}
              searchPlaceholder={t("studio.series.partners.search_placeholder")}
              disabled={addMutation.isPending}
            />
          </div>
          <Pecha.Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={t("studio.series.partners.cancel_adding_aria")}
            className="mt-6 shrink-0"
            onClick={() => setIsAdding(false)}
          >
            <IoMdClose className="h-4 w-4" />
          </Pecha.Button>
        </div>
      ) : null}

      <div className="mt-4 space-y-2">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">
            {t("studio.common.loading")}
          </p>
        ) : null}
        {isError ? (
          <p className="text-sm text-destructive">
            {t("studio.series.partners.load_failed")}
          </p>
        ) : null}
        {!isLoading && !isError
          ? partners.map((partner) => (
              <PartnerRow
                key={partner.id}
                partner={partner}
                canManage={canManage}
                isRemoving={removingGroupId === partner.group_id}
                onRemove={setPendingRemove}
              />
            ))
          : null}
        {!isLoading && !isError && onlyOwner ? (
          <p className="pt-1 text-xs text-muted-foreground">{emptyHint}</p>
        ) : null}
      </div>

      <Pecha.AlertDialog
        open={Boolean(pendingRemove)}
        onOpenChange={(open) => {
          if (!open) setPendingRemove(null);
        }}
      >
        <Pecha.AlertDialogContent>
          <Pecha.AlertDialogHeader>
            <Pecha.AlertDialogTitle>
              {t("studio.series.partners.remove_confirm_title")}
            </Pecha.AlertDialogTitle>
            <Pecha.AlertDialogDescription>
              {t("studio.series.partners.remove_confirm_description", {
                name: pendingRemove?.group_name ?? "",
              })}
            </Pecha.AlertDialogDescription>
          </Pecha.AlertDialogHeader>
          <Pecha.AlertDialogFooter>
            <Pecha.AlertDialogCancel disabled={removeMutation.isPending}>
              {t("studio.common.cancel")}
            </Pecha.AlertDialogCancel>
            <Pecha.AlertDialogAction
              className="bg-[#AD1B21] text-white hover:bg-[#AD1B21]/90 dark:bg-[#AD1B21]/70"
              disabled={removeMutation.isPending}
              onClick={(e) => {
                e.preventDefault();
                if (pendingRemove)
                  removeMutation.mutate(pendingRemove.group_id);
              }}
            >
              {removeMutation.isPending
                ? t("studio.series.partners.removing")
                : t("studio.common.remove")}
            </Pecha.AlertDialogAction>
          </Pecha.AlertDialogFooter>
        </Pecha.AlertDialogContent>
      </Pecha.AlertDialog>
    </section>
  );
};

export default SeriesPartnersSection;
