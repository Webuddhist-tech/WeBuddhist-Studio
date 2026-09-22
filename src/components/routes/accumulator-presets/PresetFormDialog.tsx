import { useEffect, useState } from "react";
import { IoMdAdd, IoMdClose } from "react-icons/io";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Pecha } from "@/components/ui/shadimport";
import { Textarea } from "@/components/ui/atoms/textarea";
import { Button } from "@/components/ui/atoms/button";
import { useLanguages } from "@/hooks/useLanguages";
import { normalizeLanguageCode } from "@/lib/languageCodes";
import { getApiErrorMessage } from "@/lib/apiErrors";
import type { LanguageCode } from "@/schema/SeriesSchema";
import type { FkOption } from "@/components/routes/groups/components/FkMultiSearchSelector";
import EventLinkPicker from "@/components/routes/groups/components/events/EventLinkPicker";
import ImageContentData from "@/components/ui/molecules/modals/image-upload/ImageContentData";
import {
  type AccumulatorPreset,
  type AccumulatorPresetPayload,
  type UpdateAccumulatorPresetPayload,
  presetDisplayName,
} from "./api/accumulatorPresetsApi";
import {
  createMantra,
  fetchMantras,
  searchMantrasForPicker,
  updateMantra,
  uploadMantraDeityImage,
} from "./api/mantrasApi";
import { searchTextsForPicker } from "./api/textPickerApi";

interface PresetFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preset: AccumulatorPreset | null;
  isSubmitting: boolean;
  onSubmit: (
    payload: AccumulatorPresetPayload | UpdateAccumulatorPresetPayload,
  ) => void;
}

interface LanguageData {
  name: string;
  description: string;
}

