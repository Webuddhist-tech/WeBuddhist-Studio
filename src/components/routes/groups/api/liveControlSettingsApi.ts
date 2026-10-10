import axiosInstance from "@/config/axios-config";

/**
 * What Studio sets for the live controller. Per event: its controllers and
 * their tokens, and the room settings. Per edition: short titles, repeated
 * segments and return jumps, shared by every event that recites the edition.
 */

export interface LiveController {
  id: string;
  event_id: string;
  name: string;
  /** The token's last characters, to tell controllers apart. */
  token_hint: string;
  /** The token, for editors to copy. Null once revoked, or if it was not kept. */
  token?: string | null;
  default_text_id: string | null;
  created_by: string;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
}

/** Returned when a token was just set. */
export interface LiveControllerWithToken extends LiveController {
  token: string;
}

export interface CreateControllerPayload {
  name: string;
  /** Left out: the backend generates one. */
  token?: string;
  default_text_id?: string | null;
}

export interface UpdateControllerPayload {
  name?: string;
  token?: string;
  regenerate_token?: boolean;
  /** null clears it. */
  default_text_id?: string | null;
}

export interface EventLiveSettings {
  event_id: string;
  followed_languages: string[];
  fallback_language: string | null;
  record_play_times: boolean;
  lead_max_ms: number;
  updated_at?: string | null;
}

export type EventLiveSettingsPayload = Partial<
  Pick<
    EventLiveSettings,
    | "followed_languages"
    | "fallback_language"
    | "record_play_times"
    | "lead_max_ms"
  >
>;

export interface ShortTitle {
  section_id: string;
  title: string;
  icon: string;
}

export interface RepeatedSegment {
  segment_id: string;
  times: number;
}

export interface ReturnJump {
  /** The same in every language edition, so a count follows the return. */
  key: string;
  after_segment_id: string;
  to_segment_id: string;
  times: number;
  label: Record<string, string>;
}

export interface EditionLiveSettings {
  edition_id: string;
  short_titles: ShortTitle[];
  repeated_segments: RepeatedSegment[];
  return_jumps: ReturnJump[];
  updated_at?: string | null;
}

/** A list left out is kept as it is. */
export type EditionLiveSettingsPayload = Partial<
  Pick<
    EditionLiveSettings,
    "short_titles" | "repeated_segments" | "return_jumps"
  >
>;

/** One check failure, named by where it is in the file or the lists sent. */
export interface ImportIssue {
  path: string;
  message: string;
}

export interface ImportReport {
  ok: boolean;
  applied: boolean;
  editions: {
    edition_id: string;
    short_titles: number | null;
    repeated_segments: number | null;
    return_jumps: number | null;
  }[];
  event: EventLiveSettingsPayload | null;
  errors: ImportIssue[];
}

export interface PlanText {
  text_id: string;
  title: string | null;
  language: string | null;
  plan_id: string;
  day_number: number;
  display_order: number;
}

export interface PlanTexts {
  event_id: string;
  plan_id: string | null;
  series_id: string | null;
  texts: PlanText[];
}

export interface ShortTitleSuggestion {
  section_id: string;
  section_title: string | null;
  title: string;
  icon: string;
}

/** Most times a passage or a segment can be set to. */
export const MAX_TIMES = 21;

const eventBase = (eventId: string) =>
  `/api/v1/cms/events/${encodeURIComponent(eventId)}/live-control`;
const editionBase = (editionId: string) =>
  `/api/v1/cms/live-control/editions/${encodeURIComponent(editionId)}`;

export const liveControlKeys = {
  controllers: (eventId: string) => ["live-control-controllers", eventId],
  eventSettings: (eventId: string) => ["live-control-event-settings", eventId],
  planTexts: (eventId: string) => ["live-control-plan-texts", eventId],
  editionSettings: (editionId: string) => [
    "live-control-edition-settings",
    editionId,
  ],
};

// --- Controllers ------------------------------------------------------------

export const fetchControllers = async (
  eventId: string,
): Promise<LiveController[]> => {
  const { data } = await axiosInstance.get<{ controllers: LiveController[] }>(
    `${eventBase(eventId)}/controllers`,
  );
  return data.controllers ?? [];
};

export const createController = async (
  eventId: string,
  payload: CreateControllerPayload,
): Promise<LiveControllerWithToken> => {
  const { data } = await axiosInstance.post<LiveControllerWithToken>(
    `${eventBase(eventId)}/controllers`,
    payload,
  );
  return data;
};

