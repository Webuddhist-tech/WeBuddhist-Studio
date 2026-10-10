import { useEffect, useState } from "react";
import { useTranslate } from "@tolgee/react";
import { Pecha } from "@/components/ui/shadimport";
import { toJpegName } from "@/components/routes/task/hooks/useImageUploadDraft";
import ImageCropContent from "./ImageCropModal";

interface ImageCropDialogProps {
  file: File | null;
  /** Called with the cropped file, or the original when the user skips. */
  onDone: (file: File) => void;
  onCancel: () => void;
}

const ImageCropDialog = ({ file, onDone, onCancel }: ImageCropDialogProps) => {
  const { t } = useTranslate();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  return (
    <Pecha.Dialog
      open={!!file}
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}
    >
      <Pecha.DialogContent
        showCloseButton={true}
        className="max-h-[90vh] overflow-y-auto"
      >
        <Pecha.DialogHeader>
          <Pecha.DialogTitle>
            {t("studio.modals.image_crop.title")}
          </Pecha.DialogTitle>
        </Pecha.DialogHeader>
        {file && previewUrl && (
          <ImageCropContent
            imageSrc={previewUrl}
            onBack={() => onDone(file)}
            onCropComplete={(blob) =>
              onDone(
                new File([blob], toJpegName(file.name), { type: "image/jpeg" }),
              )
            }
          />
        )}
      </Pecha.DialogContent>
    </Pecha.Dialog>
  );
};

export default ImageCropDialog;
