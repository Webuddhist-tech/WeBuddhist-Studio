import { Pecha } from "@/components/ui/shadimport";
import { useTranslate } from "@tolgee/react";
import ImageContentData from "@/components/ui/molecules/modals/image-upload/ImageContentData";

type ImageUploadDialogProps = {
  open: boolean;
  isUploading: boolean;
  onOpenChange: (open: boolean) => void;
  onUpload: (file: File) => void;
};

const ImageUploadDialog = ({
  open,
  isUploading,
  onOpenChange,
  onUpload,
}: ImageUploadDialogProps) => {
  const { t } = useTranslate();
  return (
    <Pecha.Dialog open={open} onOpenChange={onOpenChange}>
      <Pecha.DialogContent showCloseButton={true}>
        <Pecha.DialogHeader>
          <Pecha.DialogTitle>
            {t("studio.series.form.upload_crop_image")}
          </Pecha.DialogTitle>
        </Pecha.DialogHeader>
        <ImageContentData onUpload={onUpload} isLoading={isUploading} />
      </Pecha.DialogContent>
    </Pecha.Dialog>
  );
};

export default ImageUploadDialog;
