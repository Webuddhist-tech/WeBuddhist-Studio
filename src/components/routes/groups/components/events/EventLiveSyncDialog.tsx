import { useState } from "react";
import { useTranslate } from "@tolgee/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { IoMdAdd, IoMdClose } from "react-icons/io";
import { toast } from "sonner";
import { Pecha } from "@/components/ui/shadimport";
import { Checkbox } from "@/components/ui/atoms/checkbox";
import { DialogDescription, DialogFooter } from "@/components/ui/atoms/dialog";
import { getApiErrorMessage } from "@/lib/apiErrors";
import { DEFAULT_TIMEZONE } from "@/schema/EventSchema";
import { eventName, type EventDTO } from "../../api/eventsApi";
import {
  cleanRunTimes,
  deleteYoutubeLiveSync,
  describeRunResult,
  normalizeRunTime,
  runYoutubeLiveSyncNow,
  saveYoutubeLiveSync,
  youtubeLiveSyncQueryKey,
  type YoutubeLiveSyncList,
} from "../../api/youtubeLiveSyncApi";
import { TIMEZONE_OPTIONS } from "../../lib/timezoneOptions";

type EventLiveSyncDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupId: string;
  /** The events the admin ticked. Only these are ever changed. */
  events: EventDTO[];
  /** The group's saved schedules. The form waits for them, so it never starts
   *  from defaults that saving would then write over a real schedule. */
  liveSync: YoutubeLiveSyncList | undefined;
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
};

const timezoneOptions = (current: string) =>
  TIMEZONE_OPTIONS.some((tz) => tz.value === current)
    ? TIMEZONE_OPTIONS
    : [{ value: current, label: current }, ...TIMEZONE_OPTIONS];

type FormProps = Pick<
  EventLiveSyncDialogProps,
  "onOpenChange" | "groupId" | "events"
> & { liveSync: YoutubeLiveSyncList };

