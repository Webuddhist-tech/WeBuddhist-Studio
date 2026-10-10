import { useTranslate } from "@tolgee/react";
import type { UseFormReturn } from "react-hook-form";
import { IoMdAdd, IoMdClose } from "react-icons/io";
import { Pecha } from "@/components/ui/shadimport";
import { MarkdownEditor } from "@/components/ui/atoms/markdown-editor";
import { getLanguageLabel } from "@/components/api/languagesApi";
import { useLanguages } from "@/hooks/useLanguages";
import type { EventFormData, LanguageCode } from "@/schema/EventSchema";

type EventMetadataRowsProps = {
  form: UseFormReturn<EventFormData>;
  fields: { id: string }[];
  usedLanguages: LanguageCode[];
  canAddLanguage: boolean;
  readOnly: boolean;
  onAdd: () => void;
  onRemove: (index: number) => void;
};

const languageLabel = (code: string) => getLanguageLabel(code);

const EventMetadataRows = ({
  form,
  fields,
  usedLanguages,
  canAddLanguage,
  readOnly,
  onAdd,
  onRemove,
}: EventMetadataRowsProps) => {
  const { t } = useTranslate();
  const { languageOptions } = useLanguages();
  const metadata = form.watch("metadata") ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold">
          {t("studio.groups.events.metadata.heading")}
        </h3>
        {!readOnly && canAddLanguage ? (
          <Pecha.Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onAdd}
            className="gap-1"
          >
            <IoMdAdd className="h-4 w-4" />{" "}
            {t("studio.groups.events.metadata.add_language")}
          </Pecha.Button>
        ) : null}
      </div>

      {fields.map((field, index) => {
        const currentLang = metadata[index]?.language;
        return (
          <div
            key={field.id}
            className="space-y-3 rounded-lg border border-border bg-[#FAFAFA] p-4 dark:bg-[#262626]"
          >
            <div className="flex items-start justify-between gap-3">
              <Pecha.FormField
                control={form.control}
                name={`metadata.${index}.language`}
                render={({ field: langField }) => (
                  <Pecha.FormItem className="w-40">
                    <Pecha.FormLabel>
                      {t("studio.common.language")}
                    </Pecha.FormLabel>
                    <Pecha.Select
                      value={langField.value}
                      onValueChange={langField.onChange}
                      disabled={readOnly}
                    >
                      <Pecha.FormControl>
                        <Pecha.SelectTrigger className="w-full bg-white dark:bg-[#181818]">
                          <Pecha.SelectValue
                            placeholder={t("studio.common.language")}
                          />
                        </Pecha.SelectTrigger>
                      </Pecha.FormControl>
                      <Pecha.SelectContent>
                        {languageOptions.map((lang) => {
                          const takenByAnother =
                            usedLanguages.includes(lang.value) &&
                            lang.value !== currentLang;
                          return (
                            <Pecha.SelectItem
                              key={lang.value}
                              value={lang.value}
                              disabled={takenByAnother}
                            >
                              {lang.label}
                            </Pecha.SelectItem>
                          );
                        })}
                      </Pecha.SelectContent>
                    </Pecha.Select>
                    <Pecha.FormMessage />
                  </Pecha.FormItem>
                )}
              />

              {!readOnly && fields.length > 1 ? (
                <button
                  type="button"
                  aria-label={t(
                    "studio.groups.events.metadata.remove_row_aria",
                    {
                      language: languageLabel(currentLang ?? ""),
                    },
                  )}
                  onClick={() => onRemove(index)}
                  className="mt-8 text-muted-foreground hover:text-destructive"
                >
                  <IoMdClose className="h-5 w-5" />
                </button>
              ) : null}
            </div>

            <Pecha.FormField
              control={form.control}
              name={`metadata.${index}.name`}
              render={({ field: nameField }) => (
                <Pecha.FormItem>
                  <Pecha.FormLabel>{t("studio.common.name")}</Pecha.FormLabel>
                  <Pecha.FormControl>
                    <Pecha.Input
                      {...nameField}
                      placeholder={t(
                        "studio.groups.events.metadata.name_placeholder",
                      )}
                      disabled={readOnly}
                      className="bg-white dark:bg-[#181818]"
                    />
                  </Pecha.FormControl>
                  <Pecha.FormMessage />
                </Pecha.FormItem>
              )}
            />

            <Pecha.FormField
              control={form.control}
              name={`metadata.${index}.description`}
              render={({ field: descField }) => (
                <Pecha.FormItem>
                  <Pecha.FormLabel>
                    {t("studio.groups.events.metadata.description_label")}
                  </Pecha.FormLabel>
                  <Pecha.FormControl>
                    <MarkdownEditor
                      value={descField.value ?? ""}
                      onChange={descField.onChange}
                      placeholder={t("studio.common.description")}
                      disabled={readOnly}
                      className="bg-white dark:bg-[#181818]"
                      textareaClassName="bg-white dark:bg-[#181818]"
                    />
                  </Pecha.FormControl>
                  <Pecha.FormMessage />
                </Pecha.FormItem>
              )}
            />
          </div>
        );
      })}
    </div>
  );
};

export default EventMetadataRows;
