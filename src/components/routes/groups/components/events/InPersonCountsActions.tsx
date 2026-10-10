import { useState } from "react";
import { useTranslate } from "@tolgee/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LuCircleDot, LuPencil, LuPlus, LuTrash2 } from "react-icons/lu";
import { toast } from "sonner";
import { Pecha } from "@/components/ui/shadimport";
import { Pagination } from "@/components/ui/molecules/pagination/Pagination";
import {
  createInPersonCount,
  deleteInPersonCount,
  fetchInPersonCounts,
  getInPersonCountErrorMessage,
  inPersonCountsQueryKey,
  updateInPersonCount,
  type InPersonCount,
  type InPersonCountList,
} from "../../api/inPersonCountsApi";
import { resolveGroupAccumulatorImageUrl } from "../../api/groupAccumulatorsApi";
import { todayInTimeZone } from "../../api/prayerPdfApi";

const PAGE_SIZE = 10;

interface InPersonCountsActionsProps {
  eventId: string;
}

/** A row being added (id null) or edited. Count is kept as typed. */
interface Draft {
  id: string | null;
  day: string;
  count: string;
}

/** "2026-10-01" → "Thu, 1 Oct 2026", read as a calendar day, not an instant. */
const formatDay = (day: string) => {
  const [year, month, date] = day.split("-").map(Number);
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(year, month - 1, date));
};

const DraftRow = ({
  draft,
  maxDay,
  pending,
  onChange,
  onSave,
  onCancel,
}: {
  draft: Draft;
  maxDay: string;
  pending: boolean;
  onChange: (draft: Draft) => void;
  onSave: () => void;
  onCancel: () => void;
}) => {
  const { t } = useTranslate();
  return (
    <form
      className="flex flex-wrap items-end gap-2 rounded-lg border border-dashed bg-card p-3"
      onSubmit={(e) => {
        e.preventDefault();
        onSave();
      }}
    >
      <div className="space-y-1">
        <label htmlFor="in-person-day" className="text-xs font-medium">
          {t("studio.groups.events.in_person.day")}
        </label>
        <Pecha.Input
          id="in-person-day"
          type="date"
          value={draft.day}
          max={maxDay}
          onChange={(e) => onChange({ ...draft, day: e.target.value })}
          className="w-40"
        />
      </div>
      <div className="space-y-1">
        <label htmlFor="in-person-count" className="text-xs font-medium">
          {t("studio.groups.events.in_person.count")}
        </label>
        <Pecha.Input
          id="in-person-count"
          type="number"
          inputMode="numeric"
          min={1}
          step={1}
          value={draft.count}
          onChange={(e) => onChange({ ...draft, count: e.target.value })}
          className="w-36"
        />
      </div>
      <div className="flex gap-2">
        <Pecha.Button type="submit" size="sm" disabled={pending}>
          {pending ? t("studio.common.saving") : t("studio.common.save")}
        </Pecha.Button>
        <Pecha.Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onCancel}
          disabled={pending}
        >
          {t("studio.common.cancel")}
        </Pecha.Button>
      </div>
    </form>
  );
};

/** Share of `target` as a bar width, kept visible when there is any count. */
const barWidth = (value: number, target: number) =>
  value > 0
    ? `${Math.min(100, Math.max((value / target) * 100, 0.75))}%`
    : "0%";

