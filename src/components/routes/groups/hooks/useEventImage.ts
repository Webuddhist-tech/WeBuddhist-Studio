import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import { tolgee } from "@/i18n/tolgee";
import { uploadEventImage } from "@/components/routes/groups/api/eventsApi";

type UseEventImageParams = {
  setImageUrl: (url: string) => void;
};

export type UseEventImageReturn = {
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

export const useEventImage = ({
  setImageUrl,
}: UseEventImageParams): UseEventImageReturn => {
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isImageDialogOpen, setImageDialogOpen] = useState(false);
  const [isImageUploading, setIsImageUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadImage = useCallback(
    async (file: File) => {
      setIsImageUploading(true);
      try {
        const key = await uploadEventImage(file);
        setImagePreview(URL.createObjectURL(file));
        setSelectedImage(file);
        setImageUrl(key);
        setImageDialogOpen(false);
        toast.success(tolgee.t("studio.groups.shared.image_uploaded"));
      } catch (error: unknown) {
        const err = error as { response?: { status?: number } };
        if (err?.response?.status === 413) {
          toast.error(tolgee.t("studio.groups.shared.image_upload_error"), {
            description: tolgee.t("studio.groups.shared.image_too_large"),
          });
        } else {
          console.error("Image upload failed:", error);
          toast.error(tolgee.t("studio.groups.shared.image_upload_error"));
        }
      } finally {
        setIsImageUploading(false);
      }
    },
    [setImageUrl],
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
