import {
  DevTools,
  FormatSimple,
  Tolgee,
  type TolgeePlugin,
} from "@tolgee/react";
import { LANGUAGE } from "@/lib/constant";
import { setFontVariables } from "@/config/font-config";
import localeEn from "./en.json";
import localeBo from "./bo.json";
import localeZh from "./zh.json";
import { UI_LANGUAGES, resolveUiLanguage } from "./languages";

const initialLanguage = resolveUiLanguage(
  localStorage.getItem(LANGUAGE) || import.meta.env.VITE_DEFAULT_LANGUAGE,
);
setFontVariables(initialLanguage);

/**
 * The Studio's Tolgee project, `studio` namespace, published as one
 * `<cdnCode>.json` per language.
 */
const TOLGEE_CDN =
  import.meta.env.VITE_TOLGEE_CDN_URL ||
  "https://cdn.tolg.ee/c1435f067d4e41c0dd6908cebd39805b/studio";
const LOCAL_TRANSLATIONS: Record<string, Record<string, string>> = {
  en: localeEn,
  "bo-IN": localeBo,
  zh: localeZh,
};

/**
 * Translations from the Tolgee CDN, with any key it does not have yet taken
 * from the bundled JSON. Tolgee stays the source of truth for every key it
 * knows, but a key added alongside the code shows up straight away instead
 * of falling back to its English default until someone adds it in Tolgee.
 * A language the CDN does not serve, or a CDN that cannot be reached, leaves
 * `staticData` below to take over.
 */
const CdnWithLocalKeys = (): TolgeePlugin => (tolgee, tools) => {
  tools.addBackend({
    async getRecord({ language, namespace }) {
      if (namespace) return undefined;
      const cdnCode = UI_LANGUAGES.find((l) => l.code === language)?.cdnCode;
      if (!cdnCode) return undefined;
      try {
        const response = await fetch(`${TOLGEE_CDN}/${cdnCode}.json`);
        if (!response.ok) return undefined;
        const remote = await response.json();
        return { ...LOCAL_TRANSLATIONS[language], ...remote };
      } catch {
        return undefined;
      }
    },
  });
  return tolgee;
};

/**
 * The one Tolgee instance. Components read it through `useTranslate`; code
 * outside React (schemas, mutation toasts) calls `tolgee.t` when it runs.
 */
export const tolgee = Tolgee()
  .use(DevTools())
  .use(FormatSimple())
  .use(CdnWithLocalKeys())
  .init({
    language: initialLanguage,
    fallbackLanguage: "en",
    availableLanguages: UI_LANGUAGES.map((l) => l.code),
    staticData: {
      en: async () => localeEn,
      "bo-IN": async () => localeBo,
      zh: async () => localeZh,
    },
  });
