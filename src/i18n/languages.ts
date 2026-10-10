/**
 * The interface languages the Studio ships, in the order the language menu
 * lists them. `code` is the Tolgee language tag (shared with the WeBuddhist
 * Tolgee project, hence `bo-IN`); `cdnCode` is the file the Tolgee CDN serves
 * for it, when it serves one at all.
 */
export const UI_LANGUAGES = [
  { code: "en", label: "English", fontClass: "font-inter", cdnCode: "en" },
  { code: "bo-IN", label: "བོད་ཡིག", fontClass: "font-monlam", cdnCode: "bo-IN" },
  { code: "zh", label: "中文", fontClass: "font-inter", cdnCode: null },
] as const;

export type UiLanguageCode = (typeof UI_LANGUAGES)[number]["code"];

const LEGACY_ALIASES: Record<string, UiLanguageCode> = {
  bo: "bo-IN",
  "zh-CN": "zh",
  "zh-Hans": "zh",
};

/** Maps a stored or configured language onto one the Studio ships, or `en`. */
export const resolveUiLanguage = (raw: string | null | undefined) => {
  const value = (raw ?? "").trim();
  if (UI_LANGUAGES.some((language) => language.code === value)) {
    return value as UiLanguageCode;
  }
  return LEGACY_ALIASES[value] ?? "en";
};
