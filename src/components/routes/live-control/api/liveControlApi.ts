import axios from "axios";
import axiosInstance from "@/config/axios-config";
import { tolgee } from "@/i18n/tolgee";
import { fetchTextLanguages, searchTitles } from "@/components/api/searchApi";

/**
 * The live control page runs signed out, so everything here talks to endpoints
 * that take no user session. Positions are authorised by the recitation emit
 * secret instead, in the `X-Recitation-Token` header - the same route the puja
 * controller uses. That secret is one value for the whole backend: whatever
 * holds it can drive any event's recitation, so it is treated like a password.
 */

/** One line of a liturgy, keyed by language in each bucket. */
export interface RecitationSegmentRow {
  recitation?: Record<string, { id: string; content: string }>;
  translations?: Record<string, { id: string; content: string }>;
  transliterations?: Record<string, { id: string; content: string }>;
  adaptations?: Record<string, { id: string; content: string }>;
}

export interface RecitationDetails {
  text_id: string;
  title: string;
  segments: RecitationSegmentRow[];
}

/** A line as the operator drives it: the wire key plus what to show. */
export interface OperatorSegment {
  id: string;
  content: string;
  /**
   * Which row of the recitation this came from. Editions are aligned row for
   * row, not position for position: a row an edition carries no recitation for
   * is dropped from its lines, so the rows are the only thing two editions can
   * be matched on.
   */
  row: number;
}

/** One liturgy of the event's order, as the left-hand list shows it. */
export interface Liturgy {
  textId: string;
  title: string;
}

/** What the page needs of an event: its name, and the liturgies to recite. */
export interface LiveControlEvent {
  title: string;
  collectionId: string | null;
}

/** A text the operator can drive: the liturgy itself, or one of its editions. */
export interface TextEdition {
  textId: string;
  title: string;
  language: string;
}

/** A text with every edition of it the library knows: its translations. */
export interface TextWithEditions {
  text: TextEdition;
  editions: TextEdition[];
}

export interface PositionToPublish {
  textId: string;
  segmentId: string;
  index: number;
  roundNumber: number;
  /** Made by autoplay, so the backend does not time it back into the play times. */
  autoplay?: boolean;
  /**
   * How long the line this move leaves behind was held, on this page's
   * monotonic clock. Measured here because this is the only place that knows
   * when the operator actually left the line: the backend can only subtract two
   * request arrivals, which carries the network, its own liveness check and
   * throttle, and this publisher's send pacing into a figure meant to be speech
   * alone. Left off the first move of a run, and off autoplay's own moves,
   * which are not timed at all.
   */
  elapsedMs?: number;
  /**
   * The line, in this edition, this move follows on from in recitation order
   * when that is not simply the line before it: Next over yigchung, or a Return
   * taken from the end of its passage. The backend times only a step on from
   * the room's last line, so without it those lines never learn a play time.
   */
  fromIndex?: number;
}

/** A publish either landed (202) or did not, with something to show the operator. */
export type PublishResult = { ok: true } | { ok: false; message: string };

/**
 * Segment text for a liturgy. The rows come back language-aligned, so a row is
 * matched by any of its per-language segment ids.
 */
export const fetchRecitationDetails = async (
  textId: string,
  language: string,
): Promise<RecitationDetails> => {
  const normalized = language.trim().toLowerCase();
  const { data } = await axiosInstance.post<RecitationDetails>(
    `/api/v1/recitations/${encodeURIComponent(textId)}`,
    { language: normalized, recitation: [normalized], translations: [] },
  );
  return data;
};

/**
 * Flattens the rows into the lines the operator clicks through, preferring the
 * chosen language and falling back to whichever recitation the row carries.
 * Rows with no segment id are dropped: there would be nothing to publish. Each
 * line keeps the row it came from, so an edition that dropped a row can still
 * be matched line for line against one that did not.
 */
