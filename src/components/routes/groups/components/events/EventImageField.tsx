import { useTranslate } from "@tolgee/react";
import { IoMdAdd, IoMdClose } from "react-icons/io";
import { Pecha } from "@/components/ui/shadimport";
import ImageContentData from "@/components/ui/molecules/modals/image-upload/ImageContentData";

type EventImageFieldProps = {
  imagePreview: string | null;
  selectedImage: File | null;
  isDialogOpen: boolean;
  isUploading: boolean;
  readOnly: boolean;
  onOpenDialog: () => void;
  onDialogOpenChange: (open: boolean) => void;
  onUpload: (file: File) => void;
  onRemove: () => void;
};

const EventImageField = ({
  imagePreview,
  selectedImage,
  isDialogOpen,
  isUploading,
  readOnly,
  onOpenDialog,
  onDialogOpenChange,
  onUpload,
  onRemove,
}: EventImageFieldProps) => {
  const { t } = useTranslate();
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-bold">
        {t("studio.groups.events.image.heading")}
      </h3>
      <div className="mt-2 flex items-start gap-4">
        {!imagePreview ? (
          <button
            type="button"
            onClick={onOpenDialog}
            disabled={readOnly}
            className="flex h-40 w-56 items-center justify-center rounded-lg border border-dashed border-gray-300 bg-[#C7C7C7] transition-colors hover:border-gray-400 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:bg-[#262626]"
            aria-label={t("studio.groups.events.image.upload_aria")}
          >
            <IoMdAdd className="h-10 w-10 text-gray-400" />
          </button>
        ) : (
          <div className="relative">
            <img
              src={imagePreview}
              alt={t("studio.groups.events.image.preview_alt")}
              className="h-48 w-48 rounded-lg border object-cover"
            />
            {!readOnly ? (
              <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between rounded-b-lg bg-gradient-to-t from-black/60 to-transparent p-2">
                {selectedImage ? (
                  <p className="max-w-32 truncate text-xs text-white">
                    {selectedImage.name}
                  </p>
                ) : null}
                <button
                  aria-label={t("studio.groups.events.image.remove_aria")}
                  type="button"
                  onClick={onRemove}
                  className="ml-auto cursor-pointer rounded-full p-1 text-white transition-colors"
                  data-testid="event-image-remove"
                >
                  <IoMdClose className="h-4 w-4" />
                </button>
              </div>
            ) : null}
          </div>
        )}
      </div>

      <Pecha.Dialog open={isDialogOpen} onOpenChange={onDialogOpenChange}>
        <Pecha.DialogContent showCloseButton={true}>
          <Pecha.DialogHeader>
            <Pecha.DialogTitle>
              {t("studio.groups.events.image.dialog_title")}
            </Pecha.DialogTitle>
          </Pecha.DialogHeader>
          <ImageContentData onUpload={onUpload} isLoading={isUploading} />
        </Pecha.DialogContent>
      </Pecha.Dialog>
    </div>
  );
};

export default EventImageField;
