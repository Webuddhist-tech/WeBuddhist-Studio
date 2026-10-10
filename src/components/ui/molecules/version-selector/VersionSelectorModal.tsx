import { Pecha } from "@/components/ui/shadimport";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchTextLanguages,
  fetchLanguageVersions,
} from "@/components/api/searchApi";
import { createOrUpdatePreset } from "@/components/routes/task/api/presetApi";
import { toast } from "sonner";
import { useTranslate } from "@tolgee/react";

interface VersionSelectorModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  textId: string;
  subtaskId?: string;
  onSuccess?: () => void;
}

export const VersionSelectorModal = ({
  isOpen,
  onOpenChange,
  textId,
  subtaskId,
  onSuccess,
}: VersionSelectorModalProps) => {
  const { t } = useTranslate();
  const queryClient = useQueryClient();
  const [selectedLanguage, setSelectedLanguage] = useState<string>("");
  const [selectedVersion, setSelectedVersion] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);

  const { data: languagesData, isLoading: isLoadingLanguages } = useQuery({
    queryKey: ["textLanguages", textId],
    queryFn: () => fetchTextLanguages(textId),
    enabled: isOpen && !!textId,
  });

  const { data: versionsData, isLoading: isLoadingVersions } = useQuery({
    queryKey: ["languageVersions", textId, selectedLanguage],
    queryFn: () => fetchLanguageVersions(textId, selectedLanguage),
    enabled: isOpen && !!selectedLanguage,
  });

  const handleSave = async () => {
    if (!selectedVersion || !selectedLanguage) {
      toast.error(t("studio.molecules.version_selector.select_both"));
      return;
    }

    if (!subtaskId || subtaskId.trim() === "") {
      toast.error(t("studio.molecules.version_selector.missing_subtask"));
      return;
    }

    setIsSaving(true);
    try {
      await createOrUpdatePreset(subtaskId, {
        version_id: selectedVersion,
        language: selectedLanguage,
      });

      // Invalidate preset query to refresh the display
      queryClient.invalidateQueries({ queryKey: ["preset", subtaskId] });

      toast.success(t("studio.molecules.version_selector.saved"));
      onOpenChange(false);
      if (onSuccess) {
        onSuccess();
      }
    } catch (error: any) {
      toast.error(
        error?.response?.data?.detail ||
          t("studio.molecules.version_selector.save_failed"),
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    setSelectedLanguage("");
    setSelectedVersion("");
    onOpenChange(false);
  };

  const availableLanguages = languagesData?.available_languages || [];
  const availableVersions = versionsData?.available_versions || [];

  return (
    <Pecha.Sheet open={isOpen} onOpenChange={handleClose}>
      <Pecha.SheetContent className="sm:max-w-md p-6">
        <Pecha.SheetHeader className="mb-6">
          <Pecha.SheetTitle>
            {t("studio.molecules.version_selector.title")}
          </Pecha.SheetTitle>
          <Pecha.SheetDescription>
            {t("studio.molecules.version_selector.description")}
          </Pecha.SheetDescription>
        </Pecha.SheetHeader>

        <div className="space-y-6">
          {/* Language Selection */}
          <div className="space-y-4">
            <label className="text-sm font-medium block">
              {t("studio.common.language")}
            </label>
            {isLoadingLanguages ? (
              <div className="text-sm text-gray-500">
                {t("studio.molecules.version_selector.loading_languages")}
              </div>
            ) : availableLanguages.length === 0 ? (
              <div className="text-sm text-gray-500">
                {t("studio.molecules.version_selector.no_versions")}
              </div>
            ) : (
              <Pecha.Select
                value={selectedLanguage}
                onValueChange={(value) => {
                  setSelectedLanguage(value);
                  setSelectedVersion("");
                }}
              >
                <Pecha.SelectTrigger>
                  <Pecha.SelectValue
                    placeholder={t(
                      "studio.molecules.version_selector.language_placeholder",
                    )}
                  />
                </Pecha.SelectTrigger>
                <Pecha.SelectContent>
                  {availableLanguages.map((lang: any) => (
                    <Pecha.SelectItem
                      key={lang.language_code}
                      value={lang.language_code}
                    >
                      {lang.language} (
                      {lang.version_count === 1
                        ? t("studio.molecules.version_selector.versions_one")
                        : t(
                            "studio.molecules.version_selector.versions_other",
                            {
                              count: lang.version_count,
                            },
                          )}
                      )
                    </Pecha.SelectItem>
                  ))}
                </Pecha.SelectContent>
              </Pecha.Select>
            )}
          </div>

          {/* Version Selection */}
          {selectedLanguage && (
            <div className="space-y-4">
              <label className="text-sm font-medium block">
                {t("studio.molecules.version_selector.version_label")}
              </label>
              {isLoadingVersions ? (
                <div className="text-sm text-gray-500">
                  {t("studio.molecules.version_selector.loading_versions")}
                </div>
              ) : (
                <Pecha.Select
                  value={selectedVersion}
                  onValueChange={setSelectedVersion}
                >
                  <Pecha.SelectTrigger>
                    <Pecha.SelectValue
                      placeholder={t(
                        "studio.molecules.version_selector.version_placeholder",
                      )}
                    />
                  </Pecha.SelectTrigger>
                  <Pecha.SelectContent>
                    {availableVersions.map((version: any) => (
                      <Pecha.SelectItem key={version.id} value={version.id}>
                        {version.title}
                      </Pecha.SelectItem>
                    ))}
                  </Pecha.SelectContent>
                </Pecha.Select>
              )}
            </div>
          )}
        </div>

        <div className="flex gap-3 pt-6 mt-8 border-t">
          <Pecha.Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={isSaving}
            className="flex-1"
          >
            {t("studio.common.cancel")}
          </Pecha.Button>
          <Pecha.Button
            type="button"
            onClick={handleSave}
            disabled={!selectedVersion || isSaving}
            className="flex-1"
          >
            {isSaving ? t("studio.common.saving") : t("studio.common.save")}
          </Pecha.Button>
        </div>
      </Pecha.SheetContent>
    </Pecha.Sheet>
  );
};