/** Which group accumulation the counts go to, and how far along it is. */
const LinkedAccumulationCard = ({ list }: { list: InPersonCountList }) => {
  const { t } = useTranslate();
  const [imageFailed, setImageFailed] = useState(false);
  const imageUrl = list.group_accumulator_image
    ? resolveGroupAccumulatorImageUrl({ image: list.group_accumulator_image })
    : null;
  const total = list.group_accumulator_total_count ?? 0;
  const inPerson = list.total_count;
  const others = Math.max(0, total - inPerson);
  const target = list.group_accumulator_target_count || null;
  // Without a target the bar shows the in-person share of the total.
  const scale = target ?? Math.max(total, 1);
  const percent = target ? (total / target) * 100 : null;

  return (
    <div className="space-y-3 rounded-lg border bg-muted/40 p-3">
      <div className="flex items-center gap-3">
        {imageUrl && !imageFailed ? (
          <img
            src={imageUrl}
            alt=""
            className="h-12 w-12 shrink-0 rounded-md border object-cover"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-muted">
            <LuCircleDot className="h-5 w-5 text-muted-foreground" />
          </span>
        )}
        <div className="min-w-0">
          <p className="font-medium break-words">
            {list.group_accumulator_title ||
              t("studio.groups.events.in_person.untitled_accumulation")}
          </p>
        </div>
      </div>

      {list.group_accumulator_total_count != null ? (
        <div className="space-y-1.5">
          <div className="flex items-baseline justify-between gap-2 text-xs">
            <span className="text-muted-foreground">
              <span className="text-sm font-semibold text-foreground tabular-nums">
                {total.toLocaleString()}
              </span>{" "}
              {target
                ? t("studio.groups.events.in_person.of_target", {
                    target: target.toLocaleString(),
                  })
                : t("studio.groups.events.in_person.in_total")}
            </span>
            {percent != null ? (
              <span className="font-medium tabular-nums">
                {percent < 0.1 && total > 0 ? "<0.1" : percent.toFixed(1)}%
              </span>
            ) : null}
          </div>
          <div
            role="progressbar"
            aria-label={t("studio.groups.events.in_person.progress_aria")}
            aria-valuemin={0}
            aria-valuemax={scale}
            aria-valuenow={Math.min(total, scale)}
            className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted"
          >
            <div
              className="h-full bg-[#A51C21]"
              style={{ width: barWidth(others, scale) }}
            />
            <div
              className="h-full bg-amber-500"
              style={{ width: barWidth(inPerson, scale) }}
            />
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[#A51C21]" />
              {t("studio.groups.events.in_person.legend_app")}{" "}
              <span className="font-medium text-foreground tabular-nums">
                {others.toLocaleString()}
              </span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-amber-500" />
              {t("studio.groups.events.in_person.legend_in_person")}{" "}
              <span className="font-medium text-foreground tabular-nums">
                {inPerson.toLocaleString()}
              </span>
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
};

/**
 * "Add count" button for an event: opens a sidebar with the event's in-person
 * accumulation, the counts made at the event by people not using the app, one
 * per day, added to the linked group accumulation. Group managers add, correct
 * and remove each day's count there.
 */
const InPersonCountsActions = ({ eventId }: InPersonCountsActionsProps) => {
  const { t } = useTranslate();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<InPersonCount | null>(null);
  const [open, setOpen] = useState(false);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: [...inPersonCountsQueryKey(eventId), page],
    queryFn: () =>
      fetchInPersonCounts(eventId, {
        skip: (page - 1) * PAGE_SIZE,
        limit: PAGE_SIZE,
      }),
    enabled: open,
    placeholderData: (previous) => previous,
    refetchOnWindowFocus: false,
  });

  const timeZone = data?.timezone ?? "UTC";
  const maxDay = todayInTimeZone(timeZone);
  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / PAGE_SIZE));

  const refresh = () =>
    queryClient.invalidateQueries({
      queryKey: inPersonCountsQueryKey(eventId),
    });

  const saveMutation = useMutation({
    mutationFn: ({
      id,
      day,
      count,
    }: {
      id: string | null;
      day: string;
      count: number;
    }) =>
      id
        ? updateInPersonCount(eventId, id, { day, count })
        : createInPersonCount(eventId, { day, count }),
    onSuccess: (_, { id }) => {
      toast.success(
        id
          ? t("studio.groups.events.in_person.updated")
          : t("studio.groups.events.in_person.added"),
      );
      setDraft(null);
      refresh();
    },
    onError: (err) =>
      toast.error(
        getInPersonCountErrorMessage(
          err,
          t("studio.groups.events.in_person.save_error"),
        ),
      ),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteInPersonCount(eventId, id),
    onSuccess: () => {
      toast.success(t("studio.groups.events.in_person.deleted"));
      setDeleteTarget(null);
      // The last row of a page takes the reader back a page.
      if (data && data.items.length === 1 && page > 1) setPage(page - 1);
      refresh();
    },
    onError: (err) =>
      toast.error(
        getInPersonCountErrorMessage(
          err,
          t("studio.groups.events.in_person.delete_error"),
        ),
      ),
  });

  const save = () => {
    if (!draft) return;
    const count = Number(draft.count);
    if (!draft.day) {
      toast.error(t("studio.groups.events.in_person.choose_day"));
      return;
    }
    if (!Number.isInteger(count) || count < 1) {
      toast.error(t("studio.groups.events.in_person.invalid_count"));
      return;
    }
    saveMutation.mutate({ id: draft.id, day: draft.day, count });
  };

  const draftRow = (current: Draft) => (
    <DraftRow
      draft={current}
      maxDay={maxDay}
      pending={saveMutation.isPending}
      onChange={setDraft}
      onSave={save}
      onCancel={() => setDraft(null)}
    />
  );

  const renderList = () => {
    if (isLoading) {
      return (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, index) => (
            <Pecha.Skeleton key={index} className="h-12 w-full rounded-lg" />
          ))}
        </div>
      );
    }
    if (isError) {
      return (
        <p className="text-sm text-red-500">
          {getInPersonCountErrorMessage(
            error,
            t("studio.groups.events.in_person.load_error"),
          )}
        </p>
      );
    }
    if (!data?.items.length) {
      return draft?.id === null ? null : (
        <p className="text-sm text-muted-foreground">
          {t("studio.groups.events.in_person.empty")}
        </p>
      );
    }
    return (
      <ul className="space-y-2">
        {data.items.map((item) =>
          draft?.id === item.id ? (
            <li key={item.id}>{draftRow(draft)}</li>
          ) : (
            <li
              key={item.id}
              className="flex items-center gap-3 rounded-lg border bg-card p-3"
            >
              <div className="min-w-0 flex-1">
                <p className="font-medium">{formatDay(item.day)}</p>
              </div>
              <p className="font-semibold tabular-nums">
                {item.count.toLocaleString()}
              </p>
              <Pecha.Button
                variant="ghost"
                size="icon"
                aria-label={t("studio.groups.events.in_person.edit_aria", {
                  day: item.day,
                })}
                onClick={() =>
                  setDraft({
                    id: item.id,
                    day: item.day,
                    count: String(item.count),
                  })
                }
              >
                <LuPencil className="h-4 w-4" />
              </Pecha.Button>
              <Pecha.Button
                variant="ghost"
                size="icon"
                aria-label={t("studio.groups.events.in_person.delete_aria", {
                  day: item.day,
                })}
                className="text-destructive hover:text-destructive"
                onClick={() => setDeleteTarget(item)}
              >
                <LuTrash2 className="h-4 w-4" />
              </Pecha.Button>
            </li>
          ),
        )}
      </ul>
    );
  };

  const closeSheet = (next: boolean) => {
    setOpen(next);
    if (!next) setDraft(null);
  };

  return (
    <>
      <Pecha.Button
        variant="outline"
        size="sm"
        className="gap-1.5"
        onClick={() => setOpen(true)}
      >
        <LuPlus className="h-4 w-4" />
        {t("studio.groups.events.in_person.open_button")}
      </Pecha.Button>

      <Pecha.Sheet open={open} onOpenChange={closeSheet}>
        <Pecha.SheetContent
          side="right"
          className="w-full sm:max-w-xl flex flex-col gap-0"
        >
          <Pecha.SheetHeader>
            <Pecha.SheetTitle>
              {t("studio.groups.events.in_person.sheet_title")}
            </Pecha.SheetTitle>
            <Pecha.SheetDescription className="sr-only">
              {t("studio.groups.events.in_person.sheet_description")}
            </Pecha.SheetDescription>
          </Pecha.SheetHeader>

          {data?.group_accumulator_id === null ? (
            <p className="px-4 text-sm text-muted-foreground">
              {t("studio.groups.events.in_person.no_accumulation")}
            </p>
          ) : (
            <>
              <div className="px-4 pb-3 space-y-3 border-b">
                {data ? <LinkedAccumulationCard list={data} /> : null}
                <Pecha.Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  disabled={!data || draft?.id === null}
                  onClick={() => setDraft({ id: null, day: maxDay, count: "" })}
                >
                  <LuPlus className="h-4 w-4" />
                  {t("studio.groups.events.in_person.add_day")}
                </Pecha.Button>
              </div>

              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
                {draft?.id === null ? draftRow(draft) : null}
                {renderList()}
              </div>

              {totalPages > 1 ? (
                <div className="border-t">
                  <Pagination
                    currentPage={page}
                    totalPages={totalPages}
                    onPageChange={(next) => {
                      setDraft(null);
                      setPage(next);
                    }}
                  />
                </div>
              ) : null}
            </>
          )}
        </Pecha.SheetContent>
      </Pecha.Sheet>

      <Pecha.AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <Pecha.AlertDialogContent>
          <Pecha.AlertDialogHeader>
            <Pecha.AlertDialogTitle>
              {t("studio.groups.events.in_person.delete_title")}
            </Pecha.AlertDialogTitle>
            <Pecha.AlertDialogDescription>
              {deleteTarget
                ? t("studio.groups.events.in_person.delete_description", {
                    count: deleteTarget.count.toLocaleString(),
                    day: formatDay(deleteTarget.day),
                  })
                : ""}
            </Pecha.AlertDialogDescription>
          </Pecha.AlertDialogHeader>
          <Pecha.AlertDialogFooter>
            <Pecha.AlertDialogCancel>
              {t("studio.common.cancel")}
            </Pecha.AlertDialogCancel>
            <Pecha.AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              disabled={deleteMutation.isPending}
              onClick={(e) => {
                e.preventDefault();
                if (deleteTarget) deleteMutation.mutate(deleteTarget.id);
              }}
            >
              {deleteMutation.isPending
                ? t("studio.common.deleting")
                : t("studio.common.delete")}
            </Pecha.AlertDialogAction>
          </Pecha.AlertDialogFooter>
        </Pecha.AlertDialogContent>
      </Pecha.AlertDialog>
    </>
  );
};

export default InPersonCountsActions;
