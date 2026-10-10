import { useEffect, useRef, useState } from "react";
import type { UseFormReturn } from "react-hook-form";
import { IoMdAdd } from "react-icons/io";
import { useTranslate } from "@tolgee/react";
import { Pecha } from "@/components/ui/shadimport";
import { Textarea } from "@/components/ui/atoms/textarea";
import { Button } from "@/components/ui/atoms/button";
import type { LanguageCode } from "@/schema/SeriesSchema";
import type { GroupCoreFormData } from "@/schema/GroupSchema";
import { languageLabelForCode } from "../api/groupsApi";

const ADD_TAB = "__add_language__";

type GroupLanguageTabsProps = Readonly<{
  form: UseFormReturn<GroupCoreFormData>;
  /** The languages added so far, in tab order. */
  languages: LanguageCode[];
  /** Languages that can still be added. */
  availableLanguages: { value: string; label: string }[];
  onAddLanguage: (code: LanguageCode) => void;
  onRemoveLanguage: (code: LanguageCode) => void;
}>;

/**
 * A group's title, sub-title, description and long description, one tab per
 * language, with "Add language" as the last tab. Used by both the create and
 * the edit page, so they behave the same. Only the title is required, in every
 * language; the rest may be left empty.
 */
const GroupLanguageTabs = ({
  form,
  languages,
  availableLanguages,
  onAddLanguage,
  onRemoveLanguage,
}: GroupLanguageTabsProps) => {
  const { t } = useTranslate();
  const [active, setActive] = useState<string>(languages[0] ?? ADD_TAB);

  const languageErrors = form.formState.errors.languages as
    | Record<string, unknown>
    | undefined;
  const hasErrors = (code: string) => Boolean(languageErrors?.[code]);
  const canAdd = availableLanguages.length > 0;

  // A removed language (or an add tab with nothing left to add) leaves the
  // active tab pointing at nothing; fall back to the first language.
  useEffect(() => {
    const gone =
      active !== ADD_TAB && !languages.includes(active as LanguageCode);
    const addUnavailable = active === ADD_TAB && !canAdd;
    if (gone || addUnavailable) setActive(languages[0] ?? ADD_TAB);
  }, [active, languages, canAdd]);

  // Saving checks every language, so the field that failed is often on a tab
  // that is not showing. Jump to the first tab with an error after a failed
  // submit; autosave validates without submitting and never jumps.
  const submitCount = form.formState.submitCount;
  const handledSubmit = useRef(0);
  useEffect(() => {
    if (submitCount === handledSubmit.current) return;
    handledSubmit.current = submitCount;
    const first = languages.find(hasErrors);
    if (first && !hasErrors(active)) setActive(first);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submitCount]);

  const add = (code: string) => {
    onAddLanguage(code as LanguageCode);
    setActive(code);
  };

  return (
    <Pecha.Tabs value={active} onValueChange={setActive} className="gap-4">
      <Pecha.TabsList>
        {languages.map((code) => (
          <Pecha.TabsTrigger key={code} value={code}>
            {languageLabelForCode(code)}
            {hasErrors(code) ? (
              <span
                aria-label={t(
                  "studio.groups.components.language_tabs.has_errors",
                )}
                className="size-1.5 rounded-full bg-destructive"
              />
            ) : null}
          </Pecha.TabsTrigger>
        ))}
        {canAdd ? (
          <Pecha.TabsTrigger value={ADD_TAB}>
            <IoMdAdd className="h-4 w-4" />
            {t("studio.groups.components.language_tabs.add_language")}
          </Pecha.TabsTrigger>
        ) : null}
      </Pecha.TabsList>

      {languages.map((code) => {
        const label = languageLabelForCode(code);
        return (
          // Mounted while hidden, so every language's fields stay registered
          // with the form and show their errors when their tab opens.
          <Pecha.TabsContent
            key={code}
            value={code}
            forceMount
            className="space-y-3 rounded-lg border border-input bg-[#FAFAFA] p-4 data-[state=inactive]:hidden dark:bg-[#262626]"
          >
            <Pecha.FormField
              control={form.control}
              name={`languages.${code}.title`}
              render={({ field }) => (
                <Pecha.FormItem>
                  <Pecha.FormLabel className="text-sm font-bold">
                    {t("studio.groups.components.language_tabs.title_label", {
                      language: label,
                    })}
                    <span className="text-destructive"> *</span>
                  </Pecha.FormLabel>
                  <Pecha.FormControl>
                    <Pecha.Input
                      className="h-12 bg-white dark:bg-[#181818]"
                      {...field}
                    />
                  </Pecha.FormControl>
                  <Pecha.FormMessage />
                </Pecha.FormItem>
              )}
            />
            <Pecha.FormField
              control={form.control}
              name={`languages.${code}.sub_title`}
              render={({ field }) => (
                <Pecha.FormItem>
                  <Pecha.FormLabel className="text-sm font-bold">
                    {t(
                      "studio.groups.components.language_tabs.sub_title_label",
                      {
                        language: label,
                      },
                    )}
                    <span className="font-normal text-muted-foreground">
                      {" "}
                      ({t("studio.common.optional")})
                    </span>
                  </Pecha.FormLabel>
                  <Pecha.FormControl>
                    <Pecha.Input
                      className="h-12 bg-white dark:bg-[#181818]"
                      {...field}
                      value={field.value ?? ""}
                    />
                  </Pecha.FormControl>
                  <Pecha.FormMessage />
                </Pecha.FormItem>
              )}
            />
            <Pecha.FormField
              control={form.control}
              name={`languages.${code}.description`}
              render={({ field }) => (
                <Pecha.FormItem>
                  <Pecha.FormLabel className="text-sm font-bold">
                    {t(
                      "studio.groups.components.language_tabs.description_label",
                      { language: label },
                    )}
                    <span className="font-normal text-muted-foreground">
                      {" "}
                      ({t("studio.common.optional")})
                    </span>
                  </Pecha.FormLabel>
                  <Pecha.FormControl>
                    <Textarea
                      className="min-h-[100px] resize-none bg-white dark:bg-[#181818]"
                      maxLength={200}
                      {...field}
                      value={field.value ?? ""}
                    />
                  </Pecha.FormControl>
                  <Pecha.FormMessage />
                </Pecha.FormItem>
              )}
            />
            <Pecha.FormField
              control={form.control}
              name={`languages.${code}.description_long`}
              render={({ field }) => (
                <Pecha.FormItem>
                  <Pecha.FormLabel className="text-sm font-bold">
                    {t(
                      "studio.groups.components.language_tabs.description_long_label",
                      { language: label },
                    )}
                    <span className="font-normal text-muted-foreground">
                      {" "}
                      ({t("studio.common.optional")})
                    </span>
                  </Pecha.FormLabel>
                  <Pecha.FormControl>
                    <Textarea
                      className="min-h-[160px] resize-y bg-white dark:bg-[#181818]"
                      placeholder={t(
                        "studio.groups.components.language_tabs.description_long_placeholder",
                      )}
                      {...field}
                      value={field.value ?? ""}
                    />
                  </Pecha.FormControl>
                  <Pecha.FormMessage />
                </Pecha.FormItem>
              )}
            />
            {languages.length > 1 ? (
              <div className="flex justify-end pt-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => onRemoveLanguage(code)}
                >
                  {t("studio.groups.components.language_tabs.remove_language", {
                    language: label,
                  })}
                </Button>
              </div>
            ) : null}
          </Pecha.TabsContent>
        );
      })}

      {canAdd ? (
        <Pecha.TabsContent
          value={ADD_TAB}
          className="space-y-3 rounded-lg border border-dashed border-input p-4"
        >
          <p className="text-sm text-muted-foreground">
            {t("studio.groups.components.language_tabs.add_hint")}
          </p>
          <div className="flex flex-wrap gap-2">
            {availableLanguages.map((lang) => (
              <Button
                key={lang.value}
                type="button"
                variant="outline"
                size="sm"
                onClick={() => add(lang.value)}
              >
                {lang.label}
              </Button>
            ))}
          </div>
        </Pecha.TabsContent>
      ) : null}
    </Pecha.Tabs>
  );
};

export default GroupLanguageTabs;
