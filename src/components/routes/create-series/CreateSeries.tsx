import { useTranslate } from "@tolgee/react";
import { Pecha } from "@/components/ui/shadimport";
import { useCreateSeriesController } from "@/components/routes/create-series/hooks/useCreateSeriesController";
import LanguageDetailsCard from "@/components/routes/create-series/components/LanguageDetailsCard";
import AddLanguageSelect from "@/components/routes/create-series/components/AddLanguageSelect";
import CoverImageField from "@/components/routes/create-series/components/CoverImageField";
import ImageUploadDialog from "@/components/routes/create-series/components/ImageUploadDialog";
import UnsavedChangesDialog from "@/components/routes/create-series/components/UnsavedChangesDialog";
import IncludedPlansPanel from "@/components/routes/create-series/components/IncludedPlansPanel";

const CreateSeries = () => {
  const { t } = useTranslate();
  const {
    isNew,
    navigate,
    seriesForm,
    seriesGroupId,
    formReadOnly,
    platformReadOnly,
    image,
    orderedAddedLanguages,
    activePlansLanguage,
    setActivePlansLanguage,
    showNavigationDialog,
    setShowNavigationDialog,
    isSeriesLoading,
    isSeriesError,
    seriesError,
    onSubmit,
    confirmNavigation,
    cancelNavigation,
    saveDisabled,
    saveLabel,
  } = useCreateSeriesController();

  const {
    form,
    plans,
    addedLanguages,
    availableLanguages,
    addLanguage,
    removeLanguage,
  } = seriesForm;

  if (!isNew && isSeriesLoading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh] text-muted-foreground">
        Loading series…
      </div>
    );
  }

  if (!isNew && isSeriesError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] p-8 gap-4">
        <p className="text-destructive text-center">
          {(seriesError as Error)?.message || "Could not load this series."}
        </p>
        <Pecha.Button variant="outline" onClick={() => navigate("/dashboard")}>
          {t("common.button.cancel")}
        </Pecha.Button>
      </div>
    );
  }

  const getReadOnlyMessage = () => {
    if (platformReadOnly) {
      return "You have read-only access to series in this group.";
    }
    if (isNew) {
      return "You cannot create a series in this group with your current role.";
    }
    return "This series cannot be edited with your current role.";
  };

  return (
    <div className="flex flex-col lg:flex-row border h-[calc(100vh-40px)] overflow-auto bg-[#F3F3F3] dark:bg-[#181818] my-4 rounded-l-2xl font-dynamic max-md:my-0 max-md:h-full max-md:rounded-none max-md:border-0">
      <div className="flex-1 p-4 sm:p-10 border-b lg:border-b-0 border-border">
        <h1 className="text-xl font-bold my-4 border-b border-dashed border-black dark:border-white">
          {isNew ? "Series details" : "Series Edit"}
        </h1>

        {formReadOnly ? (
          <p className="mb-4 text-sm text-muted-foreground">
            {getReadOnlyMessage()}
          </p>
        ) : null}

        <Pecha.Form {...form}>
          <form onSubmit={onSubmit} className="space-y-6">
            <div className="space-y-4">
              {orderedAddedLanguages.map((code) => (
                <LanguageDetailsCard
                  key={code}
                  code={code}
                  form={form}
                  readOnly={formReadOnly}
                  onRemove={removeLanguage}
                />
              ))}
            </div>

            {!formReadOnly && availableLanguages.length > 0 ? (
              <AddLanguageSelect
                availableLanguages={availableLanguages}
                addedLanguages={addedLanguages}
                onAdd={addLanguage}
              />
            ) : null}

            <CoverImageField
              form={form}
              imagePreview={image.imagePreview}
              selectedImage={image.selectedImage}
              onOpenDialog={image.openImageDialog}
              onRemove={image.removeImage}
            />

            <ImageUploadDialog
              open={image.isImageDialogOpen}
              isUploading={image.isImageUploading}
              onOpenChange={image.setImageDialogOpen}
              onUpload={image.uploadImage}
            />

            <UnsavedChangesDialog
              open={showNavigationDialog}
              onOpenChange={setShowNavigationDialog}
              onConfirm={confirmNavigation}
              onCancel={cancelNavigation}
            />
          </form>
        </Pecha.Form>
      </div>

      <div className="flex-1 p-4 sm:p-10 flex flex-col min-h-0">
        <h2 className="text-lg font-bold mb-2">Included plans</h2>

        <IncludedPlansPanel
          form={form}
          orderedLanguages={orderedAddedLanguages}
          plans={plans}
          activeLanguage={activePlansLanguage}
          readOnly={formReadOnly}
          groupId={seriesGroupId}
          onSelectLanguage={setActivePlansLanguage}
        />

        <div className="mt-auto pt-8 flex justify-end gap-3">
          <Pecha.Button
            type="button"
            variant="outline"
            className="sm:h-12 sm:px-8"
            onClick={() => navigate("/dashboard")}
          >
            {t("common.button.cancel")}
          </Pecha.Button>

          <Pecha.Button
            type="button"
            variant="default"
            disabled={saveDisabled}
            className="sm:h-12 sm:px-12 font-medium dark:text-white bg-[#A51C21] hover:bg-[#A51C21]/90 disabled:opacity-50"
            onClick={onSubmit}
          >
            {saveLabel}
          </Pecha.Button>
        </div>
      </div>
    </div>
  );
};

export default CreateSeries;
