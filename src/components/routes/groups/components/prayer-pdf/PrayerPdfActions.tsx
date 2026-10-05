import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { LuCopy, LuDownload, LuHandHeart, LuSettings2 } from "react-icons/lu";
import { toast } from "sonner";
import { Pecha } from "@/components/ui/shadimport";
import { Pagination } from "@/components/ui/molecules/pagination/Pagination";
import { getApiErrorMessage } from "@/lib/apiErrors";
import {
  copyTextFromPromise,
  downloadPrayerPdf,
  fetchAllPrayerRequests,
  fetchPrayerPdfSettings,
  fetchPrayerRequests,
  getPrayerPdfErrorMessage,
  prayerPdfQueryKey,
  prayerRequestsQueryKey,
  prayerRequestsToCsv,
  saveBlobAs,
  todayInTimeZone,
  type PrayerPdfScope,
  type PrayerRequest,
} from "../../api/prayerPdfApi";
import PrayerPdfSettingsDialog from "./PrayerPdfSettingsDialog";

const PAGE_SIZE = 20;
// The server's default too, used until the settings say otherwise.
const DEFAULT_TIME_ZONE = "Asia/Kolkata";

interface PrayerPdfActionsProps {
  scope: PrayerPdfScope;
}

/** `iso` as shown in `timeZone`: the time alone for one day, else date and time. */
const formatPostedAt = (iso: string, timeZone: string, withDate: boolean) => {
  const options: Intl.DateTimeFormatOptions = {
    hour: "numeric",
    minute: "2-digit",
    ...(withDate ? { day: "numeric", month: "short", year: "numeric" } : {}),
  };
  try {
    return new Intl.DateTimeFormat(undefined, { ...options, timeZone }).format(
      new Date(iso),
    );
  } catch {
    return new Intl.DateTimeFormat(undefined, options).format(new Date(iso));
  }
};

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join("") || "?";

const PrayerRequestCard = ({
  request,
  timeZone,
  withDate,
}: {
  request: PrayerRequest;
  timeZone: string;
  withDate: boolean;
}) => {
  const name = request.posted_by || "WeBuddhist Member";
  return (
    <li className="flex gap-3 border border-gray-300 dark:border-[#313132] rounded-md p-3">
      <Pecha.Avatar className="h-9 w-9 shrink-0">
        {request.avatar_url ? (
          <Pecha.AvatarImage src={request.avatar_url} alt="" />
        ) : null}
        <Pecha.AvatarFallback className="text-xs">
          {initials(name)}
        </Pecha.AvatarFallback>
      </Pecha.Avatar>
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <p className="font-medium text-sm truncate">{name}</p>
          {request.intention ? (
            <Pecha.Badge variant="secondary" className="capitalize">
              {request.intention.replace(/[_-]+/g, " ")}
            </Pecha.Badge>
          ) : null}
          <span className="text-xs text-muted-foreground ml-auto">
            {formatPostedAt(request.created_at, timeZone, withDate)}
            {request.is_edited ? " · edited" : ""}
          </span>
        </div>
        <p className="text-sm whitespace-pre-wrap break-words">
          {request.message}
        </p>
      </div>
    </li>
  );
};

/**
 * One "Prayers" button for a group's or an event's chat room. It opens a
 * sidebar listing the room's prayer requests, for a chosen day or every day,
 * with the PDF settings and that day's PDF download. The day starts on today
 * in the settings' timezone each time it opens. Callers render it only
 * for people who may export (OWNER, ADMIN, AUTHOR, super admin), which is what
 * the server enforces too.
 */
