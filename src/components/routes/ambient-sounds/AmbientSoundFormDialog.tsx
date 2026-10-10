import { useEffect, useState } from "react";
import Dropzone, { ErrorCode, type FileRejection } from "react-dropzone";
import { FiUpload } from "react-icons/fi";
import { toast } from "sonner";
import { useTranslate } from "@tolgee/react";
import { tolgee } from "@/i18n/tolgee";
import { Pecha } from "@/components/ui/shadimport";
import { Button } from "@/components/ui/atoms/button";
import type { AmbientSound } from "./api/ambientSoundsApi";

// Matches the backend's MAX_AUDIO_FILE_SIZE (pecha_api/config.py) — enforced
// here too so an oversized file is rejected locally instead of failing the
// upload request.
const MAX_AUDIO_FILE_SIZE_BYTES = 50 * 1024 * 1024;
// The cover is re-encoded to WebP server side, but the raw upload still has to
// clear the backend's MAX_FILE_SIZE_MB before it gets there.
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
      ? tolgee.t("studio.ambient_sounds.form.error_audio_too_large")
      : tolgee.t("studio.ambient_sounds.form.error_image_too_large");
  }
  const isInvalidType = rejection.errors.some(
    (error) => error.code === ErrorCode.FileInvalidType,
  );
  if (isInvalidType) {
    return kind === "audio"
      ? tolgee.t("studio.ambient_sounds.form.error_audio_type")
      : tolgee.t("studio.ambient_sounds.form.error_image_type");
  }
  return (
    rejection.errors[0]?.message ??
    tolgee.t("studio.ambient_sounds.form.error_rejected")
  );
};

export interface AmbientSoundFormPayload {
  name: string;
  displayOrder: number;
  isDefault: boolean;
  file: File | null;
  imageFile: File | null;
}

interface AmbientSoundFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sound: AmbientSound | null;
  isSubmitting: boolean;
  onSubmit: (payload: AmbientSoundFormPayload) => void;
}

const AmbientSoundFormDialog = ({
  open,
  onOpenChange,
  sound,
  isSubmitting,
  onSubmit,
}: AmbientSoundFormDialogProps) => {
  const { t } = useTranslate();
  const isEdit = !!sound;
  const [name, setName] = useState("");
  const [displayOrder, setDisplayOrder] = useState("0");
  const [isDefault, setIsDefault] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingImage, setPendingImage] = useState<File | null>(null);

  useEffect(() => {
    if (!open) return;

    setName(sound?.name ?? "");
    setDisplayOrder(sound ? String(sound.display_order) : "0");
    setIsDefault(sound?.is_default ?? false);
    setPendingFile(null);
    setPendingImage(null);
  }, [open, sound]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedName = name.trim();
    if (!trimmedName) {
      toast.error(t("studio.ambient_sounds.form.error_name_required"));
      return;
    }

    const parsedOrder = Number(displayOrder.trim());
    if (!Number.isFinite(parsedOrder) || parsedOrder < 0) {
      toast.error(t("studio.ambient_sounds.form.error_order_invalid"));
      return;
    }

    if (!isEdit && !pendingFile) {
      toast.error(t("studio.ambient_sounds.form.error_audio_required"));
      return;
    }

    onSubmit({
      name: trimmedName,
      displayOrder: parsedOrder,
      isDefault,
      file: pendingFile,
      imageFile: pendingImage,
    });
  };

  const idleLabel = isEdit
    ? t("studio.ambient_sounds.form.save_changes")
    : t("studio.ambient_sounds.form.add_sound");
  const pendingLabel = isEdit
    ? t("studio.common.saving")
    : t("studio.ambient_sounds.form.adding");
  const submitLabel = isSubmitting ? pendingLabel : idleLabel;

  return (
    <Pecha.Dialog open={open} onOpenChange={onOpenChange}>
      <Pecha.DialogContent className="max-w-lg">
        <Pecha.DialogHeader>
          <Pecha.DialogTitle>
            {isEdit
              ? t("studio.ambient_sounds.form.edit_title", { name: sound.name })
              : t("studio.ambient_sounds.form.add_title")}
          </Pecha.DialogTitle>
        </Pecha.DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 pt-2">
          <div className="space-y-2">
            <p className="text-sm font-bold">{t("studio.common.name")}</p>
            <Pecha.Input
              placeholder={t("studio.ambient_sounds.form.name_placeholder")}
              className="h-12 bg-white dark:bg-[#262626]"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <p className="text-sm font-bold">
              {t("studio.ambient_sounds.form.order")}
            </p>
            <Pecha.Input
              type="number"
              min={0}
              className="h-12 bg-white dark:bg-[#262626]"
              value={displayOrder}
              onChange={(e) => setDisplayOrder(e.target.value)}
            />
          </div>

          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <Pecha.Checkbox
              checked={isDefault}
              onCheckedChange={(checked) => setIsDefault(checked === true)}
            />
            {t("studio.ambient_sounds.form.default_sound")}
          </label>

          <div className="space-y-2">
            <p className="text-sm font-bold">
              {t("studio.ambient_sounds.form.audio_file")}
            </p>
            <Dropzone
              accept={{ "audio/*": [".mp3", ".m4a", ".wav", ".aac", ".ogg"] }}
              multiple={false}
              maxSize={MAX_AUDIO_FILE_SIZE_BYTES}
              disabled={isSubmitting}
              onDrop={(files) => setPendingFile(files[0] ?? null)}
              onDropRejected={(rejections) => {
                const rejection = rejections[0];
                if (rejection)
                  toast.error(describeRejection(rejection, "audio"));
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
                    {pendingFile
                      ? pendingFile.name
                      : isEdit
                        ? t("studio.ambient_sounds.form.replace_audio")
                        : t("studio.ambient_sounds.form.add_audio_file")}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t("studio.ambient_sounds.form.audio_hint")}
                  </p>
                </div>
              )}
            </Dropzone>
            {isEdit && !pendingFile ? (
              <p className="text-xs text-muted-foreground">
                {t("studio.ambient_sounds.form.keep_current_audio")}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <p className="text-sm font-bold">
              {t("studio.ambient_sounds.form.cover_image")}{" "}
              <span className="font-normal text-muted-foreground">
                {t("studio.ambient_sounds.form.optional_suffix")}
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
                if (rejection)
                  toast.error(describeRejection(rejection, "image"));
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
                      : sound?.image_url
                        ? t("studio.ambient_sounds.form.replace_image")
                        : t("studio.ambient_sounds.form.add_cover_image")}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t("studio.ambient_sounds.form.image_hint")}
                  </p>
                </div>
              )}
            </Dropzone>
            {isEdit && !pendingImage && sound?.image_url ? (
              <p className="text-xs text-muted-foreground">
                {t("studio.ambient_sounds.form.keep_current_image")}
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
              {t("studio.common.cancel")}
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

export default AmbientSoundFormDialog;
