import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import { useTranslate } from "@tolgee/react";
import { uploadImageToS3 } from "@/components/routes/task/api/taskApi";

type UseSeriesImageParams = {
  isNew: boolean;
  seriesId?: string;
  setImageUrl: (url: string) => void;
};

export type UseSeriesImageReturn = {
  selectedImage: File | null;
  imagePreview: string | null;
  isImageDialogOpen: boolean;
  isImageUploading: boolean;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  openImageDialog: () => void;
  setImageDialogOpen: (open: boolean) => void;
  setImagePreview: (preview: string | null) => void;
  setSelectedImage: (file: File | null) => void;
  uploadImage: (file: File) => Promise<void>;
  removeImage: () => void;
};

export const useSeriesImage = ({
  isNew,
  seriesId,
  setImageUrl,
}: UseSeriesImageParams): UseSeriesImageReturn => {
  const { t } = useTranslate();
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isImageDialogOpen, setImageDialogOpen] = useState(false);
  const [isImageUploading, setIsImageUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadImage = useCallback(
    async (file: File) => {
      setIsImageUploading(true);
      try {
        const { image, key } = await uploadImageToS3(
          file,
          isNew ? "" : seriesId || "",
        );
        setImagePreview(image.original);
        setSelectedImage(file);
        setImageUrl(key);
        setImageDialogOpen(false);
        toast.success(t("studio.series.image.upload_success"));
      } catch (error: unknown) {
        const err = error as { response?: { status?: number } };
        if (err?.response?.status === 413) {
          toast.error(t("studio.series.image.upload_failed"), {
            description: t("studio.series.image.too_large"),
          });
        } else {
          console.error("Image upload failed:", error);
          toast.error(t("studio.series.image.upload_failed"));
        }
      } finally {
        setIsImageUploading(false);
      }
    },
    [isNew, seriesId, setImageUrl, t],
  );

  const removeImage = useCallback(() => {
    setSelectedImage(null);
    setImagePreview(null);
    setImageUrl("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, [setImageUrl]);

  const openImageDialog = useCallback(() => setImageDialogOpen(true), []);

  return {
    selectedImage,
    imagePreview,
    isImageDialogOpen,
    isImageUploading,
    fileInputRef,
    openImageDialog,
    setImageDialogOpen,
    setImagePreview,
    setSelectedImage,
    uploadImage,
    removeImage,
  };
};
