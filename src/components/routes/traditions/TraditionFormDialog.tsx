import { useEffect, useState } from "react";
import { IoMdAdd, IoMdClose } from "react-icons/io";
import { Pecha } from "@/components/ui/shadimport";
import { Textarea } from "@/components/ui/atoms/textarea";
import { Button } from "@/components/ui/atoms/button";
import { toast } from "sonner";
import { useTranslate } from "@tolgee/react";
import { useLanguages } from "@/hooks/useLanguages";
import { normalizeLanguageCode } from "@/lib/languageCodes";
import type { LanguageCode } from "@/schema/SeriesSchema";
import type {
  Tradition,
  TraditionMetadataInput,
  TraditionPayload,
} from "./api/traditionsApi";

interface TraditionFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tradition: Tradition | null;
  isSubmitting: boolean;
  onSubmit: (payload: TraditionPayload) => void;
}

interface LanguageData {
  name: string;
  description: string;
}

const TraditionFormDialog = ({
  open,
  onOpenChange,
  tradition,
  isSubmitting,
  onSubmit,
}: TraditionFormDialogProps) => {
  const { t } = useTranslate();
  const isEdit = !!tradition;
  const { languageOptions, getLanguageLabel } = useLanguages();
  const [code, setCode] = useState("");
  const [regionsText, setRegionsText] = useState("");
  const [activeLanguages, setActiveLanguages] = useState<LanguageCode[]>([
    "EN",
  ]);
  const [languageData, setLanguageData] = useState<
    Record<string, LanguageData>
  >({
    EN: { name: "", description: "" },
  });

  useEffect(() => {
    if (!open) return;

    setCode(tradition?.code ?? "");
    setRegionsText(tradition?.regions?.join(", ") ?? "");

    if (tradition?.metadata && tradition.metadata.length > 0) {
      const langs: LanguageCode[] = [];
      const data: Record<string, LanguageData> = {};

      tradition.metadata.forEach((meta) => {
        const lang = normalizeLanguageCode(String(meta.language ?? ""));
        if (!lang) return;
        langs.push(lang);
        data[lang] = {
          name: meta.name,
          description: meta.description || "",
        };
      });

      setActiveLanguages(langs.length > 0 ? langs : ["EN"]);
      setLanguageData(
        Object.keys(data).length > 0
          ? data
          : { EN: { name: "", description: "" } },
      );
    } else {
      setActiveLanguages(["EN"]);
      setLanguageData({ EN: { name: "", description: "" } });
    }
  }, [open, tradition]);

  const availableLanguages = languageOptions.filter(
    (lang) => !activeLanguages.includes(lang.value),
  );

  const addLanguage = (langCode: LanguageCode) => {
    setActiveLanguages([...activeLanguages, langCode]);
    setLanguageData((prev) => ({
      ...prev,
      [langCode]: prev[langCode] ?? { name: "", description: "" },
    }));
  };

  const removeLanguage = (langCode: LanguageCode) => {
    if (activeLanguages.length === 1) {
      toast.error(t("studio.traditions.validation.language_required"));
      return;
    }
    setActiveLanguages(activeLanguages.filter((l) => l !== langCode));
  };

  const updateLanguageField = (
    lang: LanguageCode,
    field: keyof LanguageData,
    value: string,
  ) => {
    setLanguageData((prev) => ({
      ...prev,
      [lang]: {
        name: prev[lang]?.name ?? "",
        description: prev[lang]?.description ?? "",
        [field]: value,
      },
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const normalizedCode = code
      .trim()
      .toLowerCase()
      .replace(/[\s-]+/g, "_");
    if (!/^[a-z][a-z0-9_]{1,62}$/.test(normalizedCode)) {
      toast.error(t("studio.traditions.validation.code_format"));
      return;
    }

    const metadata: TraditionMetadataInput[] = [];
    for (const lang of activeLanguages) {
      const data = languageData[lang] ?? { name: "", description: "" };
      if (!data.name.trim()) {
        toast.error(
          t("studio.traditions.validation.name_required_for", {
            language: getLanguageLabel(lang),
          }),
        );
        return;
      }
      metadata.push({
        language: lang,
        name: data.name.trim(),
        description: data.description.trim() || null,
      });
    }

    const regions = regionsText
      .split(",")
      .map((region) => region.trim())
      .filter(Boolean);

    onSubmit({
      code: normalizedCode,
      regions,
      metadata,
    });
  };

  return (
    <Pecha.Dialog open={open} onOpenChange={onOpenChange}>
      <Pecha.DialogContent className="flex max-h-[min(90dvh,90vh)] w-[calc(100%-2rem)] max-w-lg flex-col gap-0 overflow-hidden p-0 sm:w-full">
        <Pecha.DialogHeader className="shrink-0 border-b px-6 py-4">
          <Pecha.DialogTitle>
            {isEdit
              ? t("studio.traditions.form.edit_title")
              : t("studio.traditions.form.create_title")}
          </Pecha.DialogTitle>
        </Pecha.DialogHeader>
        <form
          onSubmit={handleSubmit}
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
        >
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-4">
            <div className="space-y-2">
              <label className="text-sm font-bold">
                {t("studio.traditions.table.code")}
              </label>
              <Pecha.Input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder={t("studio.traditions.form.code_placeholder")}
                required
                disabled={isEdit}
              />
              <p className="text-xs text-muted-foreground">
                {t("studio.traditions.form.code_help")}
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold">
                {t("studio.traditions.table.regions")}
              </label>
              <Pecha.Input
                value={regionsText}
                onChange={(e) => setRegionsText(e.target.value)}
                placeholder={t("studio.traditions.form.regions_placeholder")}
              />
              <p className="text-xs text-muted-foreground">
                {t("studio.traditions.form.regions_help")}
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-bold">
                  {t("studio.traditions.form.languages")}
                </label>
                {availableLanguages.length > 0 ? (
                  <Pecha.DropdownMenu>
                    <Pecha.DropdownMenuTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                      >
                        <IoMdAdd className="h-3 w-3 mr-1" />
                        {t("studio.traditions.form.add_language")}
                      </Button>
                    </Pecha.DropdownMenuTrigger>
                    <Pecha.DropdownMenuContent>
                      {availableLanguages.map((lang) => (
                        <Pecha.DropdownMenuItem
                          key={lang.value}
                          onClick={() =>
                            addLanguage(lang.value as LanguageCode)
                          }
                        >
                          {lang.label}
                        </Pecha.DropdownMenuItem>
                      ))}
                    </Pecha.DropdownMenuContent>
                  </Pecha.DropdownMenu>
                ) : null}
              </div>

              {activeLanguages.map((lang) => {
                const langLabel = getLanguageLabel(lang);
                return (
                  <div
                    key={lang}
                    className="relative rounded-lg border border-input bg-[#FAFAFA] dark:bg-[#262626] p-4 space-y-3"
                  >
                    {activeLanguages.length > 1 ? (
                      <button
                        type="button"
                        onClick={() => removeLanguage(lang)}
                        className="absolute top-2 right-2 text-muted-foreground hover:text-foreground p-1 rounded"
                        aria-label={t(
                          "studio.traditions.form.remove_language_aria",
                          {
                            language: langLabel,
                          },
                        )}
                      >
                        <IoMdClose className="h-4 w-4" />
                      </button>
                    ) : null}
                    <div className="text-sm font-semibold text-muted-foreground mb-2">
                      {langLabel}
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold">
                        {t("studio.common.name")}
                      </label>
                      <Pecha.Input
                        value={languageData[lang]?.name ?? ""}
                        onChange={(e) =>
                          updateLanguageField(lang, "name", e.target.value)
                        }
                        placeholder={t(
                          "studio.traditions.form.name_placeholder",
                        )}
                        required
                        className="bg-white dark:bg-[#181818]"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold">
                        {t("studio.common.description")}
                      </label>
                      <Textarea
                        value={languageData[lang]?.description ?? ""}
                        onChange={(e) =>
                          updateLanguageField(
                            lang,
                            "description",
                            e.target.value,
                          )
                        }
                        placeholder={t(
                          "studio.traditions.form.description_placeholder",
                        )}
                        className="bg-white dark:bg-[#181818]"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="shrink-0 border-t px-6 py-4 flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              {t("studio.common.cancel")}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting
                ? t("studio.common.saving")
                : isEdit
                  ? t("studio.traditions.form.save_changes")
                  : t("studio.traditions.form.create_title")}
            </Button>
          </div>
        </form>
      </Pecha.DialogContent>
    </Pecha.Dialog>
  );
};

export default TraditionFormDialog;
