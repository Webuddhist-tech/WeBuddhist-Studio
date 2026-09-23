import axiosInstance from "@/config/axios-config";
import { uploadImageToS3 } from "@/components/routes/task/api/taskApi";
import { makeLinkedContentSearchFn } from "@/components/routes/groups/api/groupPickerApi";
import { searchAccumulatorPresets } from "@/components/routes/groups/api/accumulatorPresetSearchApi";
import { makeGroupAccumulatorSearchFn } from "@/components/routes/groups/api/groupAccumulatorsApi";
import { fetchChantCollection } from "@/components/routes/groups/api/chantsApi";
import type { EventLocation } from "@/components/routes/groups/api/locationsApi";
import type { FkOption } from "@/components/routes/groups/components/FkMultiSearchSelector";
import type {
  EventFormat,
  EventFormData,
  EventLinkRow,
  EventMetadataRow,
  EventYoutubeRow,
  LanguageCode,
  RecurrenceFormData,
} from "@/schema/EventSchema";
import {
  DEFAULT_END_TIME,
  DEFAULT_START_TIME,
  DEFAULT_TIMEZONE,
} from "@/schema/EventSchema";
import {
  LANGUAGE_CODE_ORDER,
  normalizeLanguageCode,
} from "@/lib/languageCodes";
import { capitalizeFirstLetter } from "@/lib/textUtils";
import {
  dateOnlyToDate,
  dateToDateOnly,
  fromBackendISO,
  toBackendISO,
} from "@/lib/utils";

export interface ImageUrlModel {
  thumbnail: string;
  medium: string;
  original: string;
}

export interface EventMetadataDTO {
  id: string;
  name: string;
  description?: string;
  language: string;
}

export type EventMetadataResponse =
  | EventMetadataDTO
  | EventMetadataDTO[]
  | null;

export interface EventLinkDTO {
  id: string;
  type: string;
  url: string;
  label?: string;
  language: string;
  display_order: number;
}

export interface EventYoutubeDTO {
  id: string;
  url: string;
  label?: string;
  language: string;
  display_order: number;
}

export interface RecurrenceDTO {
  frequency: string;
  date_system: string;
  calendar_type?: string;
  month?: number;
  day?: number;
  day_of_week?: number;
  duration_days: number;
}

export interface RecurrenceInput {
  frequency: string;
  date_system: string;
  calendar_type?: string;
  month?: number | null;
  day?: number | null;
  day_of_week?: number | null;
  duration_days: number;
}

export interface EventDTO {
  id: string;
  group_id: string;
  plan_id?: string;
  series_id?: string;
  accumulator_id?: string;
  group_accumulator_id?: string;
  group_recitation_collection_id?: string;
  location_id?: string;
  location?: EventLocation;
  event_format: EventFormat;
  chat_enabled?: boolean;
  notifications_enabled?: boolean;
  chat_room_id?: string | null;
  start_date: string;
  end_date: string;
  timezone?: string | null;
  is_one_day: boolean;
  featured: boolean;
  is_recurring?: boolean;
  recurrence?: RecurrenceDTO;
  occurrence_date?: string;
  metadata: EventMetadataResponse;
  links?: EventLinkDTO[];
  youtube?: EventYoutubeDTO[];
  image?: ImageUrlModel;
  image_url?: string;
  participant_count?: number;
  created_at: string;
  created_by: string;
  updated_at?: string;
}

export interface EventsResponse {
  events: EventDTO[];
  total: number;
  skip: number;
  limit: number;
}

export interface EventMetadataInput {
  name: string;
  description?: string;
  language: LanguageCode;
}

export interface EventLinkInput {
  type: string;
  url: string;
  label?: string;
  language: LanguageCode;
  display_order: number;
}

export interface EventYoutubeInput {
  url: string;
  label?: string;
  language: LanguageCode;
  display_order: number;
}

export interface CreateEventRequest {
  group_id: string;
  start_date?: string;
  end_date?: string;
  timezone?: string;
  metadata: EventMetadataInput[];
  links?: EventLinkInput[];
  youtube?: EventYoutubeInput[];
  image_url?: string;
  plan_id?: string;
  series_id?: string;
  accumulator_id?: string;
  group_accumulator_id?: string;
  group_recitation_collection_id?: string;
  location_id?: string;
  event_format?: EventFormat;
  chat_enabled?: boolean;
  notifications_enabled?: boolean;
  recurrence?: RecurrenceInput;
}