const PresetFormDialog = ({
  open,
  onOpenChange,
  preset,
  isSubmitting,
  onSubmit,
}: PresetFormDialogProps) => {
  const isEdit = !!preset;
  const { languageOptions, getLanguageLabel } = useLanguages();
  const [activeLanguages, setActiveLanguages] = useState<LanguageCode[]>([
    "EN",
  ]);
  const [languageData, setLanguageData] = useState<
    Record<string, LanguageData>
  >({
    EN: { name: "", description: "" },
  });
  const [targetCount, setTargetCount] = useState("");
  const [textOption, setTextOption] = useState<FkOption | null>(null);
  const [mantraOption, setMantraOption] = useState<FkOption | null>(null);
  const [showCreateMantra, setShowCreateMantra] = useState(false);
  const [newMantraLanguage, setNewMantraLanguage] =
    useState<LanguageCode>("EN");
  const [newMantraTitle, setNewMantraTitle] = useState("");
  const [newMantraText, setNewMantraText] = useState("");
  const [newMantraPronunciation, setNewMantraPronunciation] = useState("");
  const [deityImageOverride, setDeityImageOverride] = useState<
    "unset" | { url: string | null }
  >("unset");
  const [isDeityImageDialogOpen, setIsDeityImageDialogOpen] = useState(false);
  const [isDeityImageUploading, setIsDeityImageUploading] = useState(false);
  const [isRemovingDeityImage, setIsRemovingDeityImage] = useState(false);

  useEffect(() => {
    if (!open) return;

    if (preset?.metadata && preset.metadata.length > 0) {
      const langs: LanguageCode[] = [];
      const data: Record<string, LanguageData> = {};
      preset.metadata.forEach((meta) => {
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

    setTargetCount(
      preset?.target_count != null ? String(preset.target_count) : "",
    );
    setTextOption(
      preset?.text_id ? { id: preset.text_id, title: preset.text_id } : null,
    );
    setMantraOption(
      preset?.mantra
        ? {
            id: preset.mantra.id,
            title:
              preset.mantra.title?.trim() ||
              preset.mantra.mantra?.trim() ||
              preset.mantra.id,
            image_url: preset.mantra.mala_image_url ?? undefined,
          }
        : null,
    );
    setShowCreateMantra(false);
    setNewMantraLanguage("EN");
    setNewMantraTitle("");
    setNewMantraText("");
    setNewMantraPronunciation("");
    setDeityImageOverride("unset");
    setIsDeityImageDialogOpen(false);
  }, [open, preset]);

  useEffect(() => {
    setDeityImageOverride("unset");
  }, [mantraOption?.id]);

  const { data: mantraLookupData } = useQuery({
    queryKey: ["mantra-deity-image-lookup"],
    queryFn: () => fetchMantras(),
    enabled: open && !!mantraOption?.id,
  });

  const linkedMantra = mantraLookupData?.mantras.find(
    (m) => m.id === mantraOption?.id,
  );

  const displayedDeityImageUrl =
    deityImageOverride !== "unset"
      ? deityImageOverride.url
      : (linkedMantra?.deity_image?.medium ??
        linkedMantra?.deity_image?.original ??
        null);

  const handleDeityImageUpload = async (file: File) => {
    if (!mantraOption?.id) return;
    setIsDeityImageUploading(true);
    try {
      const { image, key } = await uploadMantraDeityImage(
        file,
        mantraOption.id,
      );
      await updateMantra(mantraOption.id, { deity_image_key: key });
      setDeityImageOverride({ url: image.original });
      setIsDeityImageDialogOpen(false);
      toast.success("Deity image uploaded");
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    } finally {
      setIsDeityImageUploading(false);
    }
  };

  const handleRemoveDeityImage = async () => {
    if (!mantraOption?.id) return;
    setIsRemovingDeityImage(true);
    try {
      await updateMantra(mantraOption.id, { deity_image_key: null });
      setDeityImageOverride({ url: null });
      toast.success("Deity image removed");
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    } finally {
      setIsRemovingDeityImage(false);
    }
  };

  const createMantraMutation = useMutation({
    mutationFn: createMantra,
    onSuccess: (created) => {
      const meta = created.metadata?.[0];
      setMantraOption({
        id: created.id,
        title: meta?.title?.trim() || meta?.mantra?.trim() || created.id,
        image_url: created.mala_image_url ?? undefined,
      });
      setShowCreateMantra(false);
      setNewMantraTitle("");
      setNewMantraText("");
      setNewMantraPronunciation("");
      toast.success("Mantra created");
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

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
      toast.error("At least one language is required");
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
      [lang]: { ...prev[lang], [field]: value },
    }));
  };

  const handleCreateMantra = () => {
    if (!newMantraText.trim()) {
      toast.error("Mantra text is required");
      return;
    }
    createMantraMutation.mutate({
      metadata: [
        {
          language: newMantraLanguage,
          mantra: newMantraText.trim(),
          title: newMantraTitle.trim() || null,
          pronunciation: newMantraPronunciation.trim() || null,
        },
      ],
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const metadata = activeLanguages
      .map((lang) => ({
        language: lang,
        name: (languageData[lang]?.name ?? "").trim(),
        description: (languageData[lang]?.description ?? "").trim() || null,
      }))
      .filter((entry) => entry.name.length > 0);

    if (metadata.length === 0) {
      toast.error("At least one language name is required");
      return;
    }

    const parsedTarget = targetCount.trim() ? Number(targetCount.trim()) : null;
    if (
      targetCount.trim() &&
      (!Number.isFinite(parsedTarget) || (parsedTarget ?? 0) < 1)
    ) {
      toast.error("Target count must be a positive number");
      return;
    }

    const payload: AccumulatorPresetPayload = {
      metadata,
      target_count: parsedTarget,
      text_id: textOption?.id ?? null,
      mantra_id: mantraOption?.id ?? null,
    };
    onSubmit(payload);
  };

  const idleLabel = isEdit ? "Save changes" : "Create preset";
  const pendingLabel = isEdit ? "Saving…" : "Creating…";
  const submitLabel = isSubmitting ? pendingLabel : idleLabel;

  return (
    <Pecha.Dialog open={open} onOpenChange={onOpenChange}>
      <Pecha.DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <Pecha.DialogHeader>
          <Pecha.DialogTitle>
            {isEdit
              ? `Edit preset — ${presetDisplayName(preset)}`
              : "Create accumulator preset"}
          </Pecha.DialogTitle>
          <p className="text-sm text-muted-foreground">
            Link an optional text and mantra. At least one language name is
            required.
          </p>
        </Pecha.DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 pt-2">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold">Names</p>
              {availableLanguages.length > 0 ? (
                <Pecha.Select
                  onValueChange={(v) => addLanguage(v as LanguageCode)}
                >
                  <Pecha.SelectTrigger className="w-[160px] h-9">
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

            {activeLanguages.map((lang) => (
              <div
                key={lang}
                className="space-y-2 rounded-md border p-3 bg-white dark:bg-[#262626]"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">
                    {getLanguageLabel(lang)}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeLanguage(lang)}
                    className="text-muted-foreground hover:text-foreground"
                    aria-label={`Remove ${lang}`}
                  >
                    <IoMdClose className="w-4 h-4" />
                  </button>
                </div>
                <Pecha.Input
                  placeholder="Name"
                  className="h-12 bg-white dark:bg-[#262626]"
                  value={languageData[lang]?.name ?? ""}
                  onChange={(e) =>
                    updateLanguageField(lang, "name", e.target.value)
                  }
                />
                <Textarea
                  placeholder="Description (optional)"
                  className="min-h-[72px] bg-white dark:bg-[#262626]"
                  value={languageData[lang]?.description ?? ""}
                  onChange={(e) =>
                    updateLanguageField(lang, "description", e.target.value)
                  }
                />
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <p className="text-sm font-bold">Target count</p>
            <Pecha.Input
              type="number"
              min={1}
              placeholder="e.g. 100000"
              className="h-12 bg-white dark:bg-[#262626]"
              value={targetCount}
              onChange={(e) => setTargetCount(e.target.value)}
            />
          </div>

          <EventLinkPicker
            label="Linked text (optional)"
            value={textOption}
            onChange={setTextOption}
            searchFn={searchTextsForPicker}
            queryKeyPrefix="preset-text-picker"
            searchPlaceholder="Search texts by title…"
            disabled={isSubmitting}
          />

          <div className="space-y-3">
            <EventLinkPicker
              label="Linked mantra (optional)"
              value={mantraOption}
              onChange={setMantraOption}
              searchFn={searchMantrasForPicker}
              queryKeyPrefix="preset-mantra-picker"
              searchPlaceholder="Search mantras…"
              disabled={isSubmitting || createMantraMutation.isPending}
            />

            {!showCreateMantra ? (
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => setShowCreateMantra(true)}
                disabled={isSubmitting}
              >
                <IoMdAdd className="w-4 h-4" />
                Create new mantra
              </Button>
            ) : (
              <div className="space-y-3 rounded-md border p-3 bg-muted/30">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-bold">New mantra</p>
                  <button
                    type="button"
                    onClick={() => setShowCreateMantra(false)}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <IoMdClose className="w-4 h-4" />
                  </button>
                </div>
                <Pecha.Select
                  value={newMantraLanguage}
                  onValueChange={(v) => setNewMantraLanguage(v as LanguageCode)}
                >
                  <Pecha.SelectTrigger className="h-12">
                    <Pecha.SelectValue />
                  </Pecha.SelectTrigger>
                  <Pecha.SelectContent>
                    {languageOptions.map((lang) => (
                      <Pecha.SelectItem key={lang.value} value={lang.value}>
                        {lang.label}
                      </Pecha.SelectItem>
                    ))}
                  </Pecha.SelectContent>
                </Pecha.Select>
                <Pecha.Input
                  placeholder="Title (optional)"
                  className="h-12 bg-white dark:bg-[#262626]"
                  value={newMantraTitle}
                  onChange={(e) => setNewMantraTitle(e.target.value)}
                />
                <Textarea
                  placeholder="Mantra text"
                  className="min-h-[72px] bg-white dark:bg-[#262626]"
                  value={newMantraText}
                  onChange={(e) => setNewMantraText(e.target.value)}
                />
                <Pecha.Input
                  placeholder="Pronunciation (optional)"
                  className="h-12 bg-white dark:bg-[#262626]"
                  value={newMantraPronunciation}
                  onChange={(e) => setNewMantraPronunciation(e.target.value)}
                />
                <Button
                  type="button"
                  className="w-full bg-[#A51C21] text-white hover:bg-[#A51C21]/90"
                  onClick={handleCreateMantra}
                  disabled={createMantraMutation.isPending}
                >
                  {createMantraMutation.isPending
                    ? "Creating…"
                    : "Create mantra"}
                </Button>
              </div>
            )}
          </div>

          {mantraOption?.id ? (
            <div className="space-y-2">
              <p className="text-sm font-bold">Deity image (optional)</p>
              <div className="flex items-start gap-4">
                {!displayedDeityImageUrl && (
                  <button
                    type="button"
                    onClick={() => setIsDeityImageDialogOpen(true)}
                    className="flex h-24 w-32 items-center justify-center rounded-lg border border-dashed border-gray-300 transition-colors hover:border-gray-400"
                    aria-label="Upload deity image"
                    disabled={isSubmitting}
                  >
                    <IoMdAdd className="h-8 w-8 text-gray-400" />
                  </button>
                )}
                {displayedDeityImageUrl && (
                  <div className="relative">
                    <img
                      src={displayedDeityImageUrl}
                      alt="Deity preview"
                      className="h-24 w-32 rounded-lg border object-cover"
                    />
                    <button
                      type="button"
                      onClick={handleRemoveDeityImage}
                      disabled={isSubmitting || isRemovingDeityImage}
                      className="absolute top-1 right-1 rounded-full bg-black/60 p-1 text-white"
                      aria-label="Remove deity image"
                    >
                      <IoMdClose className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>

              <Pecha.Dialog
                open={isDeityImageDialogOpen}
                onOpenChange={setIsDeityImageDialogOpen}
              >
                <Pecha.DialogContent showCloseButton>
                  <Pecha.DialogHeader>
                    <Pecha.DialogTitle>Upload & Crop Deity Image</Pecha.DialogTitle>
                  </Pecha.DialogHeader>
                  <ImageContentData
                    onUpload={handleDeityImageUpload}
                    isLoading={isDeityImageUploading}
                  />
                </Pecha.DialogContent>
              </Pecha.Dialog>
            </div>
          ) : null}

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="bg-[#A51C21] text-white hover:bg-[#A51C21]/90"
              disabled={isSubmitting || createMantraMutation.isPending}
            >
              {submitLabel}
            </Button>
          </div>
        </form>
      </Pecha.DialogContent>
    </Pecha.Dialog>
  );
};

export default PresetFormDialog;
