import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { IoMdCopy } from "react-icons/io";
import { toast } from "sonner";
import { useTranslate } from "@tolgee/react";
import { Pecha } from "@/components/ui/shadimport";
import { getLanguageLabel } from "@/components/api/languagesApi";
import type { LanguageCode } from "@/schema/SeriesSchema";
import { cloneSeriesPlansFromLanguage } from "@/components/routes/create-series/api/seriesApi";

type CloneLanguagePlansPanelProps = {
  seriesId: string;
  targetLanguage: LanguageCode;
  sourceLanguages: LanguageCode[];
  embedded?: boolean;
};

function languageLabel(code: LanguageCode): string {
  return getLanguageLabel(code);
}

export function CloneLanguagePlansPanel({
  seriesId,
  targetLanguage,
  sourceLanguages,
  embedded = false,
}: Readonly<CloneLanguagePlansPanelProps>) {
  const queryClient = useQueryClient();
  const { t } = useTranslate();
  const [sourceLanguage, setSourceLanguage] = useState<LanguageCode>(
    sourceLanguages[0] ?? "EN",
  );

  const effectiveSource = useMemo(() => {
    if (sourceLanguages.includes(sourceLanguage)) return sourceLanguage;
    return sourceLanguages[0] ?? "EN";
  }, [sourceLanguage, sourceLanguages]);

  const cloneMutation = useMutation({
    mutationFn: () =>
      cloneSeriesPlansFromLanguage(seriesId, {
        source_language: effectiveSource,
        target_language: targetLanguage,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["series", seriesId] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-items"] });
      toast.success(
        t("studio.series.clone.success", {
          source: languageLabel(effectiveSource),
          target: languageLabel(targetLanguage),
        }),
      );
    },
    onError: (err: unknown) => {
      const message = (
        err as {
          response?: { data?: { detail?: string | { message?: string } } };
        }
      )?.response?.data?.detail;
      const text =
        typeof message === "string"
          ? message
          : (message?.message ?? t("studio.series.clone.failed"));
      toast.error(text);
    },
  });

  if (sourceLanguages.length === 0) return null;

  const content = (
    <>
      <p className="text-center text-sm text-muted-foreground">
        {t("studio.series.clone.empty_description", {
          language: languageLabel(targetLanguage),
        })}
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Pecha.Select
          value={effectiveSource}
          onValueChange={(value) => setSourceLanguage(value as LanguageCode)}
        >
          <Pecha.SelectTrigger className="w-[180px] bg-background">
            <Pecha.SelectValue
              placeholder={t("studio.series.clone.source_language")}
            />
          </Pecha.SelectTrigger>
          <Pecha.SelectContent>
            {sourceLanguages.map((code) => (
              <Pecha.SelectItem key={code} value={code}>
                {languageLabel(code)}
              </Pecha.SelectItem>
            ))}
          </Pecha.SelectContent>
        </Pecha.Select>
        <Pecha.Button
          type="button"
          variant="outline"
          className="gap-2"
          disabled={cloneMutation.isPending}
          onClick={() => cloneMutation.mutate()}
        >
          <IoMdCopy className="h-4 w-4" />
          {cloneMutation.isPending
            ? t("studio.series.clone.cloning")
            : t("studio.series.clone.clone_plans")}
        </Pecha.Button>
      </div>
    </>
  );

  if (embedded) {
    return (
      <div className="flex w-full flex-col items-center gap-4">{content}</div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-gray-300 bg-white/80 px-6 py-10 dark:border-input dark:bg-[#1d1d1f]/80">
      {content}
    </div>
  );
}
