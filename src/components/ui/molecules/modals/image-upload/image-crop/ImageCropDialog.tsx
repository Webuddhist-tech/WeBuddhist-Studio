import { useEffect, useState } from "react";
import { Pecha } from "@/components/ui/shadimport";
import ImageCropContent from "./ImageCropModal";

interface ImageCropDialogProps {
  file: File | null;
  /** Called with the cropped file, or the original when the user skips. */
  onDone: (file: File) => void;
  onCancel: () => void;
}

const ImageCropDialog = ({ file, onDone, onCancel }: ImageCropDialogProps) => {
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
      <Pecha.DialogContent showCloseButton={true}>
        <Pecha.DialogHeader>
          <Pecha.DialogTitle>Crop image</Pecha.DialogTitle>
        </Pecha.DialogHeader>
        {file && previewUrl && (
          <ImageCropContent
            imageSrc={previewUrl}
            onBack={() => onDone(file)}
            onCropComplete={(blob) =>
              onDone(new File([blob], file.name, { type: "image/jpeg" }))
            }
          />
        )}
      </Pecha.DialogContent>
    </Pecha.Dialog>
  );
};

export default ImageCropDialog;
