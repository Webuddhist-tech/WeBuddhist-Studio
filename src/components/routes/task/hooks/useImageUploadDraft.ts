import { useEffect, useRef, useState } from "react";

export interface UseImageUploadDraftOptions {
  onUpload?: (file: File) => Promise<void> | void;
  /** Invoked after the user finishes cropping (e.g. parent modal tracking). */
  onCropComplete?: (file: File) => void;
  /** Parent-controlled busy state (e.g. modal submitting). */
  isExternallyBusy?: boolean;
}

/** Cropped output is JPEG, so make the file name match. */
export const toJpegName = (name?: string) =>
  `${(name || "cropped").replace(/\.[^./\\]+$/, "")}.jpg`;

export function useImageUploadDraft({
  onUpload,
  onCropComplete,
  isExternallyBusy = false,
}: UseImageUploadDraftOptions = {}) {
  const [selectedFile, setSelectedFileState] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isCropOpen, setIsCropOpen] = useState(false);
  const [isCropped, setIsCropped] = useState(false);

  // Picking a new file opens the cropper right away.
  const setSelectedFile = (file: File | null) => {
    setSelectedFileState(file);
    setIsCropOpen(!!file);
    setIsCropped(false);
  };
  const [isUploading, setIsUploading] = useState(false);
  const uploadLockRef = useRef(false);

  useEffect(() => {
    if (!selectedFile) {
      setPreviewUrl(null);
      return;
    }

    const url = URL.createObjectURL(selectedFile);
    setPreviewUrl(url);

    return () => URL.revokeObjectURL(url);
  }, [selectedFile]);

  const handleCropComplete = (croppedBlob: Blob) => {
    const croppedFile = new File(
      [croppedBlob],
      toJpegName(selectedFile?.name),
      { type: "image/jpeg" },
    );
    setSelectedFileState(croppedFile);
    setIsCropped(true);
    setIsCropOpen(false);
    onCropComplete?.(croppedFile);
  };

  const handleUpload = async () => {
    if (!selectedFile || !onUpload) return;

    if (uploadLockRef.current) return;
    uploadLockRef.current = true;

    try {
      setIsUploading(true);
      await onUpload(selectedFile);
      setSelectedFile(null);
      setPreviewUrl(null);
      setIsCropOpen(false);
    } catch (error) {
      console.error("Error uploading image:", error);
    } finally {
      setIsUploading(false);
      uploadLockRef.current = false;
    }
  };

  const uploadUiBusy = isUploading || isExternallyBusy;

  return {
    selectedFile,
    setSelectedFile,
    previewUrl,
    isCropOpen,
    setIsCropOpen,
    isCropped,
    uploadUiBusy,
    handleCropComplete,
    handleUpload,
  };
}
