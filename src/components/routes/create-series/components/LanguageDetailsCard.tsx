import type { UseFormReturn } from "react-hook-form";
import { useTranslate } from "@tolgee/react";
import { IoMdClose } from "react-icons/io";
import { Pecha } from "@/components/ui/shadimport";
import { MarkdownEditor } from "@/components/ui/atoms/markdown-editor";
import type { LanguageCode, SeriesFormData } from "@/schema/SeriesSchema";
import { getEnglishLanguageLabel } from "@/components/routes/create-series/utils/language";

type LanguageDetailsCardProps = {
  code: LanguageCode;
  form: UseFormReturn<SeriesFormData>;
  readOnly: boolean;
  onRemove: (code: LanguageCode) => void;
};

const LanguageDetailsCard = ({
  code,
  form,
  readOnly,
  onRemove,
}: LanguageDetailsCardProps) => {
  const { t } = useTranslate();
  const label = getEnglishLanguageLabel(code);

  return (
    <div className="relative rounded-lg border border-input bg-[#FAFAFA] dark:bg-[#262626] p-4 space-y-3">
      <button
        type="button"
        onClick={() => onRemove(code)}
        disabled={readOnly}
        className="absolute top-2 right-2 text-muted-foreground hover:text-foreground p-1 rounded disabled:opacity-40"
        aria-label={t("studio.series.form.remove_language_aria", {
          language: label,
        })}
      >
        <IoMdClose className="h-4 w-4" />
      </button>
      <Pecha.FormField
        control={form.control}
        name={`languages.${code}.title`}
        render={({ field }) => (
          <Pecha.FormItem>
            <Pecha.FormLabel className="text-sm font-bold">
              {t("studio.series.form.title_label", { language: label })}
            </Pecha.FormLabel>
            <Pecha.FormControl>
              <Pecha.Input
                placeholder={t("studio.series.form.title_placeholder", {
                  language: label,
                })}
                className="h-12 text-base bg-white dark:bg-[#181818]"
                disabled={readOnly}
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
              {t("studio.series.form.subtitle_label", { language: label })}
            </Pecha.FormLabel>
            <Pecha.FormControl>
              <Pecha.Input
                placeholder={t("studio.series.form.subtitle_placeholder", {
                  language: label,
                })}
                className="h-12 text-base bg-white dark:bg-[#181818]"
                disabled={readOnly}
                {...field}
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
              {t("studio.series.form.description_label", {
                language: label,
              })}
            </Pecha.FormLabel>
            <Pecha.FormControl>
              <MarkdownEditor
                value={field.value}
                onChange={field.onChange}
                placeholder={t("studio.series.form.description_placeholder")}
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
};

export default LanguageDetailsCard;