const PrayerPdfActions = ({ scope }: PrayerPdfActionsProps) => {
  const [open, setOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [day, setDay] = useState("");
  // Set once someone picks a day (or "All days"); until then the day is
  // today and follows the settings' timezone.
  const [dayChosen, setDayChosen] = useState(false);
  const [page, setPage] = useState(1);

  // A new day starts at its first page.
  useEffect(() => setPage(1), [day]);

  const { data: settings } = useQuery({
    queryKey: prayerPdfQueryKey(scope),
    queryFn: () => fetchPrayerPdfSettings(scope),
    enabled: open,
    refetchOnWindowFocus: false,
  });

  // The settings arrive after the sheet opens, and "today" in their timezone
  // can be a different date from the default's.
  useEffect(() => {
    if (open && !dayChosen && settings?.timezone) {
      setDay(todayInTimeZone(settings.timezone));
    }
  }, [open, dayChosen, settings?.timezone]);

  const openSidebar = () => {
    setDay(todayInTimeZone(settings?.timezone ?? DEFAULT_TIME_ZONE));
    setDayChosen(false);
    setOpen(true);
  };

  const chooseDay = (value: string) => {
    setDay(value);
    setDayChosen(true);
  };

  const {
    data: list,
    isLoading,
    isError,
    error,
    isFetching,
  } = useQuery({
    queryKey: prayerRequestsQueryKey(scope, day || null, page),
    queryFn: () =>
      fetchPrayerRequests(scope, {
        day: day || null,
        skip: (page - 1) * PAGE_SIZE,
        limit: PAGE_SIZE,
      }),
    enabled: open,
    placeholderData: (previous) => previous,
    refetchOnWindowFocus: false,
  });

  const timeZone = list?.timezone ?? settings?.timezone ?? DEFAULT_TIME_ZONE;
  const total = list?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const items = list?.items ?? [];

  const downloadMutation = useMutation({
    mutationFn: (selectedDay: string) => downloadPrayerPdf(scope, selectedDay),
    onSuccess: ({ blob, filename, prayerCount }) => {
      saveBlobAs(blob, filename);
      toast.success(
        prayerCount != null
          ? `Downloaded ${prayerCount} prayer request${prayerCount === 1 ? "" : "s"}`
          : "Prayer PDF downloaded",
      );
    },
    onError: async (err) => toast.error(await getPrayerPdfErrorMessage(err)),
  });

  // Every request the filter matches, not just the page on screen.
  const copyMutation = useMutation({
    mutationFn: async (selectedDay: string | null) => {
      const requests = fetchAllPrayerRequests(scope, selectedDay);
      await copyTextFromPromise(requests.then(prayerRequestsToCsv));
      return (await requests).length;
    },
    onSuccess: (count) =>
      toast.success(
        `Copied ${count} prayer request${count === 1 ? "" : "s"} as CSV`,
      ),
    onError: (err) =>
      toast.error(getApiErrorMessage(err, "Could not copy the prayer list.")),
  });

  const summary = isLoading
    ? "Loading…"
    : `${total} request${total === 1 ? "" : "s"} ${
        day ? "that day" : "on all days, newest first"
      } (${timeZone})`;

  const renderBody = () => {
    if (isLoading) {
      return (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <Pecha.Skeleton key={index} className="h-20 w-full rounded-md" />
          ))}
        </div>
      );
    }
    if (isError) {
      return (
        <p className="text-sm text-red-500 py-8 text-center">
          {getApiErrorMessage(error, "Could not load prayer requests.")}
        </p>
      );
    }
    if (items.length === 0) {
      return (
        <p className="text-sm text-muted-foreground py-12 text-center">
          {day
            ? "There are no prayer requests on this day."
            : "There are no prayer requests yet."}
        </p>
      );
    }
    return (
      <ul
        className={`space-y-2 transition-opacity ${isFetching ? "opacity-60" : ""}`}
      >
        {items.map((request) => (
          <PrayerRequestCard
            key={request.id}
            request={request}
            timeZone={timeZone}
            withDate={!day}
          />
        ))}
      </ul>
    );
  };

  return (
    <>
      <Pecha.Button
        variant="outline"
        size="sm"
        className="gap-1.5"
        onClick={openSidebar}
      >
        <LuHandHeart className="h-4 w-4" />
        Prayers
      </Pecha.Button>

      <Pecha.Sheet open={open} onOpenChange={setOpen}>
        <Pecha.SheetContent
          side="right"
          className="w-full sm:max-w-xl flex flex-col gap-0"
        >
          <Pecha.SheetHeader>
            <Pecha.SheetTitle>Prayer requests</Pecha.SheetTitle>
            <Pecha.SheetDescription>{summary}</Pecha.SheetDescription>
          </Pecha.SheetHeader>

          <div className="px-4 pb-3 space-y-3 border-b">
            <div className="flex items-end gap-2">
              <div className="flex-1 space-y-1.5">
                <label
                  htmlFor="prayer-requests-day"
                  className="text-sm font-bold"
                >
                  Day
                </label>
                <Pecha.Input
                  id="prayer-requests-day"
                  type="date"
                  value={day}
                  max={todayInTimeZone(timeZone)}
                  onChange={(e) => chooseDay(e.target.value)}
                />
              </div>
              {day ? (
                <Pecha.Button
                  variant="ghost"
                  size="sm"
                  onClick={() => chooseDay("")}
                >
                  All days
                </Pecha.Button>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              <Pecha.Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => setSettingsOpen(true)}
              >
                <LuSettings2 className="h-4 w-4" />
                Prayer PDF
              </Pecha.Button>
              <Pecha.Button
                size="sm"
                className="gap-1.5"
                disabled={!day || downloadMutation.isPending}
                title={day ? undefined : "Choose a day to download its PDF"}
                onClick={() => day && downloadMutation.mutate(day)}
              >
                <LuDownload className="h-4 w-4" />
                {downloadMutation.isPending
                  ? "Generating PDF…"
                  : "Download prayers"}
              </Pecha.Button>
              <Pecha.Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                disabled={total === 0 || copyMutation.isPending}
                title="Copy every listed request (name, request) as CSV"
                onClick={() => copyMutation.mutate(day || null)}
              >
                <LuCopy className="h-4 w-4" />
                {copyMutation.isPending ? "Copying…" : "Copy as CSV"}
              </Pecha.Button>
            </div>
            {!day ? (
              <p className="text-xs text-muted-foreground">
                Choose a day to see only its requests and download its PDF.
              </p>
            ) : null}
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4">{renderBody()}</div>

          {totalPages > 1 ? (
            <div className="border-t">
              <Pagination
                currentPage={page}
                totalPages={totalPages}
                onPageChange={setPage}
              />
            </div>
          ) : null}
        </Pecha.SheetContent>
      </Pecha.Sheet>

      <PrayerPdfSettingsDialog
        scope={scope}
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
      />
    </>
  );
};

export default PrayerPdfActions;
