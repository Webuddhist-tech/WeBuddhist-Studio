import { RecurrenceFrequency } from "@/schema/EventSchema";

/** Translation key for an event's format badge, or null for no format. */
export function eventFormatLabelKey(
  value: string | null | undefined,
): string | null {
  switch (value) {
    case "offline":
      return "studio.groups.pages.events.format_offline";
    case "online":
      return "studio.groups.pages.events.format_online";
    case "hybrid":
      return "studio.groups.pages.events.format_hybrid";
    default:
      return null;
  }
}

/** Translation key for an event's recurrence badge. */
export function eventRecurrenceLabelKey(
  isRecurring?: boolean,
  frequency?: string | null,
): string {
  if (!isRecurring) return "studio.groups.pages.events.recurrence_one_time";
  switch (frequency) {
    case RecurrenceFrequency.WEEKLY:
      return "studio.groups.pages.events.recurrence_weekly";
    case RecurrenceFrequency.MONTHLY:
      return "studio.groups.pages.events.recurrence_monthly";
    case RecurrenceFrequency.YEARLY:
      return "studio.groups.pages.events.recurrence_yearly";
    default:
      return "studio.groups.pages.events.recurrence_recurring";
  }
}