export interface UpdateEventRequest {
  group_id?: string;
  start_date?: string;
  end_date?: string;
  timezone?: string;
  metadata?: EventMetadataInput[];
  links?: EventLinkInput[];
  youtube?: EventYoutubeInput[];
  image_url?: string;
  plan_id?: string | null;
  series_id?: string | null;
  accumulator_id?: string | null;
  group_accumulator_id?: string | null;
  group_recitation_collection_id?: string | null;
  location_id?: string | null;
  event_format?: EventFormat;
  chat_enabled?: boolean;
  notifications_enabled?: boolean;
  recurrence?: RecurrenceInput | null;
}

export interface EventListFilters {
  group_id?: string;
  plan_id?: string;
  accumulator_id?: string;
  group_recitation_collection_id?: string;
  from_date?: string;
  to_date?: string;
  language?: string;
  skip?: number;
  limit?: number;
}

export const fetchCmsEvents = async (
  filters: EventListFilters = {},
): Promise<EventsResponse> => {
  const { data } = await axiosInstance.get<EventsResponse>(
    `/api/v1/cms/events`,
    { params: filters },
  );
  return data;
};

export const fetchCmsEvent = async (
  eventId: string,
  language?: string,
): Promise<EventDTO> => {
  const { data } = await axiosInstance.get<EventDTO>(
    `/api/v1/cms/events/${eventId}`,
    { params: language ? { language } : undefined },
  );
  return data;
};

export const createCmsEvent = async (
  body: CreateEventRequest,
): Promise<EventDTO> => {
  const { data } = await axiosInstance.post<EventDTO>(
    `/api/v1/cms/events`,
    body,
  );
  return data;
};

export const updateCmsEvent = async (
  eventId: string,
  body: UpdateEventRequest,
): Promise<EventDTO> => {
  const { data } = await axiosInstance.put<EventDTO>(
    `/api/v1/cms/events/${eventId}`,
    body,
  );
  return data;
};

export type EventNotificationAudience = "participants" | "group";

export interface SendEventNotificationRequest {
  title: string;
  body: string;
  audience: EventNotificationAudience;
}

export interface SendEventNotificationResponse {
  event_id: string;
  announcement_id: string;
  audience: EventNotificationAudience;
  sqs_message_id: string;
}

/**
 * Send a one-off notification about an event.
 *
 * Resolves once the backend has queued it, not once devices have it: a 202
 * means accepted for delivery. A 409 means the event's notifications switch
 * is off.
 */
export const sendCmsEventNotification = async (
  eventId: string,
  body: SendEventNotificationRequest,
): Promise<SendEventNotificationResponse> => {
  const { data } = await axiosInstance.post<SendEventNotificationResponse>(
    `/api/v1/cms/events/${eventId}/notifications`,
    body,
  );
  return data;
};

export const deleteCmsEvent = async (eventId: string): Promise<void> => {
  await axiosInstance.delete(`/api/v1/cms/events/${eventId}`);
};

export const toggleEventFeatured = async (eventId: string): Promise<void> => {
  await axiosInstance.patch(`/api/v1/cms/events/${eventId}/featured`);
};

export const uploadEventImage = async (file: File): Promise<string> => {
  const { key } = await uploadImageToS3(file, "");
  return key;
};

export function metadataArray(m: EventMetadataResponse): EventMetadataDTO[] {
  if (!m) return [];
  return Array.isArray(m) ? m : [m];
}

export function eventName(
  event: Pick<EventDTO, "metadata">,
  preferred: LanguageCode = "EN",
): string {
  const arr = metadataArray(event.metadata);
  const name =
    arr.find((e) => e.language.toUpperCase() === preferred)?.name ??
    arr[0]?.name ??
    "Untitled event";
  return capitalizeFirstLetter(name);
}

const LANGUAGE_ORDER = LANGUAGE_CODE_ORDER;