export function toOperatorSegments(
  details: Pick<RecitationDetails, "segments">,
  language: string,
): OperatorSegment[] {
  const normalized = language.trim().toLowerCase();
  return (details.segments ?? [])
    .map((row, index) => {
      const bucket = row.recitation ?? {};
      const segment = bucket[normalized] ?? Object.values(bucket)[0];
      return {
        id: segment?.id ?? "",
        content: segment?.content ?? "",
        row: index,
      };
    })
    .filter((segment) => Boolean(segment.id));
}

/** The event's CMS record, read with the operator's Studio session. */
export const fetchLiveControlEvent = async (
  eventId: string,
): Promise<LiveControlEvent> => {
  const { data } = await axiosInstance.get(
    `/api/v1/cms/events/${encodeURIComponent(eventId)}`,
  );
  const rows = Array.isArray(data?.metadata)
    ? data.metadata
    : data?.metadata
      ? [data.metadata]
      : [];
  const preferred =
    rows.find(
      (row: { language?: string }) => row.language?.toUpperCase() === "EN",
    ) ?? rows[0];
  return {
    title:
      preferred?.name?.trim() || tolgee.t("studio.live_control.untitled_event"),
    collectionId: data?.group_recitation_collection_id ?? null,
  };
};

/** The event's liturgies, in the order they are recited. */
export const fetchLiturgies = async (
  collectionId: string,
): Promise<Liturgy[]> => {
  const { data } = await axiosInstance.get(
    `/api/v1/author/groups/recitation-collections/${encodeURIComponent(collectionId)}`,
  );
  const items: {
    text_id: string;
    title?: string;
    display_order: number;
  }[] = data?.items ?? [];
  return [...items]
    .sort((a, b) => a.display_order - b.display_order)
    .map((item) => ({
      textId: item.text_id,
      title: item.title ?? item.text_id,
    }));
};

/**
 * A text and its translations, which is what the room can be driven in.
 *
 * The library keeps each language as its own text with its own segment ids, so
 * every edition the operator wants followed has to be published in its own
 * right. This is the list to pick those from.
 */
export const fetchTextEditions = async (
  textId: string,
): Promise<TextWithEditions> => {
  const { data } = await axiosInstance.get(
    `/api/v1/texts/${encodeURIComponent(textId)}/versions`,
    { params: { limit: 100 } },
  );
  const asEdition = (row: {
    id?: string;
    title?: string;
    language?: string;
  }): TextEdition => ({
    textId: row?.id ?? "",
    title:
      row?.title?.trim() ||
      (row?.id ?? tolgee.t("studio.live_control.untitled")),
    language: (row?.language ?? "").trim().toLowerCase(),
  });
  const text = asEdition(data?.text ?? { id: textId });
  const editions: TextEdition[] = (data?.versions ?? [])
    .map(asEdition)
    .filter(
      (edition: TextEdition) =>
        edition.textId &&
        edition.textId !== text.textId &&
        edition.textId !== textId,
    );
  // The work keeps the edition id it was opened by. The library answers with
  // its own internal id for the work, but the edition id is what the event's
  // liturgies, the search and the operator's saved texts all carry, so that is
  // the id the room is told about.
  return { text: { ...text, textId }, editions };
};

/** Texts offered to open with one tap, by edition id - on the controller until
 * opened in that browser, and always on the autoplay test. */
export const SUGGESTED_TEXT_IDS = [
  "Zt5c0fe1OMJI1Kh8rp2FM",
  "lEmYv8BrRQkOMPY9ymQpS",
];

/** A text found by name: the edition id to open it by, and what to call it. */
export interface TextSearchResult {
  textId: string;
  title: string;
}

/** Texts whose title matches, by edition id. */
export const searchTextsByTitle = async (
  title: string,
  limit = 10,
): Promise<TextSearchResult[]> => {
  const query = title.trim();
  if (!query) return [];
  const data = await searchTitles({ title: query, limit });
  const rows: { id?: string; title?: string | null }[] = Array.isArray(data)
    ? data
    : (data?.texts ?? data?.results ?? data?.sources ?? []);
  return rows
    .filter((row) => Boolean(row?.id))
    .map((row) => ({
      textId: row.id as string,
      title: row.title?.trim() || (row.id as string),
    }));
};