export const updateController = async (
  eventId: string,
  controllerId: string,
  payload: UpdateControllerPayload,
): Promise<LiveController | LiveControllerWithToken> => {
  const { data } = await axiosInstance.patch<
    LiveController | LiveControllerWithToken
  >(
    `${eventBase(eventId)}/controllers/${encodeURIComponent(controllerId)}`,
    payload,
  );
  return data;
};

export const revokeController = async (
  eventId: string,
  controllerId: string,
): Promise<void> => {
  await axiosInstance.delete(
    `${eventBase(eventId)}/controllers/${encodeURIComponent(controllerId)}`,
  );
};

export const hasToken = (
  controller: LiveController | LiveControllerWithToken,
): controller is LiveControllerWithToken =>
  typeof (controller as LiveControllerWithToken).token === "string";

/**
 * The link that opens the controller already holding its token. The token is
 * in the fragment, so it is never sent to a server or written to a log; the
 * controller saves it and takes it out of the address bar.
 */
export const controllerLink = (
  eventId: string,
  token: string,
  origin = window.location.origin,
) =>
  `${origin}/live-control/${encodeURIComponent(eventId)}#token=${encodeURIComponent(token)}`;

// --- Event settings ----------------------------------------------------------

export const fetchEventLiveSettings = async (
  eventId: string,
): Promise<EventLiveSettings> => {
  const { data } = await axiosInstance.get<EventLiveSettings>(
    `${eventBase(eventId)}/settings`,
  );
  return data;
};

export const saveEventLiveSettings = async (
  eventId: string,
  payload: EventLiveSettingsPayload,
): Promise<EventLiveSettings> => {
  const { data } = await axiosInstance.put<EventLiveSettings>(
    `${eventBase(eventId)}/settings`,
    payload,
  );
  return data;
};

/** The texts in the event's plan, or its series' plans, in plan order. */
export const fetchPlanTexts = async (eventId: string): Promise<PlanTexts> => {
  const { data } = await axiosInstance.get<PlanTexts>(
    `/api/v1/events/${encodeURIComponent(eventId)}/recitation/texts`,
  );
  return data;
};

// --- Edition settings --------------------------------------------------------

export const fetchEditionLiveSettings = async (
  editionId: string,
): Promise<EditionLiveSettings> => {
  const { data } = await axiosInstance.get<EditionLiveSettings>(
    editionBase(editionId),
  );
  return data;
};

/** Each list sent replaces the stored one. A 400 carries the check's issues. */
export const saveEditionLiveSettings = async (
  editionId: string,
  payload: EditionLiveSettingsPayload,
): Promise<EditionLiveSettings> => {
  const { data } = await axiosInstance.put<EditionLiveSettings>(
    editionBase(editionId),
    payload,
  );
  return data;
};

export const suggestShortTitles = async (
  editionId: string,
): Promise<ShortTitleSuggestion[]> => {
  const { data } = await axiosInstance.post<{
    suggestions: ShortTitleSuggestion[];
  }>(`${editionBase(editionId)}/short-titles/suggest`);
  return data.suggestions ?? [];
};

// --- Files -------------------------------------------------------------------

export const fetchSettingsSample = async (): Promise<unknown> => {
  const { data } = await axiosInstance.get(
    "/api/v1/cms/live-control/settings/sample",
  );
  return data;
};

export const fetchEditionTemplate = async (
  editionId: string,
): Promise<unknown> => {
  const { data } = await axiosInstance.get(
    `${editionBase(editionId)}/template`,
  );
  return data;
};

export const fetchSettingsExport = async (
  eventId: string,
): Promise<unknown> => {
  const { data } = await axiosInstance.get(`${eventBase(eventId)}/export`);
  return data;
};

/** Always a report: nothing is written unless the whole file passes. */
export const importSettings = async (
  file: unknown,
  { eventId, dryRun }: { eventId?: string; dryRun: boolean },
): Promise<ImportReport> => {
  const { data } = await axiosInstance.post<ImportReport>(
    "/api/v1/cms/live-control/import",
    file,
    { params: { event_id: eventId, dry_run: dryRun } },
  );
  return data;
};

/** Hands the browser a JSON file to save. */
export const downloadJson = (data: unknown, filename: string) => {
  const blob = new Blob([`${JSON.stringify(data, null, 2)}\n`], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

/** The issues a 400 from a save carries, when it carries any. */
export const issuesFromError = (error: unknown): ImportIssue[] => {
  const detail = (error as { response?: { data?: { detail?: unknown } } })
    ?.response?.data?.detail;
  return Array.isArray(detail)
    ? detail.filter(
        (item): item is ImportIssue =>
          typeof item?.path === "string" && typeof item?.message === "string",
      )
    : [];
};