export function mapEventToFormData(event: EventDTO): EventFormData {
  const rows = metadataArray(event.metadata)
    .map((m) => {
      const language = normalizeLanguageCode(m.language);
      if (!language) return null;
      return {
        language,
        name: m.name?.trim() ?? "",
        description: m.description?.trim() ?? "",
      } satisfies EventMetadataRow;
    })
    .filter((r): r is EventMetadataRow => r != null)
    .sort((a, b) => {
      const ai = LANGUAGE_ORDER.indexOf(a.language);
      const bi = LANGUAGE_ORDER.indexOf(b.language);
      const aRank = ai === -1 ? Number.MAX_SAFE_INTEGER : ai;
      const bRank = bi === -1 ? Number.MAX_SAFE_INTEGER : bi;
      if (aRank !== bRank) return aRank - bRank;
      return a.language.localeCompare(b.language);
    });

  const links = [...(event.links ?? [])]
    .sort((a, b) => a.display_order - b.display_order)
    .map(
      (link): EventLinkRow => ({
        type: link.type?.trim() ?? "",
        url: link.url?.trim() ?? "",
        label: link.label?.trim() ?? "",
        // Unlike metadata rows, an unparseable language here defaults to EN
        // rather than dropping the row - links aren't the source of truth
        // for which languages the event supports, so silently deleting a
        // user's link would be worse than mislabeling its language.
        language: normalizeLanguageCode(link.language ?? "") ?? "EN",
      }),
    );

  const youtube = [...(event.youtube ?? [])]
    .sort((a, b) => a.display_order - b.display_order)
    .map(
      (item): EventYoutubeRow => ({
        url: item.url?.trim() ?? "",
        label: item.label?.trim() ?? "",
        language: normalizeLanguageCode(item.language ?? "") ?? "EN",
      }),
    );

  let recurrence: RecurrenceFormData | null = null;
  if (event.recurrence) {
    recurrence = {
      frequency: event.recurrence.frequency as "YEARLY" | "MONTHLY" | "WEEKLY",
      date_system: event.recurrence.date_system as
        | "GREGORIAN"
        | "TIBETAN_LUNAR",
      calendar_type: event.recurrence.calendar_type?.trim() ?? "",
      month: event.recurrence.month ?? null,
      day: event.recurrence.day ?? null,
      day_of_week: event.recurrence.day_of_week ?? null,
      duration_days: event.recurrence.duration_days,
    };
  }

  // Legacy events predating the timezone field have no stored zone; fall
  // back to the CMS default so their dates/times still render sensibly.
  const timezone = event.timezone?.trim() || DEFAULT_TIMEZONE;

  const start = event.start_date
    ? fromBackendISO(event.start_date, timezone)
    : null;
  const end = event.end_date ? fromBackendISO(event.end_date, timezone) : null;

  return {
    is_recurring: Boolean(event.is_recurring),
    start_date: start ? dateToDateOnly(start.date) : "",
    end_date: end ? dateToDateOnly(end.date) : "",
    start_time: start?.hhmm ?? null,
    end_time: end?.hhmm ?? null,
    timezone,
    is_one_day: Boolean(event.is_one_day),
    recurrence,
    metadata:
      rows.length > 0 ? rows : [{ language: "EN", name: "", description: "" }],
    links,
    youtube,
    image_url: event.image_url?.trim() ?? "",
    plan_id: event.plan_id?.trim() ?? "",
    series_id: event.series_id?.trim() ?? "",
    accumulator_id: event.accumulator_id?.trim() ?? "",
    group_accumulator_id: event.group_accumulator_id?.trim() ?? "",
    group_recitation_collection_id:
      event.group_recitation_collection_id?.trim() ?? "",
    location_id: event.location_id?.trim() ?? "",
    event_format: event.event_format,
    chat_enabled: event.chat_enabled ?? true,
    notifications_enabled: event.notifications_enabled ?? true,
  };
}

function buildLinksInput(rows: EventLinkRow[]): EventLinkInput[] {
  return rows.map((row, index) => {
    const label = row.label.trim();
    return {
      type: row.type.trim(),
      url: row.url.trim(),
      language: row.language,
      display_order: index + 1,
      ...(label ? { label } : {}),
    };
  });
}

