import { useEffect, useState } from "react";
import Dropzone, { ErrorCode, type FileRejection } from "react-dropzone";
import { FiUpload } from "react-icons/fi";
import { toast } from "sonner";
import { Pecha } from "@/components/ui/shadimport";
import { Button } from "@/components/ui/atoms/button";
import type { TimerAudio } from "./api/timerAudiosApi";

// Matches the backend's MAX_AUDIO_FILE_SIZE (pecha_api/config.py) — enforced
// here too so an oversized file is rejected locally instead of failing the
// upload request.
const MAX_AUDIO_FILE_SIZE_BYTES = 50 * 1024 * 1024;
const MAX_IMAGE_FILE_SIZE_BYTES = 5 * 1024 * 1024;

const describeRejection = (
  rejection: FileRejection,
  kind: "audio" | "image",
): string => {
  const isTooLarge = rejection.errors.some(
    (error) => error.code === ErrorCode.FileTooLarge,
  );
  if (isTooLarge) {
    return kind === "audio"
      ? "File is too large — maximum 50 MB."
      : "Image is too large — maximum 5 MB.";
  }
  const isInvalidType = rejection.errors.some(
    (error) => error.code === ErrorCode.FileInvalidType,
  );
  if (isInvalidType) {
    return kind === "audio"
      ? "Unsupported file type — use MP3, M4A, WAV, AAC, or OGG."
      : "Unsupported image type — use PNG, JPG, or WEBP.";
  }
  return rejection.errors[0]?.message ?? "File was rejected.";
};

export interface TimerAudioFormPayload {
  name: string;
  audioFile: File | null;
  imageFile: File | null;
}

interface TimerAudioFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  audio: TimerAudio | null;
  isSubmitting: boolean;
  onSubmit: (payload: TimerAudioFormPayload) => void;
}

const TimerAudioFormDialog = ({
  open,
  onOpenChange,
  audio,
  isSubmitting,
  onSubmit,
}: TimerAudioFormDialogProps) => {
  const isEdit = !!audio;
  const [name, setName] = useState("");
  const [pendingAudio, setPendingAudio] = useState<File | null>(null);
  const [pendingImage, setPendingImage] = useState<File | null>(null);

  useEffect(() => {
    if (!open) return;

    setName(audio?.name ?? "");
    setPendingAudio(null);
    setPendingImage(null);
  }, [open, audio]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedName = name.trim();
    if (!trimmedName) {
      toast.error("Name is required");
      return;
    }

    if (!isEdit && !pendingAudio) {
      toast.error("An audio file is required");
      return;
    }

    onSubmit({
      name: trimmedName,
      audioFile: pendingAudio,
      imageFile: pendingImage,
    });
  };

  const idleLabel = isEdit ? "Save changes" : "Add preset";
  const pendingLabel = isEdit ? "Saving…" : "Adding…";
  const submitLabel = isSubmitting ? pendingLabel : idleLabel;

  return (
    <Pecha.Dialog open={open} onOpenChange={onOpenChange}>
      <Pecha.DialogContent className="max-w-lg">
        <Pecha.DialogHeader>
          <Pecha.DialogTitle>
            {isEdit ? `Edit preset — ${audio.name}` : "Add timer audio preset"}
          </Pecha.DialogTitle>
        </Pecha.DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 pt-2">
          <div className="space-y-2">
            <p className="text-sm font-bold">Name</p>
            <Pecha.Input
              placeholder="e.g. Singing bowl"
              className="h-12 bg-white dark:bg-[#262626]"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <p className="text-sm font-bold">Audio file</p>
            <Dropzone
              accept={{ "audio/*": [".mp3", ".m4a", ".wav", ".aac", ".ogg"] }}
              multiple={false}
              maxSize={MAX_AUDIO_FILE_SIZE_BYTES}
              disabled={isSubmitting}
              onDrop={(files) => setPendingAudio(files[0] ?? null)}
              onDropRejected={(rejections) => {
                const rejection = rejections[0];
                if (rejection) toast.error(describeRejection(rejection, "audio"));
              }}
            >
              {({ getRootProps, getInputProps }) => (
                <div
                  {...getRootProps()}
                  className="cursor-pointer rounded-lg border border-dashed p-6 text-center hover:bg-muted/50"
                >
                  <input {...getInputProps()} />
                  <FiUpload className="mx-auto mb-2 h-5 w-5" />
                  <p className="text-sm font-medium">
                    {pendingAudio
                      ? pendingAudio.name
                      : isEdit
                        ? "Replace audio (optional)"
                        : "Add an audio file"}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    MP3, M4A, WAV, AAC, or OGG; maximum 50 MB.
                  </p>
                </div>
              )}
            </Dropzone>
            {isEdit && !pendingAudio ? (
              <p className="text-xs text-muted-foreground">
                Leave empty to keep the current audio.
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <p className="text-sm font-bold">
              Cover image{" "}
              <span className="font-normal text-muted-foreground">
                (optional)
              </span>
            </p>
            <Dropzone
              accept={{ "image/*": [".png", ".jpg", ".jpeg", ".webp"] }}
              multiple={false}
              maxSize={MAX_IMAGE_FILE_SIZE_BYTES}
              disabled={isSubmitting}
              onDrop={(files) => setPendingImage(files[0] ?? null)}
              onDropRejected={(rejections) => {
                const rejection = rejections[0];
                if (rejection) toast.error(describeRejection(rejection, "image"));
              }}
            >
              {({ getRootProps, getInputProps }) => (
                <div
                  {...getRootProps()}
                  className="cursor-pointer rounded-lg border border-dashed p-6 text-center hover:bg-muted/50"
                >
                  <input {...getInputProps()} />
                  <FiUpload className="mx-auto mb-2 h-5 w-5" />
                  <p className="text-sm font-medium">
                    {pendingImage
                      ? pendingImage.name
                      : isEdit
                        ? "Replace image (optional)"
                        : "Add a cover image"}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    PNG, JPG, or WEBP; maximum 5 MB.
                  </p>
                </div>
              )}
            </Dropzone>
            {isEdit && !pendingImage ? (
              <p className="text-xs text-muted-foreground">
                Leave empty to keep the current image.
              </p>
            ) : null}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="bg-[#A51C21] text-white hover:bg-[#A51C21]/90"
              disabled={isSubmitting}
            >
              {submitLabel}
            </Button>
          </div>
        </form>
      </Pecha.DialogContent>
    </Pecha.Dialog>
  );
};

export default TimerAudioFormDialog;
