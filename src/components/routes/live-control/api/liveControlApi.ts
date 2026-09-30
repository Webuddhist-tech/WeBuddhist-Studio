import axios from "axios";
import axiosInstance from "@/config/axios-config";
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

/** The event's public record: readable without a session, unlike the CMS one. */
export const fetchLiveControlEvent = async (
  eventId: string,
): Promise<LiveControlEvent> => {
  const { data } = await axiosInstance.get(
    `/api/v1/events/${encodeURIComponent(eventId)}`,
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
    title: preferred?.name?.trim() || "Untitled event",
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
    title: row?.title?.trim() || (row?.id ?? "Untitled"),
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
    return "That emit token was rejected. Check it and paste it again.";
  }
  if (status === 503) {
    return "The server has no emit token configured, so nothing can be published.";
  }
  if (status === 404) {
    return "This event is not live, so positions cannot be published to it.";
  }
  if (status === 429) {
    return "The room is taking positions as fast as it can; slow down a little.";
  }
  return "Could not reach the room. The last line will be sent again on the next move.";
};

/**
 * Publishes one position. The event holds a single position, so callers send
 * only the newest one they have landed on.
 */
export const publishPosition = async (
  eventId: string,
  token: string,
  position: PositionToPublish,
): Promise<PublishResult> => {
  try {
    await emitClient.post(
      `/api/v1/events/${encodeURIComponent(eventId)}/recitation/position`,
      {
        text_id: position.textId,
        segment_id: position.segmentId,
        index: position.index,
        round_number: position.roundNumber,
        ...(position.autoplay ? { autoplay: true } : {}),
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
  token: string,
): Promise<Record<string, number>> => {
  const { data } = await emitClient.get<SegmentPlayTimesResponse>(
    `/api/v1/events/recitation/texts/${encodeURIComponent(textId)}/segment-play-times`,
    { headers: { "X-Recitation-Token": token } },
  );
  return Object.fromEntries(
    data.segments.map((segment) => [
      segment.segment_id,
      segment.average_duration_ms,
    ]),
  );
};
