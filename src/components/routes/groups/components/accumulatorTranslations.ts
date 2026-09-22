import { normalizeLanguageCode } from "@/lib/languageCodes";
import type {
  GroupAccumulatorDTO,
  GroupAccumulatorMetadataDTO,
} from "../api/groupAccumulatorsApi";

/** Per-language title and About text as the accumulator form holds them. */
export type AccumulatorTranslationState = {
  languages: string[];
  titles: Record<string, string>;
  descriptions: Record<string, string>;
};

/**
 * Turns the CMS `metadata` array into the translations field's per-language
 * state. Accumulators saved before titles were translated carry their title on
 * the row instead, so seed English with it — otherwise the author would open a
 * form with no way to edit the title they can see in the list.
 */
export function translationStateFromAccumulator(
  accumulator: Pick<GroupAccumulatorDTO, "title" | "metadata">,
): AccumulatorTranslationState {
  const languages: string[] = [];
  const titles: Record<string, string> = {};
  const descriptions: Record<string, string> = {};

  (accumulator.metadata ?? []).forEach((entry) => {
    const lang = normalizeLanguageCode(String(entry.language ?? ""));
    if (!lang || languages.includes(lang)) return;
    languages.push(lang);
    titles[lang] = entry.title ?? "";
    descriptions[lang] = entry.description ?? "";
  });

  const rowTitle = accumulator.title?.trim() ?? "";
  const hasStoredTitle = languages.some((lang) => (titles[lang] ?? "").trim());
  if (rowTitle && !hasStoredTitle) {
    if (!languages.includes("EN")) languages.unshift("EN");
    titles.EN = rowTitle;
    descriptions.EN = descriptions.EN ?? "";
  }

  return { languages, titles, descriptions };
}

/**
 * The `metadata` array to send. It is a full replace server-side, so every
 * language the author still has content for must be included. A language with
 * only a title (or only an About) is kept — the server resolves the two
 * independently.
 */
export function metadataFromTranslationState(
  state: AccumulatorTranslationState,
): GroupAccumulatorMetadataDTO[] {
  return state.languages
    .map((language) => ({
      language,
      title: (state.titles[language] ?? "").trim(),
      description: (state.descriptions[language] ?? "").trim(),
    }))
    .filter((entry) => entry.title.length > 0 || entry.description.length > 0);
}