/** An edition's title, for a text known only by its id. */
export const fetchEditionTitle = async (
  editionId: string,
): Promise<string | null> => {
  const data = await fetchTextLanguages(editionId);
  return data?.title?.trim() || null;
};

/** Bare client: the emit secret authorises these, never a bearer token. */
const emitClient = axios.create({
  baseURL: import.meta.env.VITE_BACKEND_BASE_URL,
});

const emitFailure = (status: number | undefined): string => {
  if (status === 401 || status === 403) {
    return tolgee.t("studio.live_control.errors.token_rejected");
  }
  if (status === 503) {
    return tolgee.t("studio.live_control.errors.token_not_configured");
  }
  if (status === 404) {
    return tolgee.t("studio.live_control.errors.event_not_live");
  }
  if (status === 429) {
    return tolgee.t("studio.live_control.errors.positions_throttled");
  }
  return tolgee.t("studio.live_control.errors.room_unreachable_resend");
};

/**
 * Publishes one position. The event holds a single position, so callers send
 * only the newest one they have landed on.
 *
 * `run` names the unbroken stretch of moves the text has been part of. The
 * backend only times one line against the next within a run, so time the room
 * spent on another text is never learned as this text's.
 *
 * `elapsedMs` on the position is how long the line being left was held. The
 * backend records it rather than timing the move itself, and still decides on
 * its own whether the move is one that may be timed.
 */
export const publishPosition = async (
  eventId: string,
  token: string,
  position: PositionToPublish,
  run?: string,
): Promise<PublishResult> => {
  try {
    await emitClient.post(
      `/api/v1/events/${encodeURIComponent(eventId)}/recitation/position`,
      toWirePosition(position, run),
      { headers: { "X-Recitation-Token": token } },
    );
    return { ok: true };
  } catch (error) {
    const status = axios.isAxiosError(error)
      ? error.response?.status
      : undefined;
    return { ok: false, message: emitFailure(status) };
  }
};

/** A position as the backend reads it, in a `set`, a move or an autoplay step. */
export const toWirePosition = (position: PositionToPublish, run?: string) => ({
  text_id: position.textId,
  segment_id: position.segmentId,
  index: position.index,
  round_number: position.roundNumber,
  ...(position.autoplay ? { autoplay: true } : {}),
  ...(run ? { run } : {}),
  ...(position.elapsedMs === undefined
    ? {}
    : { elapsed_ms: position.elapsedMs }),
  ...(position.fromIndex === undefined
    ? {}
    : { from_index: position.fromIndex }),
});

/** One edition's position within a move, with the run it belongs to. */
export interface MovePosition {
  position: PositionToPublish;
  run?: string;
}

/**
 * Publishes one move - the same line in every edition - in one request. The
 * room is sent the positions in this order and the event keeps the last, so
 * the edition on screen goes last. One request rather than one per edition, so
 * that edition is never held back a round trip behind the others.
 */
export const publishMove = async (
  eventId: string,
  token: string,
  positions: MovePosition[],
): Promise<PublishResult> => {
  try {
    await emitClient.post(
      `/api/v1/events/${encodeURIComponent(eventId)}/recitation/move`,
      {
        positions: positions.map(({ position, run }) =>
          toWirePosition(position, run),
        ),
      },
      { headers: { "X-Recitation-Token": token } },
    );
    return { ok: true };
  } catch (error) {
    const status = axios.isAxiosError(error)
      ? error.response?.status
      : undefined;
    return { ok: false, message: emitFailure(status) };
  }
};

/** One line of an autoplay plan: every edition's position, and its hold. */
export interface AutoplayPlanStep {
  positions: PositionToPublish[];
  durationMs: number;
}

