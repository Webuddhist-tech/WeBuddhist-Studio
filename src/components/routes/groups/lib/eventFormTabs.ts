import type { FieldErrors } from "react-hook-form";
import type { EventFormData } from "@/schema/EventSchema";

export type EventTabId =
  | "about"
  | "schedule"
  | "venue"
  | "youtube"
  | "links"
  | "settings";

/** Which form fields each tab owns.
 *
 *  This drives two things the tabbed layout needs and a single scrolling form
 *  did not: the error badge on a tab header, and jumping to the first invalid
 *  tab on a failed submit. `commonValidation` is an object-level `superRefine`,
 *  so a Save from any tab validates the whole event - without this map an error
 *  on a hidden tab would block the submit with nothing on screen to explain it.
 *
 *  Every key of `EventFormData` must appear exactly once; `assertExhaustive`
 *  below fails the build if a new field is added and not placed. */
export const EVENT_TAB_FIELDS = {
  about: ["metadata", "image_url"],
  schedule: [
    "is_recurring",
    "start_date",
    "end_date",
    "start_time",
    "end_time",
    "timezone",
    "is_one_day",
    "recurrence",
  ],
  venue: ["location_id", "event_format"],
  youtube: ["youtube"],
  links: [
    "links",
    "plan_id",
    "series_id",
    "accumulator_id",
    "group_accumulator_id",
    "group_recitation_collection_id",
  ],
  settings: ["chat_enabled", "notifications_enabled"],
} as const satisfies Record<EventTabId, readonly (keyof EventFormData)[]>;

export const EVENT_TABS: readonly { id: EventTabId; label: string }[] = [
  { id: "about", label: "About" },
  { id: "schedule", label: "Schedule" },
  { id: "venue", label: "Venue & location" },
  { id: "youtube", label: "YouTube" },
  { id: "links", label: "Links & content" },
  { id: "settings", label: "Settings" },
];

/** Compile-time check that the map covers `EventFormData` with no field left
 *  unplaced and none claimed by two tabs. */
type PlacedField = (typeof EVENT_TAB_FIELDS)[EventTabId][number];
type Unplaced = Exclude<keyof EventFormData, PlacedField>;
const _assertExhaustive: Unplaced extends never ? true : never = true;
void _assertExhaustive;

/** Tab ids holding at least one field error, in tab order. */
export function tabsWithErrors(
  errors: FieldErrors<EventFormData>,
): EventTabId[] {
  const errored = Object.keys(errors);
  return EVENT_TABS.filter(({ id }) =>
    (EVENT_TAB_FIELDS[id] as readonly string[]).some((field) =>
      errored.includes(field),
    ),
  ).map(({ id }) => id);
}