function linksEqual(a: EventLinkRow[], b: EventLinkRow[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i].type.trim() !== b[i].type.trim()) return false;
    if (a[i].url.trim() !== b[i].url.trim()) return false;
    if (a[i].label.trim() !== b[i].label.trim()) return false;
    if (a[i].language !== b[i].language) return false;
  }
  return true;
}

function buildYoutubeInput(rows: EventYoutubeRow[]): EventYoutubeInput[] {
  return rows.map((row, index) => {
    const label = row.label.trim();
    return {
      url: row.url.trim(),
      language: row.language,
      display_order: index + 1,
      ...(label ? { label } : {}),
    };
  });
}

function youtubeEqual(a: EventYoutubeRow[], b: EventYoutubeRow[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i].url.trim() !== b[i].url.trim()) return false;
    if (a[i].label.trim() !== b[i].label.trim()) return false;
    if (a[i].language !== b[i].language) return false;
  }
  return true;
}

function buildMetadataInput(rows: EventMetadataRow[]): EventMetadataInput[] {
  return rows.map((row) => {
    const description = row.description.trim();
    return {
      language: row.language,
      name: row.name.trim(),
      ...(description ? { description } : {}),
    };
  });
}

function composeBackendDate(
  dateOnly: string,
  hhmm: string | null | undefined,
  fallbackHhmm: string,
  timezone: string,
): string {
  return toBackendISO(dateOnlyToDate(dateOnly), hhmm || fallbackHhmm, timezone);
}

/**
 * For a recurring event, the calendar date comes from the recurrence rule
 * (day/month), not from a picker — only the time-of-day is meaningful here.
 * The backend derives the actual occurrence dates and keeps just the time
 * component off this value, so any anchor date works; "now" is used since
 * there's nothing more meaningful to pick.
 */
function composeRecurrenceTimeAnchor(
  hhmm: string | null | undefined,
  fallbackHhmm: string,
  timezone: string,
): string {
  return toBackendISO(new Date(), hhmm || fallbackHhmm, timezone);
}

function buildRecurrenceInput(recurrence: RecurrenceFormData): RecurrenceInput {
  const calendarType = recurrence.calendar_type.trim();
  return {
    frequency: recurrence.frequency,
    date_system: recurrence.date_system,
    ...(calendarType ? { calendar_type: calendarType } : {}),
    month: recurrence.month,
    day: recurrence.day,
    day_of_week: recurrence.day_of_week,
    duration_days: recurrence.duration_days,
  };
}

export function buildCreateEventBody(
  data: EventFormData,
  groupId: string,
): CreateEventRequest {
  const imageUrl = data.image_url.trim();
  const planId = data.plan_id.trim();
  const seriesId = data.series_id.trim();
  const accumulatorId = data.accumulator_id.trim();
  const groupAccumulatorId = data.group_accumulator_id.trim();
  const chantCollectionId = data.group_recitation_collection_id.trim();
  const locationId = data.location_id.trim();

  const timezone = data.timezone.trim() || DEFAULT_TIMEZONE;

  const body: CreateEventRequest = {
    group_id: groupId,
    timezone,
    metadata: buildMetadataInput(data.metadata),
    ...(data.links.length ? { links: buildLinksInput(data.links) } : {}),
    ...(data.youtube.length
      ? { youtube: buildYoutubeInput(data.youtube) }
      : {}),
    ...(imageUrl ? { image_url: imageUrl } : {}),
    ...(planId ? { plan_id: planId } : {}),
    ...(seriesId ? { series_id: seriesId } : {}),
    ...(accumulatorId ? { accumulator_id: accumulatorId } : {}),
    ...(groupAccumulatorId ? { group_accumulator_id: groupAccumulatorId } : {}),
    ...(chantCollectionId
      ? { group_recitation_collection_id: chantCollectionId }
      : {}),
    ...(locationId ? { location_id: locationId } : {}),
    event_format: data.event_format,
    chat_enabled: data.chat_enabled,
    notifications_enabled: data.notifications_enabled,
  };

  if (data.is_recurring && data.recurrence) {
    body.recurrence = buildRecurrenceInput(data.recurrence);
    body.start_date = composeRecurrenceTimeAnchor(
      data.start_time,
      DEFAULT_START_TIME,
      timezone,
    );
    body.end_date = composeRecurrenceTimeAnchor(
      data.end_time,
      DEFAULT_END_TIME,
      timezone,
    );
  } else {
    body.start_date = composeBackendDate(
      data.start_date,
      data.start_time,
      DEFAULT_START_TIME,
      timezone,
    );
    body.end_date = composeBackendDate(
      data.end_date,
      data.end_time,
      DEFAULT_END_TIME,
      timezone,
    );
  }

  return body;
}