/** Where the backend's autoplay is, as it reports it. */
export interface AutoplayState {
  planId: string | null;
  status: "running" | "stopped";
  /** Why it stopped: finished, stopped, ended or failed. */
  reason: string | null;
  step: number;
  totalSteps: number;
  /** When the current step went out, on the server's clock. */
  stepStartedAtMs: number | null;
  /** How long the current step is held, the room's pace already applied. */
  stepDurationMs: number | null;
  /** The plan is held on its line until it is resumed. */
  held: boolean;
  /** When the hold began, on the server's clock. */
  heldAtMs: number | null;
  /** The room's pace: every recorded time is scaled by it. Below 1 is faster. */
  tempo: number;
  /** How far ahead of its time each line goes to the phones. */
  leadMs: number;
  /** The server's clock when this was sent, to line it up with this page's. */
  serverTimeMs: number;
}

interface AutoplayStateWire {
  plan_id: string | null;
  status: string;
  reason: string | null;
  step: number;
  total_steps: number;
  step_started_at_ms: number | null;
  step_duration_ms: number | null;
  held: boolean;
  held_at_ms: number | null;
  tempo: number;
  lead_ms: number;
  server_time_ms: number;
}

/** Reads an autoplay frame or response; null for anything that is not one. */
export const toAutoplayState = (data: unknown): AutoplayState | null => {
  if (!data || typeof data !== "object") return null;
  const wire = data as Partial<AutoplayStateWire>;
  if (wire.status !== "running" && wire.status !== "stopped") return null;
  return {
    planId: wire.plan_id ?? null,
    status: wire.status,
    reason: wire.reason ?? null,
    step: wire.step ?? 0,
    totalSteps: wire.total_steps ?? 0,
    stepStartedAtMs: wire.step_started_at_ms ?? null,
    stepDurationMs: wire.step_duration_ms ?? null,
    held: wire.held === true,
    heldAtMs: wire.held_at_ms ?? null,
    tempo: typeof wire.tempo === "number" ? wire.tempo : 1,
    leadMs: typeof wire.lead_ms === "number" ? wire.lead_ms : 0,
    serverTimeMs: wire.server_time_ms ?? Date.now(),
  };
};

/**
 * A command to the plan the backend is running. A hand move is a `seek` to one
 * of the plan's own steps - nothing is rebuilt or resent - so it reaches the
 * room as fast as a line does. `expected_step` is the step the operator was
 * looking at: a press that races the plan's own move on is not applied twice,
 * and a seek to the step after it teaches the backend the room's pace.
 */
export type AutoplayCommand =
  | { type: "seek"; planId: string; step: number; expectedStep?: number }
  | { type: "hold"; planId?: string | null }
  | { type: "resume"; planId?: string | null }
  | { type: "settings"; leadMs?: number; tempo?: number };

/** The command's fields as the backend reads them, socket and HTTP alike. */
export const toWireCommand = (command: AutoplayCommand) => {
  switch (command.type) {
    case "seek":
      return {
        plan_id: command.planId,
        step: command.step,
        ...(command.expectedStep === undefined
          ? {}
          : { expected_step: command.expectedStep }),
      };
    case "hold":
    case "resume":
      return command.planId ? { plan_id: command.planId } : {};
    case "settings":
      return {
        ...(command.leadMs === undefined ? {} : { lead_ms: command.leadMs }),
        ...(command.tempo === undefined ? {} : { tempo: command.tempo }),
      };
  }
};

/** The reasons a command is turned down, in the operator's words. */
export const commandRefused = (
  code: unknown,
  message: unknown,
  status?: number,
): string => {
  if (code === "THROTTLED" || status === 429) {
    return tolgee.t("studio.live_control.errors.lines_throttled");
  }
  if (code === "NOT_RUNNING" || status === 409) {
    return tolgee.t("studio.live_control.errors.autoplay_not_running");
  }
  if (typeof message === "string" && message) return message;
  return tolgee.t("studio.live_control.errors.server_try_again");
};

