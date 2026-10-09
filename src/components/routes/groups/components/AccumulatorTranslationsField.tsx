import { useEffect, useState } from "react";
import { IoMdAdd, IoMdClose } from "react-icons/io";
import { Pecha } from "@/components/ui/shadimport";
import { MarkdownEditor } from "@/components/ui/atoms/markdown-editor";
import { useLanguages } from "@/hooks/useLanguages";
import { cn } from "@/lib/utils";
import type { LanguageCode } from "@/lib/languageCodes";

export type AccumulatorTranslations = {
  activeLanguages: LanguageCode[];
  /** Title per language code. */
  titles: Record<string, string>;
  /** About text (markdown) per language code. */
  descriptions: Record<string, string>;
};

type AccumulatorTranslationsFieldProps = {
  /** Languages shown as tabs, in display order. */
  readonly activeLanguages: LanguageCode[];
  readonly titles: Record<string, string>;
  readonly descriptions: Record<string, string>;
  readonly onChange: (next: AccumulatorTranslations) => void;
};

const AccumulatorTranslationsField = ({
  activeLanguages,
  titles,
  descriptions,
  onChange,
}: AccumulatorTranslationsFieldProps) => {
  const { languageOptions, getLanguageLabel } = useLanguages();
  const [selected, setSelected] = useState<LanguageCode | null>(
    activeLanguages[0] ?? null,
  );

  // Keep the selected tab valid as languages are added and removed.
  useEffect(() => {
    if (activeLanguages.length === 0) {
      setSelected(null);
      return;
    }
    if (!selected || !activeLanguages.includes(selected)) {
      setSelected(activeLanguages[0]);
    }
  }, [activeLanguages, selected]);

  const availableLanguages = languageOptions.filter(
    (lang) => !activeLanguages.includes(lang.value),
  );

  const addLanguage = (langCode: LanguageCode) => {
    onChange({
      activeLanguages: [...activeLanguages, langCode],
      titles: { ...titles, [langCode]: titles[langCode] ?? "" },
      descriptions: {
        ...descriptions,
        [langCode]: descriptions[langCode] ?? "",
      },
    });
    setSelected(langCode);
  };

  const removeLanguage = (langCode: LanguageCode) => {
    onChange({
      activeLanguages: activeLanguages.filter((lang) => lang !== langCode),
      titles: { ...titles, [langCode]: "" },
      descriptions: { ...descriptions, [langCode]: "" },
    });
  };

  const updateTitle = (langCode: LanguageCode, value: string) => {
    onChange({
      activeLanguages,
      titles: { ...titles, [langCode]: value },
      descriptions,
    });
  };

  const updateDescription = (langCode: LanguageCode, value: string) => {
    onChange({
      activeLanguages,
      titles,
      descriptions: { ...descriptions, [langCode]: value },
    });
  };

  const hasText = (lang: LanguageCode) =>
    (titles[lang] ?? "").trim().length > 0 ||
    (descriptions[lang] ?? "").trim().length > 0;

  const missingEnglish = !activeLanguages.includes("EN") || !hasText("EN");
  const hasAnyText = activeLanguages.some(hasText);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-sm font-bold">Title &amp; About</p>
          <p className="text-xs text-muted-foreground">
            One per language. Markdown supported in About.
          </p>
        </div>
        {availableLanguages.length > 0 ? (
          <Pecha.Select
            value=""
            onValueChange={(v) => addLanguage(v as LanguageCode)}
          >
            <Pecha.SelectTrigger className="w-[150px] h-9 shrink-0">
              <Pecha.SelectValue placeholder="Add language" />
            </Pecha.SelectTrigger>
            <Pecha.SelectContent>
              {availableLanguages.map((lang) => (
                <Pecha.SelectItem key={lang.value} value={lang.value}>
                  <span className="flex items-center gap-1">
                    <IoMdAdd className="w-3 h-3" />
                    {lang.label}
                  </span>
                </Pecha.SelectItem>
              ))}
            </Pecha.SelectContent>
          </Pecha.Select>
        ) : null}
      </div>

      {activeLanguages.length === 0 ? (
        <div className="rounded-md border border-dashed p-6 text-center">
          <p className="text-sm text-muted-foreground">
            No title or About text yet. Add a language to write one.
          </p>
        </div>
      ) : (
        <>
          {/* Tabs keep one editor visible at a time instead of stacking them. */}
          <div className="flex flex-wrap items-center gap-1 border-b border-input">
            {activeLanguages.map((lang) => (
              <div key={lang} className="flex items-center">
                <button
                  type="button"
                  onClick={() => setSelected(lang)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors",
                    selected === lang
                      ? "text-foreground border-b-2 border-foreground -mb-px"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {getLanguageLabel(lang)}
                  {hasText(lang) ? (
                    <span
                      className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50"
                      aria-label="has text"
                    />
                  ) : null}
                </button>
                {selected === lang ? (
                  <button
                    type="button"
                    onClick={() => removeLanguage(lang)}
                    className="mr-1 rounded p-0.5 text-muted-foreground hover:text-destructive"
                    aria-label={`Remove ${getLanguageLabel(lang)}`}
                  >
                    <IoMdClose className="w-3.5 h-3.5" />
                  </button>
                ) : null}
              </div>
            ))}
          </div>

          {selected ? (
            <div className="space-y-3">
              <div className="space-y-2">
                <label
                  className="text-sm font-bold"
                  htmlFor={`accumulator-title-${selected}`}
                >
                  Title
                </label>
                <Pecha.Input
                  id={`accumulator-title-${selected}`}
                  value={titles[selected] ?? ""}
                  onChange={(e) => updateTitle(selected, e.target.value)}
                  placeholder={`Title in ${getLanguageLabel(selected)}…`}
                  className="h-11 bg-white dark:bg-[#262626]"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold">About</label>
                <MarkdownEditor
                  value={descriptions[selected] ?? ""}
                  onChange={(value) => updateDescription(selected, value)}
                  placeholder={`About this accumulation in ${getLanguageLabel(
                    selected,
                  )}…`}
                  className="bg-white dark:bg-[#181818]"
                  textareaClassName="bg-white dark:bg-[#181818]"
                />
              </div>
            </div>
          ) : null}
        </>
      )}

      {hasAnyText && missingEnglish ? (
        <p className="text-xs text-muted-foreground">
          Add English too. The app falls back to English when a member&apos;s
          language is missing.
        </p>
      ) : null}
    </div>
  );
};

export default AccumulatorTranslationsField;
