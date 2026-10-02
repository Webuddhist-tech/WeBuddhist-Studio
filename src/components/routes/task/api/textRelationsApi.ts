import axios from "axios";

/**
 * The commentaries and translations of a text, read straight from the
 * WeBuddhist library (OpenPecha) API.
 *
 * These are the lists the reader app opens its commentary and translation
 * panels from, so they follow the same fallbacks it does (WeBuddhist
 * src/services/library/texts.ts, getTextCommentaries and getTextVersions): a
 * text with no list of its own borrows the one of the text it is a
 * translation or commentary of. Requests go through the /library proxy, like
 * live control's table of contents (see libraryTocApi.ts).
 */
const libraryClient = axios.create({
  baseURL: "/library",
  headers: { accept: "application/json" },
});

type LocalizedTitle = Record<string, string>;

type LibraryText = {
  id: string;
  title?: LocalizedTitle | string | null;
  language?: string | null;
  commentary_of?: string | null;
  translation_of?: string | null;
  commentaries?: string[];
  translations?: string[];
};

export interface RelatedText {
  id: string;
  title: string;
  language: string | null;
}

export interface TextRelations {
  commentaries: RelatedText[];
  translations: RelatedText[];
}

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

const fetchText = async (textId: string): Promise<LibraryText | null> => {
  try {
    const { data } = await libraryClient.get<LibraryText>(
      `/v2/texts/${encodeURIComponent(textId)}`,
    );
    return data ?? null;
  } catch (error) {
    if (isNotFound(error)) return null;
    throw error;
  }
};

/**
 * A subtask's source id is sometimes an edition id and sometimes a text id;
 * the lists hang off the text.
 */
const resolveTextId = async (textOrEditionId: string): Promise<string> => {
  try {
    const { data } = await libraryClient.get<{ text_id?: string }>(
      `/v2/editions/${encodeURIComponent(textOrEditionId)}`,
    );
    return data?.text_id || textOrEditionId;
  } catch (error) {
    // Only a 404 means "not an edition id".
    if (!isNotFound(error)) throw error;
    return textOrEditionId;
  }
};

const commentariesOfParent = async (parentId: string): Promise<string[]> =>
  (await fetchText(parentId))?.commentaries ?? [];

const commentaryIdsOf = async (text: LibraryText): Promise<string[]> => {
  if (text.commentary_of) return commentariesOfParent(text.commentary_of);
  if (text.commentaries?.length) return text.commentaries;
  if (text.translation_of) return commentariesOfParent(text.translation_of);
  const relatedId = text.translations?.[0];
  if (!relatedId) return [];
  const related = await fetchText(relatedId);
  if (!related) return [];
  if (related.commentary_of) return commentariesOfParent(related.commentary_of);
  return related.commentaries ?? [];
};

/** The parent is one of the versions too: the text the others translate. */
const versionsOfParent = async (parentId: string): Promise<string[]> => {
  const parent = await fetchText(parentId);
  return parent ? [parent.id, ...(parent.translations ?? [])] : [];
};

const translationIdsOf = async (text: LibraryText): Promise<string[]> => {
  if (text.translations?.length) return text.translations;
  if (text.translation_of) return versionsOfParent(text.translation_of);
  if (text.commentary_of) return versionsOfParent(text.commentary_of);
  const relatedId = text.commentaries?.[0];
  if (!relatedId) return [];
  const related = await fetchText(relatedId);
  if (!related) return [];
  if (related.translation_of) return versionsOfParent(related.translation_of);
  return related.translations ?? [];
};

const describeTexts = async (
  ids: string[],
  excludeId: string,
): Promise<RelatedText[]> => {
  const unique = [...new Set(ids)].filter((id) => id !== excludeId);
  const texts = await Promise.all(unique.map(fetchText));
  return texts
    .filter((text): text is LibraryText => Boolean(text))
    .map((text) => ({
      id: text.id,
      title: extractTitle(text.title, text.language) || text.id,
      language: text.language ?? null,
    }));
};

export const fetchTextRelations = async (
  sourceTextId: string,
): Promise<TextRelations> => {
  const textId = await resolveTextId(sourceTextId);
  const text = await fetchText(textId);
  if (!text) return { commentaries: [], translations: [] };

  const [commentaryIds, translationIds] = await Promise.all([
    commentaryIdsOf(text),
    translationIdsOf(text),
  ]);
  const [commentaries, translations] = await Promise.all([
    describeTexts(commentaryIds, text.id),
    describeTexts(translationIds, text.id),
  ]);
  return { commentaries, translations };
};

/** Every source text's lists, merged, each text listed once. */
export const fetchTextRelationsForSources = async (
  sourceTextIds: string[],
): Promise<TextRelations> => {
  const results = await Promise.all(
    [...new Set(sourceTextIds)].map(fetchTextRelations),
  );
  const merge = (lists: RelatedText[][]) => {
    const seen = new Map<string, RelatedText>();
    lists.flat().forEach((text) => {
      if (!seen.has(text.id)) seen.set(text.id, text);
    });
    return [...seen.values()];
  };
  return {
    commentaries: merge(results.map((result) => result.commentaries)),
    translations: merge(results.map((result) => result.translations)),
  };
};