async function resolveLinkOption(
  id: string,
  fallbackLabel: string,
  searchFn: (params: {
    search?: string;
    skip?: number;
    limit?: number;
  }) => Promise<{
    items: FkOption[];
    skip: number;
    limit: number;
    total: number;
  }>,
  fallbackKind?: "plan" | "series",
): Promise<FkOption> {
  const PAGE = 20;
  const MAX_PAGES = 5;
  try {
    for (let page = 0; page < MAX_PAGES; page++) {
      const res = await searchFn({ skip: page * PAGE, limit: PAGE });
      const match = res.items.find((item) => item.id === id);
      if (match) return match;
      const fetched = res.skip + res.items.length;
      if (fetched >= res.total || res.items.length === 0) break;
    }
  } catch {}
  return {
    id,
    title: fallbackLabel,
    ...(fallbackKind ? { kind: fallbackKind } : {}),
  };
}

export function resolveLinkedContent(
  groupId: string,
  id: string,
  kind: "plan" | "series",
): Promise<FkOption> {
  const fallback = kind === "series" ? "Linked series" : "Linked plan";
  return resolveLinkOption(
    id,
    fallback,
    makeLinkedContentSearchFn(groupId),
    kind,
  );
}

export function resolveLinkedAccumulator(id: string): Promise<FkOption> {
  return resolveLinkOption(id, "Linked accumulator", searchAccumulatorPresets);
}

export function resolveLinkedGroupAccumulator(
  groupId: string,
  id: string,
): Promise<FkOption> {
  return resolveLinkOption(
    id,
    "Linked group accumulator",
    makeGroupAccumulatorSearchFn(groupId),
  );
}

export async function resolveLinkedChantCollection(
  groupId: string,
  id: string,
): Promise<FkOption> {
  try {
    const collection = await fetchChantCollection(groupId, id);
    return {
      id: collection.id,
      title: collection.name?.trim() || "Linked chant collection",
      ...(collection.img_url ? { image_url: collection.img_url } : {}),
    };
  } catch {
    return { id, title: "Linked chant collection" };
  }
}

function metadataEqual(a: EventMetadataRow[], b: EventMetadataRow[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i].language !== b[i].language) return false;
    if (a[i].name.trim() !== b[i].name.trim()) return false;
    if (a[i].description.trim() !== b[i].description.trim()) return false;
  }
  return true;
}

