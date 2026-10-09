import { useQuery } from "@tanstack/react-query";
import {
  fetchLanguages,
  getLanguageLabel,
  getLanguageName,
  getLanguageOptions,
  LANGUAGES_QUERY_KEY,
  type StudioLanguageOption,
} from "@/components/api/languagesApi";

export type { StudioLanguageOption };

/** Shared languages query — all consumers dedupe via `LANGUAGES_QUERY_KEY`. */
export function useLanguages(options?: {
  enabled?: boolean;
  /** Only languages that have recitation/chant content (backend `recitation_only`). */
  recitationOnly?: boolean;
}) {
  const recitationOnly = options?.recitationOnly ?? false;
  const query = useQuery({
    // Keep the default variant's key untouched so the other language pickers
    // keep sharing/deduping on the original `LANGUAGES_QUERY_KEY`.
    queryKey: recitationOnly
      ? [...LANGUAGES_QUERY_KEY, "recitation"]
      : LANGUAGES_QUERY_KEY,
    queryFn: () => fetchLanguages(true, recitationOnly),
    enabled: options?.enabled ?? true,
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  });

  const languageOptions =
    query.data ?? (recitationOnly ? [] : getLanguageOptions());

  return {
    ...query,
    languageOptions,
    getLanguageLabel,
    getLanguageName,
  };
}