/** A command by HTTP, for when the socket is not open. */
export const sendAutoplayCommand = async (
  eventId: string,
  token: string,
  command: AutoplayCommand,
): Promise<AutoplayResult> => {
  try {
    const { data } = await emitClient.post(
      `/api/v1/events/${encodeURIComponent(eventId)}/recitation/autoplay/${command.type}`,
      toWireCommand(command),
      { headers: { "X-Recitation-Token": token } },
    );
    const state = toAutoplayState(data);
    return state
      ? { ok: true, state }
      : {
          ok: false,
          message: tolgee.t("studio.live_control.errors.unreadable_answer"),
        };
  } catch (error) {
    const status = axios.isAxiosError(error)
      ? error.response?.status
      : undefined;
    if (status === 409 || status === 429) {
      return { ok: false, message: commandRefused(null, null, status) };
    }
    return autoplayFailure(error);
  }
};

/**
 * A command's answer. `lost` marks one that never got an answer - the request
 * went quiet, or its connection closed - as against one the server turned
 * down: a lost command may have been carried out.
 */
export type AutoplayResult =
  | { ok: true; state: AutoplayState }
  | { ok: false; message: string; lost?: boolean };

const autoplayFailure = (error: unknown): AutoplayResult => {
  const status = axios.isAxiosError(error) ? error.response?.status : undefined;
  const lost = axios.isAxiosError(error) && !error.response;
  if (status === 503) {
    return {
      ok: false,
      message: tolgee.t("studio.live_control.errors.autoplay_unavailable"),
    };
  }
  return {
    ok: false,
    message: emitFailure(status),
    ...(lost ? { lost: true } : {}),
  };
};

/**
 * How long a start is given before the page asks the server whether a new
 * plan is already running. The request itself is still waited out: treating
 * this mark as a failed start would let a pause stop before that start lands,
 * and leave autoplay running.
 */
const START_OBSERVE_MS = 15_000;

/**
 * The plan this start put in place, if the server is already running one that
 * is not `priorPlanId`. Null when the answer so far is the plan that was
 * already running, or none.
 */
const startedPlan = (
  state: AutoplayState | null,
  priorPlanId: string | null,
): AutoplayResult | null => {
  if (state?.status !== "running") return null;
  if (!state.planId || (priorPlanId !== null && state.planId === priorPlanId)) {
    return null;
  }
  return { ok: true, state };
};

/**
 * Hands a plan to the backend, which from then on moves the room on by itself
 * - whatever this page, or the phone it is on, does. Replaces any plan already
 * running. `firstStepElapsedMs` says the first line is already with the room
 * and has been for that long, so it is not sent again.
 *
 * `priorPlanId` is the plan already running, when there is one. A late answer
 * is not read as a failed start while the server shows a different plan
 * running: that plan is this start. Until the request itself finishes, a
 * following pause keeps waiting, so its stop cannot arrive first.
 */
export const startAutoplay = async (
  eventId: string,
  token: string,
  steps: AutoplayPlanStep[],
  firstStepElapsedMs?: number,
  priorPlanId: string | null = null,
): Promise<AutoplayResult> => {
  const post = emitClient
    .post(
      `/api/v1/events/${encodeURIComponent(eventId)}/recitation/autoplay`,
      {
        steps: steps.map((step) => ({
          positions: step.positions.map((position) => toWirePosition(position)),
          duration_ms: step.durationMs,
        })),
        ...(firstStepElapsedMs === undefined
          ? {}
          : { first_step_elapsed_ms: firstStepElapsedMs }),
      },
      { headers: { "X-Recitation-Token": token } },
    )
    .then(({ data }) => {
      const state = toAutoplayState(data);
      return state
        ? ({ ok: true, state } as const)
        : ({
            ok: false,
            message: tolgee.t("studio.live_control.errors.unreadable_answer"),
          } as const);
    })
    .catch((error: unknown) => autoplayFailure(error));

  let observeTimer: ReturnType<typeof setTimeout> | undefined;
  const observed = new Promise<AutoplayResult | null>((resolve) => {
    observeTimer = setTimeout(() => {
      void fetchAutoplayState(eventId, token).then((state) => {
        resolve(startedPlan(state, priorPlanId));
      });
    }, START_OBSERVE_MS);
  });

  try {
    const winner = await Promise.race([
      post.then((result) => ({ fromPost: true as const, result })),
      observed.then((result) => ({ fromPost: false as const, result })),
    ]);
    if (winner.fromPost) return winner.result;
    if (winner.result) return winner.result;
    return await post;
  } finally {
    if (observeTimer !== undefined) clearTimeout(observeTimer);
  }
};

