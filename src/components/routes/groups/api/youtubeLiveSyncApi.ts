import axiosInstance from "@/config/axios-config";
import { tolgee } from "@/i18n/tolgee";

/** A schedule on one event: at these times of day the group's YouTube channel
 *  is checked and the stream that is live is added to the event. */
export interface YoutubeLiveSyncSchedule {
  event_id: string;
  enabled: boolean;
  /** "HH:MM", 24-hour, read in `timezone`. */
  run_times: string[];
  timezone: string;
  last_run_at?: string | null;
  last_run_added?: number | null;
  last_run_error?: string | null;
}

export interface YoutubeLiveSyncList {
  group_id: string;
  /** The group's YouTube channel link that is checked; null when it has none,
   *  in which case nothing runs. */
  channel_url: string | null;
  schedules: YoutubeLiveSyncSchedule[];
}

export interface YoutubeLiveSyncPayload {
  event_ids: string[];
  enabled: boolean;
  run_times: string[];
  timezone: string;
}

export interface YoutubeLiveSyncRunResult {
  live_streams_found: number;
  events_checked: number;
  /** Links added because the event had none in that language. */
  links_added: number;
  /** Links switched to the live stream because the event already had one in
   *  that language. */
  links_replaced?: number;
  skipped_unknown_language: number;
}

export const youtubeLiveSyncQueryKey = (groupId: string) =>
  ["youtube-live-sync", groupId] as const;

const base = (groupId: string) =>
  `/api/v1/cms/groups/${groupId}/youtube-live-sync`;

export async function fetchYoutubeLiveSync(
  groupId: string,
): Promise<YoutubeLiveSyncList> {
  const { data } = await axiosInstance.get<YoutubeLiveSyncList>(base(groupId));
  return data;
}

/** Sets the same schedule on each listed event; other events are untouched. */
export async function saveYoutubeLiveSync(
  groupId: string,
  payload: YoutubeLiveSyncPayload,
): Promise<YoutubeLiveSyncList> {
  const { data } = await axiosInstance.put<YoutubeLiveSyncList>(
    base(groupId),
    payload,
  );
  return data;
}

export async function deleteYoutubeLiveSync(
  groupId: string,
  eventId: string,
): Promise<void> {
  await axiosInstance.delete(`${base(groupId)}/${eventId}`);
}

/** Checks the channel now and adds its live stream to the listed events. */
export async function runYoutubeLiveSyncNow(
  groupId: string,
  eventIds: string[],
): Promise<YoutubeLiveSyncRunResult> {
  const { data } = await axiosInstance.post<YoutubeLiveSyncRunResult>(
    `${base(groupId)}/run`,
    { event_ids: eventIds },
  );
  return data;
}

/** "8:30" -> "08:30"; null when it is not a 24-hour HH:MM time. */
export const normalizeRunTime = (value: string): string | null => {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return `${String(hour).padStart(2, "0")}:${match[2]}`;
};

/** Valid, de-duplicated, sorted times; blank rows are dropped. */
export const cleanRunTimes = (values: string[]): string[] =>
  [
    ...new Set(
      values
        .map(normalizeRunTime)
        .filter((time): time is string => time !== null),
    ),
  ].sort();

/** "08:30" -> "8:30 AM", for showing a time in the list. */
export const formatRunTime = (value: string): string => {
  const normalized = normalizeRunTime(value);
  if (!normalized) return value;
  const [hour, minute] = normalized.split(":").map(Number);
  const suffix = hour >= 12 ? "PM" : "AM";
  return `${hour % 12 || 12}:${String(minute).padStart(2, "0")} ${suffix}`;
};

/** One sentence for the toast after "Run now". */
export const describeRunResult = (result: YoutubeLiveSyncRunResult): string => {
  const added = result.links_added;
  const replaced = result.links_replaced ?? 0;
  if (added > 0 && replaced > 0) {
    return tolgee.t("studio.groups.shared.live_sync.added_and_replaced", {
      added,
      replaced,
    });
  }
  if (added > 0) {
    return added === 1
      ? tolgee.t("studio.groups.shared.live_sync.added_one")
      : tolgee.t("studio.groups.shared.live_sync.added_other", {
          count: added,
        });
  }
  if (replaced > 0) {
    return replaced === 1
      ? tolgee.t("studio.groups.shared.live_sync.replaced_one")
      : tolgee.t("studio.groups.shared.live_sync.replaced_other", {
          count: replaced,
        });
  }
  if (result.live_streams_found === 0) {
    return tolgee.t("studio.groups.shared.live_sync.none_live");
  }
  if (result.skipped_unknown_language > 0) {
    return tolgee.t("studio.groups.shared.live_sync.unknown_language");
  }
  return tolgee.t("studio.groups.shared.live_sync.already_linked");
};
