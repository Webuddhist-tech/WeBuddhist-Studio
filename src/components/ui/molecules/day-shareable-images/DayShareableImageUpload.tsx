import { useEffect, useState } from "react";
import Dropzone from "react-dropzone";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Pecha } from "@/components/ui/shadimport";
import { FiLoader } from "react-icons/fi";
import { FaTrash } from "react-icons/fa6";
import ImageCropDialog from "../modals/image-upload/image-crop/ImageCropDialog";
import {
  deleteDayShareableImage,
  uploadDayShareableImage,
  type DayShareableImageType,
} from "@/components/routes/task/api/planApi";

interface DayShareableImageUploadProps {
  planId: string;
  dayId: string;
  imageType: DayShareableImageType;
  label: string;
  imageUrl?: string | null;
  isEditable?: boolean;
}

const DayShareableImageUpload = ({
  planId,
  dayId,
  imageType,
  label,
  imageUrl,
  isEditable = true,
}: DayShareableImageUploadProps) => {
  const queryClient = useQueryClient();
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [cropFile, setCropFile] = useState<File | null>(null);

  useEffect(() => {
    setPendingFile(null);
    setPreviewUrl(null);
  }, [dayId, imageUrl]);

  useEffect(() => {
    if (!pendingFile) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(pendingFile);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [pendingFile]);

  const invalidatePlan = () =>
    queryClient.invalidateQueries({ queryKey: ["planDetails", planId] });

  const uploadMutation = useMutation({
    mutationFn: (file: File) => uploadDayShareableImage(dayId, imageType, file),
    onSuccess: () => {
      setPendingFile(null);
      toast.success(`${label} uploaded`);
      invalidatePlan();
    },
    onError: (error: Error) => {
      toast.error(`Failed to upload ${label.toLowerCase()}`, {
        description: error.message,
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteDayShareableImage(dayId, imageType),
    onSuccess: () => {
      setPendingFile(null);
      toast.success(`${label} removed`);
      invalidatePlan();
    },
    onError: (error: Error) => {
      toast.error(`Failed to remove ${label.toLowerCase()}`, {
        description: error.message,
      });
    },
  });

  const isBusy = uploadMutation.isPending || deleteMutation.isPending;
  const displayUrl = previewUrl || imageUrl;

  return (
    <div className="space-y-2 rounded-lg border border-dashed border-gray-300 dark:border-input bg-white dark:bg-[#161616] p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium">{label}</p>
        {imageUrl && isEditable && (
          <Pecha.Button
            type="button"
            variant="outline"
            size="icon"
            className="h-8 w-8 shrink-0"
            disabled={isBusy}
            title={`Remove ${label.toLowerCase()}`}
            onClick={() => deleteMutation.mutate()}
          >
            {deleteMutation.isPending ? (
              <FiLoader className="w-4 h-4 animate-spin" />
            ) : (
              <FaTrash className="w-4 h-4" />
            )}
          </Pecha.Button>
        )}
      </div>

      {displayUrl && (
        <img
          src={displayUrl}
          alt={label}
          className="w-full max-h-40 object-contain rounded border border-gray-200 dark:border-input bg-[#FAFAFA] dark:bg-sidebar-secondary"
        />
      )}

      {isEditable && (
        <>
          <ImageCropDialog
            file={cropFile}
            onCancel={() => setCropFile(null)}
            onDone={(file) => {
              setPendingFile(file);
              setCropFile(null);
            }}
          />
          <Dropzone
            accept={{ "image/*": [] }}
            multiple={false}
            disabled={isBusy}
            onDrop={(files) => {
              if (files[0]) setCropFile(files[0]);
            }}
          >
            {({ getRootProps, getInputProps }) => (
              <div
                {...getRootProps()}
                className="border border-dashed rounded-lg py-2 px-3 text-center text-sm cursor-pointer hover:border-gray-400 dark:hover:border-gray-500 bg-[#FAFAFA] dark:bg-sidebar-secondary"
              >
                <input {...getInputProps()} />
                {pendingFile
                  ? `Selected: ${pendingFile.name}`
                  : imageUrl
                    ? `Drop or click to replace ${label.toLowerCase()}`
                    : `Drop or click to upload ${label.toLowerCase()}`}
              </div>
            )}
          </Dropzone>

          {pendingFile && (
            <div className="flex gap-2">
              <Pecha.Button
                type="button"
                variant="default"
                className="bg-[#A51C21] hover:bg-[#A51C21]/90 flex-1"
                disabled={isBusy}
                onClick={() => uploadMutation.mutate(pendingFile)}
              >
                {uploadMutation.isPending && (
                  <FiLoader className="w-4 h-4 animate-spin mr-1" />
                )}
                {uploadMutation.isPending ? "Uploading..." : "Upload"}
              </Pecha.Button>
              <Pecha.Button
                type="button"
                variant="outline"
                disabled={isBusy}
                onClick={() => setPendingFile(null)}
              >
                Cancel
              </Pecha.Button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default DayShareableImageUpload;
