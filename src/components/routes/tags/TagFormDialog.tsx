import { useEffect, useState } from "react";
import { IoMdAdd, IoMdClose } from "react-icons/io";
import { Pecha } from "@/components/ui/shadimport";
import { Textarea } from "@/components/ui/atoms/textarea";
import { Button } from "@/components/ui/atoms/button";
import ImageContentData from "@/components/ui/molecules/modals/image-upload/ImageContentData";
import { uploadImageToS3 } from "@/components/routes/task/api/taskApi";
import { toast } from "sonner";
import { useTranslate } from "@tolgee/react";
import { useLanguages } from "@/hooks/useLanguages";
import { normalizeLanguageCode } from "@/lib/languageCodes";
import type { LanguageCode } from "@/schema/SeriesSchema";
import type {
  PlanOption,
  Tag,
  TagPayload,
  TagMetadataInput,
} from "./api/tagsApi";

interface TagFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tag: Tag | null;
  plans: PlanOption[];
  isSubmitting: boolean;
  onSubmit: (payload: TagPayload) => void;
}

interface LanguageData {
  name: string;
  description: string;
}

const TagFormDialog = ({
  open,
  onOpenChange,
  tag,
  plans,
  isSubmitting,
  onSubmit,
}: TagFormDialogProps) => {
  const { t } = useTranslate();
  const isEdit = !!tag;
  const { languageOptions, getLanguageLabel } = useLanguages();
  const [activeLanguages, setActiveLanguages] = useState<LanguageCode[]>([
    "EN",
  ]);
  const [languageData, setLanguageData] = useState<
    Record<string, LanguageData>
  >({
    EN: { name: "", description: "" },
  });
  const [imageKey, setImageKey] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [selectedPlanIds, setSelectedPlanIds] = useState<string[]>([]);
  const [planSearch, setPlanSearch] = useState("");
  const [isImageDialogOpen, setIsImageDialogOpen] = useState(false);
  const [isImageUploading, setIsImageUploading] = useState(false);

  useEffect(() => {
    if (!open) return;

    if (tag?.metadata && tag.metadata.length > 0) {
      const langs: LanguageCode[] = [];
      const data: Record<string, LanguageData> = {};

      tag.metadata.forEach((meta) => {
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
      setLanguageData({
        EN: { name: "", description: "" },
      });
    }

    setImageKey(tag?.image_key ?? null);
    setImagePreview(tag?.image ?? null);
    setSelectedPlanIds(tag?.plan_ids ?? []);
    setPlanSearch("");
  }, [open, tag]);

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
      toast.error(t("studio.tags.validation.language_required"));
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

  const filteredPlans = plans.filter((plan) =>
    plan.title.toLowerCase().includes(planSearch.toLowerCase()),
  );

  const togglePlan = (planId: string) => {
    setSelectedPlanIds((prev) =>
      prev.includes(planId)
        ? prev.filter((id) => id !== planId)
        : [...prev, planId],
    );
  };

  const handleImageUpload = async (file: File) => {
    setIsImageUploading(true);
    try {
      const { image, key } = await uploadImageToS3(file, "");
      setImagePreview(image.original);
      setImageKey(key);
      setIsImageDialogOpen(false);
      toast.success(t("studio.tags.toast.image_uploaded"));
    } catch (error: any) {
      if (error?.response?.status === 413) {
        toast.error(t("studio.tags.toast.image_upload_failed"), {
          description: t("studio.tags.toast.image_too_large"),
        });
      } else {
        toast.error(t("studio.tags.toast.image_upload_failed"));
      }
    } finally {
      setIsImageUploading(false);
    }
  };

  const handleRemoveImage = () => {
    setImageKey(null);
    setImagePreview(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const metadata: TagMetadataInput[] = [];
    for (const lang of activeLanguages) {
      const data = languageData[lang] ?? { name: "", description: "" };
      if (!data.name.trim()) {
        toast.error(
          t("studio.tags.validation.name_required_for", {
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

    onSubmit({
      metadata,
      image_key: imageKey,
      plan_ids: selectedPlanIds,
    });
  };

  return (
    <>
      <Pecha.Dialog open={open} onOpenChange={onOpenChange}>
        <Pecha.DialogContent className="flex max-h-[min(90dvh,90vh)] w-[calc(100%-2rem)] max-w-lg flex-col gap-0 overflow-hidden p-0 sm:w-full">
          <Pecha.DialogHeader className="shrink-0 border-b px-6 py-4">
            <Pecha.DialogTitle>
              {isEdit
                ? t("studio.tags.form.edit_title")
                : t("studio.tags.form.create_title")}
            </Pecha.DialogTitle>
          </Pecha.DialogHeader>
          <form
            onSubmit={handleSubmit}
            className="flex min-h-0 flex-1 flex-col overflow-hidden"
          >
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-4">
              {/* Language Sections */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-bold">
                    {t("studio.tags.form.languages")}
                  </label>
                  {availableLanguages.length > 0 && (
                    <Pecha.DropdownMenu>
                      <Pecha.DropdownMenuTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs"
                        >
                          <IoMdAdd className="h-3 w-3 mr-1" />
                          {t("studio.tags.form.add_language")}
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
                  )}
                </div>
                {activeLanguages.map((lang) => {
                  const langLabel = getLanguageLabel(lang);
                  return (
                    <div
                      key={lang}
                      className="relative rounded-lg border border-input bg-[#FAFAFA] dark:bg-[#262626] p-4 space-y-3"
                    >
                      {activeLanguages.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeLanguage(lang)}
                          className="absolute top-2 right-2 text-muted-foreground hover:text-foreground p-1 rounded"
                          aria-label={t(
                            "studio.tags.form.remove_language_aria",
                            {
                              language: langLabel,
                            },
                          )}
                        >
                          <IoMdClose className="h-4 w-4" />
                        </button>
                      )}
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
                          placeholder={t("studio.tags.form.name_placeholder")}
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
                            "studio.tags.form.description_placeholder",
                          )}
                          className="field-sizing-fixed min-h-[80px] max-h-32 resize-none bg-white dark:bg-[#181818]"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold">
                  {t("studio.common.image")}
                </label>
                <div className="flex gap-4 items-start">
                  {!imagePreview && (
                    <button
                      type="button"
                      onClick={() => setIsImageDialogOpen(true)}
                      className="border w-32 h-24 border-dashed border-gray-300 rounded-lg flex items-center justify-center hover:border-gray-400 transition-colors"
                      aria-label={t("studio.tags.form.upload_image_aria")}
                    >
                      <IoMdAdd className="h-8 w-8 text-gray-400" />
                    </button>
                  )}
                  {imagePreview && (
                    <div className="relative">
                      <img
                        src={imagePreview}
                        alt={t("studio.tags.form.image_preview_alt")}
                        className="w-32 h-24 object-cover rounded-lg border"
                      />
                      <button
                        type="button"
                        onClick={handleRemoveImage}
                        className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-1"
                        aria-label={t("studio.tags.form.remove_image_aria")}
                      >
                        <IoMdClose className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold">
                  {t("studio.tags.form.linked_plans")}
                </label>
                <Pecha.Input
                  value={planSearch}
                  onChange={(e) => setPlanSearch(e.target.value)}
                  placeholder={t("studio.tags.form.search_plans")}
                />
                <div className="max-h-40 overflow-y-auto border rounded-md p-2 space-y-2">
                  {filteredPlans.length === 0 ? (
                    <p className="text-sm text-muted-foreground px-2 py-1">
                      {t("studio.tags.form.no_plans")}
                    </p>
                  ) : (
                    filteredPlans.map((plan) => (
                      <label
                        key={plan.id}
                        className="flex min-w-0 items-center gap-2 rounded px-2 py-1 hover:bg-muted/50 cursor-pointer"
                      >
                        <Pecha.Checkbox
                          className="shrink-0"
                          checked={selectedPlanIds.includes(plan.id)}
                          onCheckedChange={() => togglePlan(plan.id)}
                        />
                        <span className="min-w-0 flex-1 truncate text-sm">
                          {plan.title}
                        </span>
                      </label>
                    ))
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {t("studio.tags.form.plans_selected", {
                    count: selectedPlanIds.length,
                  })}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 justify-end gap-2 border-t bg-background px-6 py-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                {t("studio.common.cancel")}
              </Button>
              <Button
                type="submit"
                className="bg-[#A51C21] text-white hover:bg-[#A51C21]/90"
                disabled={isSubmitting}
              >
                {isSubmitting
                  ? isEdit
                    ? t("studio.common.saving")
                    : t("studio.common.creating")
                  : isEdit
                    ? t("studio.common.save")
                    : t("studio.common.create")}
              </Button>
            </div>
          </form>
        </Pecha.DialogContent>
      </Pecha.Dialog>

      <Pecha.Dialog
        open={isImageDialogOpen}
        onOpenChange={setIsImageDialogOpen}
      >
        <Pecha.DialogContent showCloseButton>
          <Pecha.DialogHeader>
            <Pecha.DialogTitle>
              {t("studio.tags.form.upload_crop_image")}
            </Pecha.DialogTitle>
          </Pecha.DialogHeader>
          <ImageContentData
            onUpload={handleImageUpload}
            isLoading={isImageUploading}
          />
        </Pecha.DialogContent>
      </Pecha.Dialog>
    </>
  );
};

export default TagFormDialog;