export const stopAutoplay = async (
  eventId: string,
  token: string,
): Promise<AutoplayResult> => {
  try {
    const { data } = await emitClient.post(
      `/api/v1/events/${encodeURIComponent(eventId)}/recitation/autoplay/stop`,
      {},
      { headers: { "X-Recitation-Token": token } },
    );
    const state = toAutoplayState(data);
    return state
      ? { ok: true, state }
      : {
          ok: false,
          message: tolgee.t("studio.live_control.errors.unreadable_answer"),
        };
  } catch (error) {
    return autoplayFailure(error);
  }
};

export const fetchAutoplayState = async (
  eventId: string,
  token: string,
): Promise<AutoplayState | null> => {
  try {
    const { data } = await emitClient.get(
      `/api/v1/events/${encodeURIComponent(eventId)}/recitation/autoplay`,
      { headers: { "X-Recitation-Token": token } },
    );
    return toAutoplayState(data);
  } catch {
    return null;
  }
};

/**
 * The event's live socket, opened with the emit token: the controller drives
 * the room over it and hears where the room and autoplay are. The browser
 * cannot set headers on a socket, so the token rides in the query string, as
 * the app's own tokens do.
 *
 * With no backend URL in the build - the deployed Studio, whose nginx proxies
 * `/api` - the socket goes to this origin's root, never to the page's own path.
 */
export const recitationSocketUrl = (eventId: string, token: string): string => {
  const base = new URL(
    String(import.meta.env.VITE_BACKEND_BASE_URL ?? "") || "/",
    window.location.origin,
  );
  base.protocol = base.protocol === "https:" ? "wss:" : "ws:";
  const path = base.pathname.replace(/\/$/, "");
  base.pathname = `${path}/api/v1/events/${encodeURIComponent(eventId)}/recitation/live`;
  base.search = new URLSearchParams({ token }).toString();
  return base.toString();
};

/** Ends the session for everyone following it. */
export const endRecitationSession = async (
  eventId: string,
  token: string,
): Promise<PublishResult> => {
  try {
    await emitClient.post(
      `/api/v1/events/${encodeURIComponent(eventId)}/recitation/end`,
      {},
      { headers: { "X-Recitation-Token": token } },
    );
    return { ok: true };
  } catch (error) {
    const status = axios.isAxiosError(error)
      ? error.response?.status
      : undefined;
    return { ok: false, message: emitFailure(status) };
  }
};

interface SegmentPlayTimesResponse {
  text_id: string;
  segments: { segment_id: string; average_duration_ms: number }[];
}

/**
 * How long each line of an edition takes to recite, by segment id, as the
 * backend learned it from earlier pujas. A line never recited through to the
 * next one is absent.
 */
export const fetchSegmentPlayTimes = async (
  textId: string,
): Promise<Record<string, number>> => {
  // Public: the times are durations of a public text, read with no token.
  const { data } = await emitClient.get<SegmentPlayTimesResponse>(
    `/api/v1/events/recitation/texts/${encodeURIComponent(textId)}/segment-play-times`,
  );
  return Object.fromEntries(
    data.segments.map((segment) => [
      segment.segment_id,
      segment.average_duration_ms,
    ]),
  );
};