export function buildUpdateEventBody(
  data: EventFormData,
  original: EventFormData,
): UpdateEventRequest {
  const body: UpdateEventRequest = {};

  const timezone = data.timezone.trim() || DEFAULT_TIMEZONE;
  const originalTimezone = original.timezone.trim() || DEFAULT_TIMEZONE;
  // Always send the timezone: the composed start/end instants below are only
  // meaningful together with the zone that produced them.
  body.timezone = timezone;

  const dateInputsChanged =
    data.start_date !== original.start_date ||
    data.end_date !== original.end_date ||
    data.start_time !== original.start_time ||
    data.end_time !== original.end_time ||
    timezone !== originalTimezone;

  if (dateInputsChanged && !data.is_recurring) {
    body.start_date = composeBackendDate(
      data.start_date,
      data.start_time,
      DEFAULT_START_TIME,
      timezone,
    );
    body.end_date = composeBackendDate(
      data.end_date,
      data.end_time,
      DEFAULT_END_TIME,
      timezone,
    );
  }

  if (!metadataEqual(data.metadata, original.metadata)) {
    body.metadata = buildMetadataInput(data.metadata);
  }

  if (!linksEqual(data.links, original.links)) {
    body.links = buildLinksInput(data.links);
  }

  if (!youtubeEqual(data.youtube, original.youtube)) {
    body.youtube = buildYoutubeInput(data.youtube);
  }

  const nextImageUrl = data.image_url.trim();
  const prevImageUrl = original.image_url.trim();
  if (nextImageUrl !== prevImageUrl) {
    body.image_url = nextImageUrl;
  }

  // These are unlink-able FK fields: an empty value means "clear the link"
  // and must be sent as `null`, not `""` — the backend interprets an empty
  // string as an invalid UUID rather than an unlink instruction.
  const nullableFkKeys: (keyof Pick<
    EventFormData,
    "plan_id" | "series_id" | "accumulator_id" | "group_accumulator_id"
  >)[] = ["plan_id", "series_id", "accumulator_id", "group_accumulator_id"];
  for (const key of nullableFkKeys) {
    const next = data[key].trim();
    const prev = original[key].trim();
    if (next !== prev) body[key] = next || null;
  }

  const nextChant = data.group_recitation_collection_id.trim();
  const prevChant = original.group_recitation_collection_id.trim();
  if (nextChant !== prevChant) {
    body.group_recitation_collection_id = nextChant || null;
  }

  const nextLocation = data.location_id.trim();
  const prevLocation = original.location_id.trim();
  if (nextLocation !== prevLocation) {
    body.location_id = nextLocation || null;
  }

  if (data.event_format !== original.event_format) {
    body.event_format = data.event_format;
  }

  if (data.notifications_enabled !== original.notifications_enabled) {
    body.notifications_enabled = data.notifications_enabled;
  }
  if (data.chat_enabled !== original.chat_enabled) {
    body.chat_enabled = data.chat_enabled;
  }

  // Handle recurrence changes
  const recurrenceTimeChanged =
    data.start_time !== original.start_time ||
    data.end_time !== original.end_time ||
    timezone !== originalTimezone;

  if (data.is_recurring !== original.is_recurring) {
    if (data.is_recurring && data.recurrence) {
      body.recurrence = buildRecurrenceInput(data.recurrence);
      body.start_date = composeRecurrenceTimeAnchor(
        data.start_time,
        DEFAULT_START_TIME,
        timezone,
      );
      body.end_date = composeRecurrenceTimeAnchor(
        data.end_time,
        DEFAULT_END_TIME,
        timezone,
      );
    } else {
      // Explicit null tells the backend to drop the recurrence rule; sending
      // only dates would leave is_recurring=true and the list would still
      // expand the next occurrence (which then disagrees with the detail page).
      body.recurrence = null;
      body.start_date = composeBackendDate(
        data.start_date,
        data.start_time,
        DEFAULT_START_TIME,
        timezone,
      );
      body.end_date = composeBackendDate(
        data.end_date,
        data.end_time,
        DEFAULT_END_TIME,
        timezone,
      );
    }
  } else if (data.is_recurring && data.recurrence && original.recurrence) {
    // Check if the recurrence rule itself changed
    const recurrenceRuleChanged =
      data.recurrence.frequency !== original.recurrence.frequency ||
      data.recurrence.date_system !== original.recurrence.date_system ||
      data.recurrence.calendar_type !== original.recurrence.calendar_type ||
      data.recurrence.month !== original.recurrence.month ||
      data.recurrence.day !== original.recurrence.day ||
      data.recurrence.day_of_week !== original.recurrence.day_of_week ||
      data.recurrence.duration_days !== original.recurrence.duration_days;

    if (recurrenceRuleChanged) {
      body.recurrence = buildRecurrenceInput(data.recurrence);
    }

    // The recurrence rule only pins the calendar day; the start/end time of
    // day rides along on start_date/end_date, so send them whenever the
    // time (or the zone it's interpreted in) changed, even if the rule
    // itself did not.
    if (recurrenceTimeChanged) {
      body.start_date = composeRecurrenceTimeAnchor(
        data.start_time,
        DEFAULT_START_TIME,
        timezone,
      );
      body.end_date = composeRecurrenceTimeAnchor(
        data.end_time,
        DEFAULT_END_TIME,
        timezone,
      );
    }
  }

  return body;
}
