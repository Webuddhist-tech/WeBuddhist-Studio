import type { UseFormReturn } from "react-hook-form";
import { IoMdAdd, IoMdClose } from "react-icons/io";
import { IoInformationCircleOutline } from "react-icons/io5";
import { useTranslate } from "@tolgee/react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/atoms/tooltip";
import type { SeriesFormData } from "@/schema/SeriesSchema";

type CoverImageFieldProps = {
  form: UseFormReturn<SeriesFormData>;
  imagePreview: string | null;
  selectedImage: File | null;
  onOpenDialog: () => void;
  onRemove: () => void;
};

const CoverImageField = ({
  form,
  imagePreview,
  selectedImage,
  onOpenDialog,
  onRemove,
}: CoverImageFieldProps) => {
  const { t } = useTranslate();

  return (
    <div className="space-y-2">
      <div className="flex flex-col sm:flex-row gap-2">
        <h3 className="text-sm font-bold">
          {t("studio.dashboard.cover_image")}
        </h3>
        <div className="hidden sm:block">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="text-muted-foreground hover:text-foreground"
                >
                  <IoInformationCircleOutline className="w-4 h-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent
                side="right"
                className="bg-black text-white text-xs rounded-md px-3 py-2 shadow-md max-w-xs"
              >
                <p className="whitespace-pre-line">
                  {t("studio.plan.cover_image.constraints")}
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <p className="text-sm sm:hidden text-muted-foreground whitespace-pre-line">
          {t("studio.plan.cover_image.constraints")}
        </p>
      </div>
      <div className="flex gap-4 mt-2 items-start">
        {!imagePreview && (
          <button
            type="button"
            onClick={onOpenDialog}
            className="border w-56 h-40 border-dashed border-gray-300 dark:border-gray-600 rounded-lg flex items-center justify-center hover:border-gray-400 transition-colors cursor-pointer focus:outline-none bg-#C7C7C7 dark:bg-[#262626]"
            aria-label={t("studio.series.form.upload_cover_aria")}
          >
            <IoMdAdd className="h-10 w-10 text-gray-400" />
          </button>
        )}
        {imagePreview && (
          <div className="relative">
            <img
              src={imagePreview}
              alt={t("studio.series.form.cover_preview_alt")}
              className="w-48 h-48 object-cover rounded-lg border"
            />
            <div className="flex items-center justify-between absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent rounded-b-lg p-2">
              {selectedImage && (
                <p className="text-xs text-white truncate max-w-32">
                  {selectedImage.name}
                </p>
              )}
              <button
                aria-label={t("studio.series.form.remove_image_aria")}
                type="button"
                onClick={onRemove}
                className="text-white cursor-pointer rounded-full p-1 transition-colors ml-auto"
                data-testid="image-remove"
              >
                <IoMdClose className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
      <input type="hidden" {...form.register("image_url")} />
      {form.formState.errors.image_url && (
        <p className="text-sm text-destructive">
          {t(String(form.formState.errors.image_url.message))}
        </p>
      )}
    </div>
  );
};

export default CoverImageField;
