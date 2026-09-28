import axios from "axios";

/**
 * The edition's table of contents, read straight from the WeBuddhist library
 * (OpenPecha) API.
 *
 * The backend has no table-of-contents route, so this goes to the library the
 * same way the reader app does: requests are made against our own origin under
 * /library and forwarded upstream by a proxy - vite in development, nginx in
 * production - so the library's host never appears in a browser request and the
 * X-Application header it requires is attached by the proxy rather than shipped
 * in the bundle. Point the proxy elsewhere with VITE_LIBRARY_BASE_URL.
 *
 * A standalone axios instance on purpose: the app's shared instance attaches the
 * author's access token to every request, and none of this is user-specific -
 * live control runs signed out.
 */
const libraryClient = axios.create({
  baseURL: "/library",
  headers: { accept: "application/json" },
});

/** Titles are keyed by language code, e.g. { en: "…", bo: "…" }. */
type LocalizedTitle = Record<string, string>;

type LibraryTocSection = {
  id: string;
  title: LocalizedTitle | string | null;
  span?: { start: number; end: number } | null;
  subsections?: LibraryTocSection[];
};

type LibraryToc = {
  id: string;
  edition_id: string;
  text_id: string;
  sections: LibraryTocSection[];
};

type LibrarySegmentSpan = {
  id: string;
  lines?: { start: number; end: number }[];
};

type LibraryPage<T> = { items: T[]; has_more: boolean };

/**
 * One entry of the sidebar list: a section title, how deep it nests, and the
 * segment the operator lands on when it is tapped. `segmentId` is absent for a
 * heading nothing resolved under, which the sidebar shows but leaves inert.
 */
export interface TocEntry {
  id: string;
  title: string;
  depth: number;
  segmentId?: string;
}

/** Segment spans come down in pages; a long text is a handful of them. */
const SEGMENT_SCAN_PAGE_SIZE = 500;

const isNotFound = (error: unknown): boolean =>
  axios.isAxiosError(error) && error.response?.status === 404;

const extractTitle = (
  title: LocalizedTitle | string | null | undefined,
  language?: string | null,
): string => {
  if (typeof title === "string") return title.trim();
  if (!title || typeof title !== "object") return "";
  if (language && title[language]) return title[language].trim();
  for (const value of Object.values(title)) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
};

/**
 * The edition the id refers to.
 *
 * What live control calls a text id is sometimes a text id and sometimes an
 * edition id - the same ambiguity the backend's own text routes carry - so read
 * it as an edition first and fall back to the text's first critical edition.
 */
const resolveEditionId = async (textOrEditionId: string): Promise<string> => {
  try {
    await libraryClient.get(
      `/v2/editions/${encodeURIComponent(textOrEditionId)}`,
    );
    return textOrEditionId;
  } catch (error) {
    // Only a 404 means "not an edition id". Anything else is a real failure and
    // must not be turned into a lookup of a text that does not exist.
    if (!isNotFound(error)) throw error;
  }
  const { data } = await libraryClient.get<{ id?: string }[]>(
    `/v2/texts/${encodeURIComponent(textOrEditionId)}/editions`,
    { params: { edition_type: "critical" } },
  );
  return data?.[0]?.id ?? textOrEditionId;
};

/** Every segment span of the edition, in reading order. */
const scanSegmentSpans = async (
  editionId: string,
): Promise<LibrarySegmentSpan[]> => {
  const spans: LibrarySegmentSpan[] = [];
  let offset = 0;
  for (;;) {
    const { data } = await libraryClient.get<LibraryPage<LibrarySegmentSpan>>(
      `/v2/editions/${encodeURIComponent(editionId)}/segmentation/segments`,
      { params: { limit: SEGMENT_SCAN_PAGE_SIZE, offset } },
    );
    const items = data?.items ?? [];
    spans.push(...items);
    if (!data?.has_more || items.length === 0) return spans;
    offset += items.length;
  }
};

/**
 * The library anchors a section by the character span it covers, while the
 * operator moves by segment id. Bridge the two with the first segment the
 * section begins in.
 *
 * Segment and section boundaries need not agree: a section can begin partway
 * through a segment that started before it - a verse whose segment carries the
 * tail of the line above. That segment is where the section is recited from, so
 * it is the anchor; taking only segments that start inside the span would send
 * the operator to the next one and push the room past the section's own start.
 *
 * An empty span is not a defect: the library uses one to mark a position rather
 * than a range, which is how it writes a heading with no text of its own - a
 * part title standing above its subsections. Nothing starts strictly inside
 * such a span, so anchor it to the segment holding the position, or the first
 * one after it.
 */
const firstSegmentInSpan = (
  spans: LibrarySegmentSpan[],
  span: { start: number; end: number } | null | undefined,
): string | undefined => {
  if (!span) return undefined;
  const isAnchor = (start: number, end: number) => {
    // The segment the section starts inside, however early that segment began.
    if (start <= span.start && end > span.start) return true;
    // Otherwise the first segment beginning at or after the span's start, kept
    // within the span itself when the span is a range.
    return span.start === span.end
      ? start >= span.start
      : start >= span.start && start < span.end;
  };
  return spans.find((candidate) => {
    const lines = candidate.lines ?? [];
    if (lines.length === 0) return false;
    // A segment can be several lines; it covers all of them.
    const start = Math.min(...lines.map((line) => line.start));
    const end = Math.max(...lines.map((line) => line.end));
    return isAnchor(start, end);
  })?.id;
};

/** A section's own anchor, or the first one any of its subsections resolved. */
const anchorOf = (
  section: LibraryTocSection,
  spans: LibrarySegmentSpan[],
): string | undefined =>
  firstSegmentInSpan(spans, section.span) ??
  (section.subsections ?? []).reduce<string | undefined>(
    (found, subsection) => found ?? anchorOf(subsection, spans),
    undefined,
  );

/**
 * The tree flattened into the sidebar's list, outermost first - which is both
 * the order the sections nest in and the order they are recited in. Depth is
 * kept so the list can be indented; untitled sections are dropped, having
 * nothing to show.
 */
const flatten = (
  sections: LibraryTocSection[],
  spans: LibrarySegmentSpan[],
  language: string | null | undefined,
  depth: number,
  into: TocEntry[],
): TocEntry[] => {
  sections.forEach((section) => {
    const title = extractTitle(section.title, language);
    if (title) {
      into.push({
        id: section.id,
        title,
        depth,
        segmentId: anchorOf(section, spans),
      });
    }
    flatten(
      section.subsections ?? [],
      spans,
      language,
      title ? depth + 1 : depth,
      into,
    );
  });
  return into;
};

/**
 * The sections of an edition, ready for the sidebar.
 *
 * An edition with no table-of-contents annotation - most of the library, still -
 * simply has no sections, and the sidebar draws nothing.
 */
export const fetchEditionSections = async (
  textOrEditionId: string,
  language?: string | null,
): Promise<TocEntry[]> => {
  const editionId = await resolveEditionId(textOrEditionId);
  const { data: tocs } = await libraryClient.get<LibraryToc[]>(
    `/v2/editions/${encodeURIComponent(editionId)}/table-of-contents`,
  );
  const sections = (tocs ?? []).flatMap((toc) => toc.sections ?? []);
  if (sections.length === 0) return [];

  // Only fetched once there is something to anchor: the scan is several requests
  // for a long text, and most editions have no annotation to spend them on.
  const spans = await scanSegmentSpans(editionId);
  return flatten(sections, spans, language, 0, []);
};
