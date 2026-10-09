import { format } from "date-fns";
import { fromBackendISO } from "@/lib/utils";
import { DEFAULT_TIMEZONE } from "@/schema/EventSchema";

type EventScheduleSource = {
  start_date?: string | null;
  end_date?: string | null;
  timezone?: string | null;
};

const formatInstant = (iso: string, timezone: string): string => {
  const { date, hhmm } = fromBackendISO(iso, timezone);
  const [hour, minute] = hhmm.split(":").map(Number);
  const withTime = new Date(date);
  withTime.setHours(hour, minute, 0, 0);
  return `${format(date, "MMM d, yyyy")} · ${format(withTime, "h:mm a")}`;
};

export const formatEventScheduleRange = (
  event: EventScheduleSource,
): { start: string; end: string } => {
  const timezone = event.timezone?.trim() || DEFAULT_TIMEZONE;
  if (!event.start_date) return { start: "—", end: "—" };
  try {
    const start = formatInstant(event.start_date, timezone);
    const end = event.end_date ? formatInstant(event.end_date, timezone) : "—";
    return { start, end };
  } catch {
    return {
      start: event.start_date.slice(0, 10),
      end: event.end_date ? event.end_date.slice(0, 10) : "—",
    };
  }
};

/**
 * Listing and detail share this so the same event always shows the same
 * start/end date and time.
 */
export const formatEventSchedule = (event: EventScheduleSource): string => {
  const { start, end } = formatEventScheduleRange(event);
  if (start === "—") return "—";
  if (end === "—" || start === end) return start;
  return `${start} – ${end}`;
};
