import axiosInstance from "@/config/axios-config";

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
}

/** Frames the server sends on the live socket. */
export type RecitationFrame =
  | { type: "session_info"; event_id: string; is_operator: boolean }
  | {
      type: "position";
      event_id: string;
      text_id?: string;
      segment_id: string;
      index?: number | null;
      round_number?: number | null;
      server_time?: string;
      revision?: number | null;
    }
  | { type: "session_ended"; event_id: string }
  | { type: "pong" }
  | { type: "error"; code: string; message: string };

/** The operator's `set` frame: where the puja is right now. */
export interface SetPositionFrame {
  type: "set";
  text_id: string;
  segment_id: string;
  index?: number;
  round_number?: number;
}

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
 * Rows with no segment id are dropped: there would be nothing to publish.
 */
export function toOperatorSegments(
  details: Pick<RecitationDetails, "segments">,
  language: string,
): OperatorSegment[] {
  const normalized = language.trim().toLowerCase();
  return (details.segments ?? [])
    .map((row) => {
      const bucket = row.recitation ?? {};
      const segment = bucket[normalized] ?? Object.values(bucket)[0];
      return { id: segment?.id ?? "", content: segment?.content ?? "" };
    })
    .filter((segment) => Boolean(segment.id));
}

/**
 * The live socket's URL. Built from the API base rather than the page's own
 * origin, because Studio is served separately from the backend.
 */
export function buildRecitationSocketUrl(
  eventId: string,
  token: string,
  apiBaseUrl: string = import.meta.env.VITE_BACKEND_BASE_URL ?? "",
): string {
  const base = apiBaseUrl.trim() || window.location.origin;
  const url = new URL(
    `/api/v1/events/${encodeURIComponent(eventId)}/recitation/live`,
    base.endsWith("/") ? base : `${base}/`,
  );
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.searchParams.set("token", token);
  return url.toString();
}
