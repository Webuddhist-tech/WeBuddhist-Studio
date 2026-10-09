import { useState } from "react";
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
  liveSync: YoutubeLiveSyncList | undefined;
};

const timezoneOptions = (current: string) =>
  TIMEZONE_OPTIONS.some((tz) => tz.value === current)
    ? TIMEZONE_OPTIONS
    : [{ value: current, label: current }, ...TIMEZONE_OPTIONS];

type FormProps = Omit<EventLiveSyncDialogProps, "open">;

const LiveSyncForm = ({
  onOpenChange,
  groupId,
  events,
  liveSync,
}: FormProps) => {
  const queryClient = useQueryClient();
  const eventIds = events.map((event) => event.id);
  const scheduleByEvent = new Map(
    (liveSync?.schedules ?? []).map((schedule) => [
      schedule.event_id,
      schedule,
    ]),
  );
  const scheduled = events.filter((event) => scheduleByEvent.has(event.id));
  const existing = scheduleByEvent.get(scheduled[0]?.id ?? "");

  const [enabled, setEnabled] = useState(existing?.enabled ?? true);
  const [times, setTimes] = useState<string[]>(
    existing?.run_times.length ? existing.run_times : [""],
  );
  const [timezone, setTimezone] = useState(existing?.timezone ?? DEFAULT_TIMEZONE);

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: youtubeLiveSyncQueryKey(groupId) });

  const runTimes = cleanRunTimes(times);
  const hasBadTime = times.some(
    (time) => time.trim() !== "" && normalizeRunTime(time) === null,
  );
  const needsTime = enabled && runTimes.length === 0;
  const hasChannel = Boolean(liveSync?.channel_url);
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
      toast.success(
        `Live sync ${enabled ? "scheduled" : "saved (paused)"} for ${events.length} event${events.length === 1 ? "" : "s"}`,
      );
      refresh();
      onOpenChange(false);
    },
    onError: (err) => toast.error(getApiErrorMessage(err, "Could not save")),
  });

  const runMutation = useMutation({
    mutationFn: () => runYoutubeLiveSyncNow(groupId, eventIds),
    onSuccess: (result) => {
      toast.success(describeRunResult(result));
      queryClient.invalidateQueries({ queryKey: ["cms-events", groupId] });
      queryClient.invalidateQueries({ queryKey: ["cms-event"] });
    },
    onError: (err) => toast.error(getApiErrorMessage(err, "Could not run")),
  });

  const removeMutation = useMutation({
    mutationFn: () =>
      Promise.all(
        scheduled.map((event) => deleteYoutubeLiveSync(groupId, event.id)),
      ),
    onSuccess: () => {
      toast.success("Schedule removed");
      refresh();
      onOpenChange(false);
    },
    onError: (err) => toast.error(getApiErrorMessage(err, "Could not remove")),
  });

  const busy =
    saveMutation.isPending || runMutation.isPending || removeMutation.isPending;

  const setTimeAt = (index: number, value: string) =>
    setTimes((current) => current.map((t, i) => (i === index ? value : t)));

  return (
    <>
      <Pecha.DialogHeader>
        <Pecha.DialogTitle>YouTube live sync</Pecha.DialogTitle>
        <DialogDescription>
          At the times you set, the group&rsquo;s YouTube channel is checked and
          the stream that is live is added to the events below. Its language is
          picked from the stream title. Other events are not changed.
        </DialogDescription>
      </Pecha.DialogHeader>

      <div className="space-y-4">
        <div className="space-y-1">
          <span className="text-sm font-medium">
            Events ({events.length})
          </span>
          <ul className="max-h-28 space-y-0.5 overflow-y-auto rounded-md border p-2 text-sm">
            {events.map((event) => (
              <li key={event.id} className="truncate">
                {eventName(event)}
                {scheduleByEvent.has(event.id) ? (
                  <span className="text-muted-foreground"> · scheduled</span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>

        {!hasChannel ? (
          <p className="rounded-md border border-destructive/40 bg-destructive/5 p-2 text-sm text-destructive">
            This group has no YouTube channel link, so nothing can be added. Add
            one in the group&rsquo;s social links (a /@handle or /channel/ link).
          </p>
        ) : (
          <p className="truncate text-xs text-muted-foreground">
            Channel: {liveSync?.channel_url}
          </p>
        )}

        {recurringCount > 0 ? (
          <p className="text-xs text-muted-foreground">
            {recurringCount === 1
              ? "One selected event is recurring: "
              : `${recurringCount} selected events are recurring: `}
            a link added to it stays on every date of the series.
          </p>
        ) : null}

        {scheduled.length > 1 ? (
          <p className="text-xs text-muted-foreground">
            Saving replaces the schedule on all {events.length} events with the
            one below.
          </p>
        ) : null}

        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={enabled}
            onCheckedChange={(value) => setEnabled(value === true)}
            disabled={busy}
          />
          Enabled
        </label>

        <div className="space-y-2">
          <span className="text-sm font-medium">Check the channel at</span>
          {times.map((time, index) => (
            <div key={index} className="flex items-center gap-2">
              <Pecha.Input
                type="time"
                value={time}
                onChange={(e) => setTimeAt(index, e.target.value)}
                disabled={busy}
                aria-label={`Time ${index + 1}`}
                className="w-40 bg-white dark:bg-[#181818]"
              />
              {times.length > 1 ? (
                <button
                  type="button"
                  aria-label={`Remove time ${index + 1}`}
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
            <IoMdAdd className="h-4 w-4" /> Add time
          </Pecha.Button>
          {hasBadTime ? (
            <p className="text-sm text-destructive">
              Enter each time as hours and minutes.
            </p>
          ) : null}
          {needsTime && !hasBadTime ? (
            <p className="text-sm text-destructive">
              Add at least one time, or turn this off.
            </p>
          ) : null}
        </div>

        <div className="space-y-1">
          <span className="text-sm font-medium">Timezone</span>
          <Pecha.Select value={timezone} onValueChange={setTimezone} disabled={busy}>
            <Pecha.SelectTrigger className="w-full bg-white dark:bg-[#181818]">
              <Pecha.SelectValue placeholder="Select timezone" />
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
            {runMutation.isPending ? "Checking…" : "Run now"}
          </Pecha.Button>
          {scheduled.length > 0 ? (
            <Pecha.Button
              type="button"
              variant="outline"
              className="text-destructive hover:text-destructive"
              disabled={busy}
              onClick={() => removeMutation.mutate()}
            >
              {removeMutation.isPending ? "Removing…" : "Remove schedule"}
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
            Cancel
          </Pecha.Button>
          <Pecha.Button
            type="button"
            className="bg-[#A51C21] text-white hover:bg-[#A51C21]/90"
            disabled={busy || hasBadTime || needsTime}
            onClick={() => saveMutation.mutate()}
          >
            {saveMutation.isPending ? "Saving…" : "Save"}
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
  ...formProps
}: EventLiveSyncDialogProps) => (
  <Pecha.Dialog open={open} onOpenChange={onOpenChange}>
    <Pecha.DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
      {open ? (
        <LiveSyncForm onOpenChange={onOpenChange} {...formProps} />
      ) : null}
    </Pecha.DialogContent>
  </Pecha.Dialog>
);

export default EventLiveSyncDialog;
