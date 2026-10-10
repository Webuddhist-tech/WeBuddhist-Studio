import { useEffect, useRef, useState } from "react";
import { IoMdAdd, IoMdClose } from "react-icons/io";
import { useDebounce } from "use-debounce";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTranslate } from "@tolgee/react";
import { Input } from "@/components/ui/atoms/input";
import { Textarea } from "@/components/ui/atoms/textarea";
import { Button } from "@/components/ui/atoms/button";
import { Pecha } from "@/components/ui/shadimport";
import { useLanguages } from "@/hooks/useLanguages";
import type { LanguageCode } from "@/schema/SeriesSchema";
import {
  createTag,
  fetchTags,
  type PlanTagSummary,
  type Tag,
  type TagMetadataInput,
} from "@/components/routes/tags/api/tagsApi";

interface PlanTagSearchInputProps {
  value?: string[];
  onChange?: (tagIds: string[]) => void;
  initialTags?: PlanTagSummary[];
  planId?: string;
  hideLabel?: boolean;
}

const SUGGESTIONS_LIMIT = 10;
const SEARCH_DEBOUNCE_MS = 400;

const normalizeName = (name: string) => name.trim().toLowerCase();

interface LanguageData {
  name: string;
  description: string;
}

const PlanTagSearchInput = ({
  value = [],
  onChange,
  initialTags = [],
  planId,
  hideLabel = false,
}: PlanTagSearchInputProps) => {
  const { t } = useTranslate();
  const queryClient = useQueryClient();
  const containerRef = useRef<HTMLDivElement>(null);
  const { languageOptions, getLanguageLabel } = useLanguages();
  const [inputValue, setInputValue] = useState("");
  const [debouncedSearch] = useDebounce(inputValue, SEARCH_DEBOUNCE_MS);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [tagLabels, setTagLabels] = useState<Record<string, string>>(() =>
    Object.fromEntries(initialTags.map((tag) => [tag.id, tag.name])),
  );
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [activeLanguages, setActiveLanguages] = useState<LanguageCode[]>([
    "EN",
  ]);
  const [languageData, setLanguageData] = useState<
    Record<string, LanguageData>
  >({
    EN: { name: "", description: "" },
  });

  useEffect(() => {
    if (!initialTags.length) return;
    setTagLabels((prev) => ({
      ...prev,
      ...Object.fromEntries(initialTags.map((tag) => [tag.id, tag.name])),
    }));
  }, [initialTags]);

  const { data, isFetching } = useQuery({
    queryKey: ["cms-tags-search", debouncedSearch],
    queryFn: () => fetchTags(1, SUGGESTIONS_LIMIT, debouncedSearch.trim()),
    enabled: showSuggestions && debouncedSearch.trim().length > 0,
    refetchOnWindowFocus: false,
  });

  const createTagMutation = useMutation({
    mutationFn: (metadata: TagMetadataInput[]) =>
      createTag({
        metadata,
        image_key: null,
        plan_ids: planId ? [planId] : [],
      }),
    onSuccess: (tag: Tag) => {
      queryClient.invalidateQueries({ queryKey: ["cms-tags-search"] });
      queryClient.invalidateQueries({ queryKey: ["cms-tags"] });
      addTag(tag);
      setInputValue("");
      setShowSuggestions(false);
      setShowCreateDialog(false);
      resetCreateForm();
      toast.success(t("studio.plan.tags.created", { name: tag.name }));
    },
    onError: () => {
      toast.error(t("studio.plan.tags.create_failed"));
    },
  });

  const suggestions = (data?.tags ?? []).filter(
    (tag) => !value.includes(tag.id),
  );
  const trimmedInput = inputValue.trim();
  const normalizedInput = normalizeName(trimmedInput);

  const hasExactMatch = suggestions.some(
    (tag) => normalizeName(tag.name) === normalizedInput,
  );
  const showCreateOption =
    trimmedInput.length > 0 &&
    !hasExactMatch &&
    !value.some((id) => normalizeName(tagLabels[id] ?? "") === normalizedInput);

  const addTag = (tag: { id: string; name: string }) => {
    if (value.includes(tag.id)) return;
    setTagLabels((prev) => ({ ...prev, [tag.id]: tag.name }));
    onChange?.([...value, tag.id]);
  };

  const removeTag = (tagId: string) => {
    onChange?.(value.filter((id) => id !== tagId));
  };

  const selectSuggestion = (tag: { id: string; name: string }) => {
    addTag(tag);
    setInputValue("");
    setShowSuggestions(false);
  };

  const resetCreateForm = () => {
    setActiveLanguages(["EN"]);
    setLanguageData({
      EN: { name: "", description: "" },
    });
  };

  const openCreateDialog = () => {
    resetCreateForm();
    setLanguageData((prev) => ({
      ...prev,
      EN: { name: trimmedInput, description: "" },
    }));
    setShowCreateDialog(true);
    setShowSuggestions(false);
  };

  const handleCreateTag = () => {
    const metadata: TagMetadataInput[] = [];
    for (const lang of activeLanguages) {
      const data = languageData[lang] ?? { name: "", description: "" };
      if (!data.name.trim()) {
        toast.error(
          t("studio.plan.tags.name_required_for", {
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
    createTagMutation.mutate(metadata);
  };

  const addLanguage = (langCode: LanguageCode) => {
    setActiveLanguages([...activeLanguages, langCode]);
    setLanguageData((prev) => ({
      ...prev,
      [langCode]: prev[langCode] ?? { name: "", description: "" },
    }));
  };

  const removeLanguage = (langCode: LanguageCode) => {
    if (activeLanguages.length === 1) {
      toast.error(t("studio.plan.tags.language_required"));
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

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (!trimmedInput) return;

      const exactSuggestion = suggestions.find(
        (tag) => normalizeName(tag.name) === normalizedInput,
      );
      if (exactSuggestion) {
        selectSuggestion(exactSuggestion);
        return;
      }
      if (showCreateOption) {
        openCreateDialog();
      }
    } else if (e.key === "Escape") {
      setShowSuggestions(false);
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const showDropdown =
    showSuggestions &&
    trimmedInput.length > 0 &&
    (isFetching || suggestions.length > 0 || showCreateOption);

  return (
    <div
      ref={containerRef}
      className="w-full space-y-2 h-full font-dynamic flex flex-col"
    >
      {!hideLabel ? (
        <p className="text-sm font-bold">{t("studio.plan.tags.label")}</p>
      ) : null}

      {value.length > 0 && (
        <div className="flex flex-wrap items-center justify-start h-fit gap-2">
          {value.map((tagId) => (
            <div
              key={tagId}
              className="bg-gray-100 dark:bg-input/30 space-x-4 h-fit w-fit border border-dashed px-4 rounded-full py-2 flex items-center justify-between"
            >
              <p className="text-sm text-gray-500 dark:text-gray-100">
                {tagLabels[tagId] ?? tagId}
              </p>
              <button
                type="button"
                aria-label={t("studio.plan.tags.remove_aria", {
                  name: tagLabels[tagId] ?? t("studio.plan.tags.tag_fallback"),
                })}
                onClick={() => removeTag(tagId)}
                className="cursor-pointer"
              >
                <IoMdClose className="h-5 w-5 text-white rounded-full p-1 border border-dashed dark:bg-input/90 bg-gray-300 hover:bg-gray-400 transition" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="relative w-full">
        <Input
          placeholder={t("studio.plan.tags.search_placeholder")}
          className="border shadow-none bg-white"
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            setShowSuggestions(true);
          }}
          onFocus={() => setShowSuggestions(true)}
          onKeyDown={handleKeyDown}
          disabled={createTagMutation.isPending}
          autoComplete="off"
          aria-autocomplete="list"
          aria-expanded={showDropdown}
        />

        {showDropdown && (
          <ul
            className="absolute z-50 mt-1 w-full max-h-48 overflow-y-auto rounded-md border bg-white dark:bg-[#1e1e1e] shadow-md py-1"
            role="listbox"
          >
            {showCreateOption && (
              <li role="option">
                <button
                  type="button"
                  className="w-full px-3 py-2 text-left text-sm text-[#A51C21] hover:bg-muted/50 cursor-pointer font-medium border-b"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={openCreateDialog}
                  disabled={createTagMutation.isPending}
                >
                  {createTagMutation.isPending
                    ? t("studio.plan.tags.creating_tag")
                    : t("studio.plan.tags.create_option", {
                        name: trimmedInput,
                      })}
                </button>
              </li>
            )}
            {isFetching && suggestions.length === 0 && (
              <li className="px-3 py-2 text-sm text-muted-foreground">
                {t("studio.plan.tags.searching")}
              </li>
            )}
            {suggestions.map((tag) => (
              <li key={tag.id} role="option">
                <button
                  type="button"
                  className="w-full px-3 py-2 text-left text-sm hover:bg-muted/50 cursor-pointer"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => selectSuggestion(tag)}
                >
                  {tag.name}
                </button>
              </li>
            ))}
            {!isFetching && suggestions.length === 0 && !showCreateOption && (
              <li className="px-3 py-2 text-sm text-muted-foreground">
                {t("studio.plan.tags.no_tags_found")}
              </li>
            )}
          </ul>
        )}
      </div>

      {/* Multi-language Create Tag Dialog */}
      <Pecha.Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <Pecha.DialogContent className="flex max-h-[min(90dvh,90vh)] w-[calc(100%-2rem)] max-w-lg flex-col gap-0 overflow-hidden p-0 sm:w-full">
          <Pecha.DialogHeader className="shrink-0 border-b px-6 py-4">
            <Pecha.DialogTitle>
              {t("studio.plan.tags.create_dialog_title")}
            </Pecha.DialogTitle>
          </Pecha.DialogHeader>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-bold">
                  {t("studio.plan.tags.languages")}
                </label>
                {languageOptions.filter(
                  (lang) => !activeLanguages.includes(lang.value),
                ).length > 0 && (
                  <Pecha.DropdownMenu>
                    <Pecha.DropdownMenuTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                      >
                        <IoMdAdd className="h-3 w-3 mr-1" />
                        {t("studio.plan.tags.add_language")}
                      </Button>
                    </Pecha.DropdownMenuTrigger>
                    <Pecha.DropdownMenuContent>
                      {languageOptions
                        .filter((lang) => !activeLanguages.includes(lang.value))
                        .map((lang) => (
                          <Pecha.DropdownMenuItem
                            key={lang.value}
                            onClick={() => addLanguage(lang.value)}
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
                        aria-label={t("studio.plan.tags.remove_language_aria", {
                          language: langLabel,
                        })}
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
                      <Input
                        value={languageData[lang]?.name ?? ""}
                        onChange={(e) =>
                          updateLanguageField(lang, "name", e.target.value)
                        }
                        placeholder={t("studio.plan.tags.name_placeholder")}
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
                          "studio.plan.tags.description_placeholder",
                        )}
                        className="field-sizing-fixed min-h-[80px] max-h-32 resize-none bg-white dark:bg-[#181818]"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="flex shrink-0 justify-end gap-2 border-t bg-background px-6 py-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowCreateDialog(false)}
              disabled={createTagMutation.isPending}
            >
              {t("studio.common.cancel")}
            </Button>
            <Button
              type="button"
              className="bg-[#A51C21] text-white hover:bg-[#A51C21]/90"
              onClick={handleCreateTag}
              disabled={createTagMutation.isPending}
            >
              {createTagMutation.isPending
                ? t("studio.common.creating")
                : t("studio.plan.tags.create_tag")}
            </Button>
          </div>
        </Pecha.DialogContent>
      </Pecha.Dialog>
    </div>
  );
};

export default PlanTagSearchInput;