const LiveSyncForm = ({
  onOpenChange,
  groupId,
  events,
  liveSync,
}: FormProps) => {
  const { t } = useTranslate();
  const queryClient = useQueryClient();
  const eventIds = events.map((event) => event.id);
  const scheduleByEvent = new Map(
    liveSync.schedules.map((schedule) => [schedule.event_id, schedule]),
  );
  const scheduled = events.filter((event) => scheduleByEvent.has(event.id));
  const existing = scheduleByEvent.get(scheduled[0]?.id ?? "");

  const [enabled, setEnabled] = useState(existing?.enabled ?? true);
  const [times, setTimes] = useState<string[]>(
    existing?.run_times.length ? existing.run_times : [""],
  );
  const [timezone, setTimezone] = useState(
    existing?.timezone ?? DEFAULT_TIMEZONE,
  );

  const refresh = () =>
    queryClient.invalidateQueries({
      queryKey: youtubeLiveSyncQueryKey(groupId),
    });

  const runTimes = cleanRunTimes(times);
  const hasBadTime = times.some(
    (time) => time.trim() !== "" && normalizeRunTime(time) === null,
  );
  const needsTime = enabled && runTimes.length === 0;
  const hasChannel = Boolean(liveSync.channel_url);
  const recurringCount = events.filter((event) => event.is_recurring).length;

  const saveMutation = useMutation({
    mutationFn: () =>
      saveYoutubeLiveSync(groupId, {
        event_ids: eventIds,
        enabled,
        run_times: runTimes,
        timezone,
      }),
    onSuccess: () => {
      const one = events.length === 1;
      toast.success(
        t(
          enabled
            ? one
              ? "studio.groups.events.live_sync.toast_scheduled_one"
              : "studio.groups.events.live_sync.toast_scheduled_other"
            : one
              ? "studio.groups.events.live_sync.toast_paused_one"
              : "studio.groups.events.live_sync.toast_paused_other",
          { count: events.length },
        ),
      );
      refresh();
      onOpenChange(false);
    },
    onError: (err) =>
      toast.error(
        getApiErrorMessage(err, t("studio.groups.events.live_sync.save_error")),
      ),
  });

  const runMutation = useMutation({
    mutationFn: () => runYoutubeLiveSyncNow(groupId, eventIds),
    onSuccess: (result) => {
      toast.success(describeRunResult(result));
      queryClient.invalidateQueries({ queryKey: ["cms-events", groupId] });
      queryClient.invalidateQueries({ queryKey: ["cms-event"] });
    },
    onError: (err) =>
      toast.error(
        getApiErrorMessage(err, t("studio.groups.events.live_sync.run_error")),
      ),
  });

  const removeMutation = useMutation({
    // Every removal is attempted and awaited, so the outcome is known for
    // each event and the lists can be refreshed whatever happened.
    mutationFn: async () => {
      const results = await Promise.allSettled(
        scheduled.map((event) => deleteYoutubeLiveSync(groupId, event.id)),
      );
      return scheduled.filter(
        (_, index) => results[index].status === "rejected",
      );
    },
    onSuccess: (failed) => {
      refresh();
      if (failed.length === 0) {
        toast.success(t("studio.groups.events.live_sync.removed"));
        onOpenChange(false);
        return;
      }
      toast.error(
        t("studio.groups.events.live_sync.remove_partial_error", {
          events: failed.map((event) => eventName(event)).join(", "),
        }),
      );
    },
    onError: (err) => {
      refresh();
      toast.error(
        getApiErrorMessage(
          err,
          t("studio.groups.events.live_sync.remove_error"),
        ),
      );
    },
  });

  const busy =
    saveMutation.isPending || runMutation.isPending || removeMutation.isPending;

  const setTimeAt = (index: number, value: string) =>
    setTimes((current) =>
      current.map((item, i) => (i === index ? value : item)),
    );

  return (
    <>
      <Pecha.DialogHeader>
        <Pecha.DialogTitle>
          {t("studio.groups.events.live_sync.title")}
        </Pecha.DialogTitle>
        <DialogDescription>
          {t("studio.groups.events.live_sync.description")}
        </DialogDescription>
      </Pecha.DialogHeader>

      <div className="space-y-4">
        <div className="space-y-1">
          <span className="text-sm font-medium">
            {t("studio.groups.events.live_sync.events_count", {
              count: events.length,
            })}
          </span>
          <ul className="max-h-28 space-y-0.5 overflow-y-auto rounded-md border p-2 text-sm">
            {events.map((event) => (
              <li key={event.id} className="truncate">
                {eventName(event)}
                {scheduleByEvent.has(event.id) ? (
                  <span className="text-muted-foreground">
                    {" "}
                    · {t("studio.groups.events.live_sync.scheduled_badge")}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>

        {!hasChannel ? (
          <p className="rounded-md border border-destructive/40 bg-destructive/5 p-2 text-sm text-destructive">
            {t("studio.groups.events.live_sync.no_channel")}
          </p>
        ) : (
          <p className="truncate text-xs text-muted-foreground">
            {t("studio.groups.events.live_sync.channel", {
              url: liveSync.channel_url ?? "",
            })}
          </p>
        )}

        {recurringCount > 0 ? (
          <p className="text-xs text-muted-foreground">
            {recurringCount === 1
              ? t("studio.groups.events.live_sync.recurring_one")
              : t("studio.groups.events.live_sync.recurring_other", {
                  count: recurringCount,
                })}
          </p>
        ) : null}

        {scheduled.length > 1 ? (
          <p className="text-xs text-muted-foreground">
            {t("studio.groups.events.live_sync.replaces_all", {
              count: events.length,
            })}
          </p>
        ) : null}

        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={enabled}
            onCheckedChange={(value) => setEnabled(value === true)}
            disabled={busy}
          />
          {t("studio.groups.events.live_sync.enabled")}
        </label>

        <div className="space-y-2">
          <span className="text-sm font-medium">
            {t("studio.groups.events.live_sync.check_at")}
          </span>
          {times.map((time, index) => (
            <div key={index} className="flex items-center gap-2">
              <Pecha.Input
                type="time"
                value={time}
                onChange={(e) => setTimeAt(index, e.target.value)}
                disabled={busy}
                aria-label={t("studio.groups.events.live_sync.time_aria", {
                  number: index + 1,
                })}
                className="w-40 bg-white dark:bg-[#181818]"
              />
              {times.length > 1 ? (
                <button
                  type="button"
                  aria-label={t(
                    "studio.groups.events.live_sync.remove_time_aria",
                    { number: index + 1 },
                  )}
                  onClick={() =>
                    setTimes((current) => current.filter((_, i) => i !== index))
                  }
                  disabled={busy}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <IoMdClose className="h-5 w-5" />
                </button>
              ) : null}
            </div>
          ))}
          <Pecha.Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1"
            disabled={busy || times.length >= 12}
            onClick={() => setTimes((current) => [...current, ""])}
          >
            <IoMdAdd className="h-4 w-4" />{" "}
            {t("studio.groups.events.live_sync.add_time")}
          </Pecha.Button>
          {hasBadTime ? (
            <p className="text-sm text-destructive">
              {t("studio.groups.events.live_sync.bad_time")}
            </p>
          ) : null}
          {needsTime && !hasBadTime ? (
            <p className="text-sm text-destructive">
              {t("studio.groups.events.live_sync.needs_time")}
            </p>
          ) : null}
        </div>

        <div className="space-y-1">
          <span className="text-sm font-medium">
            {t("studio.groups.events.date.timezone")}
          </span>
          <Pecha.Select
            value={timezone}
            onValueChange={setTimezone}
            disabled={busy}
          >
            <Pecha.SelectTrigger className="w-full bg-white dark:bg-[#181818]">
              <Pecha.SelectValue
                placeholder={t(
                  "studio.groups.events.date.timezone_placeholder",
                )}
              />
            </Pecha.SelectTrigger>
            <Pecha.SelectContent>
              {timezoneOptions(timezone).map((tz) => (
                <Pecha.SelectItem key={tz.value} value={tz.value}>
                  {tz.label}
                </Pecha.SelectItem>
              ))}
            </Pecha.SelectContent>
          </Pecha.Select>
        </div>
      </div>

      <DialogFooter className="gap-2 sm:justify-between">
        <div className="flex gap-2">
          <Pecha.Button
            type="button"
            variant="outline"
            disabled={busy || !hasChannel}
            onClick={() => runMutation.mutate()}
          >
            {runMutation.isPending
              ? t("studio.groups.events.live_sync.checking")
              : t("studio.groups.events.live_sync.run_now")}
          </Pecha.Button>
          {scheduled.length > 0 ? (
            <Pecha.Button
              type="button"
              variant="outline"
              className="text-destructive hover:text-destructive"
              disabled={busy}
              onClick={() => removeMutation.mutate()}
            >
              {removeMutation.isPending
                ? t("studio.groups.events.live_sync.removing")
                : t("studio.groups.events.live_sync.remove_schedule")}
            </Pecha.Button>
          ) : null}
        </div>
        <div className="flex gap-2">
          <Pecha.Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => onOpenChange(false)}
          >
            {t("studio.common.cancel")}
          </Pecha.Button>
          <Pecha.Button
            type="button"
            className="bg-[#A51C21] text-white hover:bg-[#A51C21]/90"
            disabled={busy || hasBadTime || needsTime}
            onClick={() => saveMutation.mutate()}
          >
            {saveMutation.isPending
              ? t("studio.common.saving")
              : t("studio.common.save")}
          </Pecha.Button>
        </div>
      </DialogFooter>
    </>
  );
};

/** Sets, changes or removes the live YouTube sync schedule of the chosen
 *  events. The form is mounted only while open, so it starts from the current
 *  schedule each time. */
const EventLiveSyncDialog = ({
  open,
  onOpenChange,
  groupId,
  events,
  liveSync,
  isLoading = false,
  isError = false,
  onRetry,
}: EventLiveSyncDialogProps) => {
  const { t } = useTranslate();
  return (
    <Pecha.Dialog open={open} onOpenChange={onOpenChange}>
      <Pecha.DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
        {!open ? null : liveSync ? (
          <LiveSyncForm
            onOpenChange={onOpenChange}
            groupId={groupId}
            events={events}
            liveSync={liveSync}
          />
        ) : (
          <>
            <Pecha.DialogHeader>
              <Pecha.DialogTitle>
                {t("studio.groups.events.live_sync.title")}
              </Pecha.DialogTitle>
              <DialogDescription>
                {isError
                  ? t("studio.groups.events.live_sync.load_error")
                  : t("studio.groups.events.live_sync.loading")}
              </DialogDescription>
            </Pecha.DialogHeader>
            {isError && !isLoading ? (
              <DialogFooter>
                <Pecha.Button type="button" variant="outline" onClick={onRetry}>
                  {t("studio.common.retry")}
                </Pecha.Button>
              </DialogFooter>
            ) : null}
          </>
        )}
      </Pecha.DialogContent>
    </Pecha.Dialog>
  );
};

export default EventLiveSyncDialog;
