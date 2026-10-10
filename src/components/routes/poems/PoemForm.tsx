import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTranslate } from "@tolgee/react";
import { Pecha } from "@/components/ui/shadimport";
import { Textarea } from "@/components/ui/atoms/textarea";
import { Button } from "@/components/ui/atoms/button";
import { getApiErrorMessage } from "@/lib/apiErrors";
import { useLanguages } from "@/hooks/useLanguages";
import {
  createPoem,
  updatePoem,
  type PoemItem,
  type PoemStatus,
  type CreatePoemPayload,
  type UpdatePoemPayload,
} from "./api/poemApi";
import { uploadImageToS3 } from "@/components/routes/task/api/taskApi";
import ImageContentData from "@/components/ui/molecules/modals/image-upload/ImageContentData";
import { IoMdAdd, IoMdClose } from "react-icons/io";

interface PoemFormProps {
  mode: "create" | "edit";
  initialData?: PoemItem;
  onSuccess: () => void;
  onCancel: () => void;
}

const PoemForm = ({
  mode,
  initialData,
  onSuccess,
  onCancel,
}: PoemFormProps) => {
  const { t } = useTranslate();
  const { languageOptions } = useLanguages();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [authorName, setAuthorName] = useState("");
  const [chapterName, setChapterName] = useState("");
  const [language, setLanguage] = useState("EN");
  const [poemStatus, setPoemStatus] = useState<PoemStatus>("DRAFT");
  const [imageKey, setImageKey] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isImageDialogOpen, setIsImageDialogOpen] = useState(false);
  const [isImageUploading, setIsImageUploading] = useState(false);

  useEffect(() => {
    if (mode === "edit" && initialData) {
      setTitle(initialData.title);
      setContent(initialData.content);
      setAuthorName(initialData.author_name);
      setChapterName(initialData.chapter_name || "");
      setLanguage(initialData.language || "EN");
      setPoemStatus(initialData.status);
      setImageKey(null);
      setImagePreview(initialData.image_url || null);
    } else {
      setTitle("");
      setContent("");
      setAuthorName("");
      setChapterName("");
      setLanguage("EN");
      setPoemStatus("DRAFT");
      setImageKey(null);
      setImagePreview(null);
    }
  }, [mode, initialData]);

  const createMutation = useMutation({
    mutationFn: createPoem,
    onSuccess: () => {
      toast.success(t("studio.poems.toast.created"));
      onSuccess();
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err));
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdatePoemPayload }) =>
      updatePoem(id, payload),
    onSuccess: () => {
      toast.success(t("studio.poems.toast.updated"));
      onSuccess();
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err));
    },
  });

  const handleImageUpload = async (file: File) => {
    setIsImageUploading(true);
    try {
      const { image, key } = await uploadImageToS3(file, "");
      setImagePreview(image.original);
      setImageKey(key);
      setIsImageDialogOpen(false);
      toast.success(t("studio.poems.toast.image_uploaded"));
    } catch (error: any) {
      if (error?.response?.status === 413) {
        toast.error(t("studio.poems.toast.image_upload_failed"), {
          description: t("studio.poems.toast.image_too_large"),
        });
      } else {
        toast.error(t("studio.poems.toast.image_upload_failed"));
      }
    } finally {
      setIsImageUploading(false);
    }
  };

  const handleRemoveImage = () => {
    setImageKey(null);
    setImagePreview(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      toast.error(t("studio.poems.validation.title_required"));
      return;
    }
    if (!content.trim()) {
      toast.error(t("studio.poems.validation.content_required"));
      return;
    }
    if (!authorName.trim()) {
      toast.error(t("studio.poems.validation.author_required"));
      return;
    }

    if (mode === "edit" && initialData) {
      // imageKey: a newly uploaded replacement image.
      // imagePreview is cleared by handleRemoveImage whether the removed
      // image was newly uploaded or already existed on the poem, so an
      // explicit null must be sent only when an existing image was removed
      // (otherwise the field is omitted and the PATCH leaves it untouched).
      let imageKeyValue: string | null | undefined;
      if (imageKey) {
        imageKeyValue = imageKey;
      } else if (!imagePreview && initialData.image_url) {
        imageKeyValue = null;
      }

      const payload: UpdatePoemPayload = {
        title: title.trim(),
        content: content.trim(),
        author_name: authorName.trim(),
        chapter_name: chapterName.trim() || null,
        language,
        status: poemStatus,
        ...(imageKeyValue !== undefined && { image_key: imageKeyValue }),
      };
      updateMutation.mutate({ id: initialData.id, payload });
    } else {
      const payload: CreatePoemPayload = {
        title: title.trim(),
        content: content.trim(),
        author_name: authorName.trim(),
        chapter_name: chapterName.trim() || null,
        language,
        status: poemStatus,
        ...(imageKey && { image_key: imageKey }),
      };
      createMutation.mutate(payload);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="space-y-2">
        <label className="text-sm font-bold">{t("studio.common.title")}</label>
        <Pecha.Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t("studio.poems.form.title_placeholder")}
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-bold">
          {t("studio.poems.form.content_label")}
        </label>
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={t("studio.poems.form.content_placeholder")}
          className="min-h-[160px] resize-none"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-bold">
            {t("studio.poems.table.author")}
          </label>
          <Pecha.Input
            value={authorName}
            onChange={(e) => setAuthorName(e.target.value)}
            placeholder={t("studio.poems.form.author_placeholder")}
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-bold">
            {t("studio.poems.form.chapter_label")}
          </label>
          <Pecha.Input
            value={chapterName}
            onChange={(e) => setChapterName(e.target.value)}
            placeholder={t("studio.poems.form.chapter_placeholder")}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-bold">
            {t("studio.common.language")}
          </label>
          <Pecha.Select value={language} onValueChange={setLanguage}>
            <Pecha.SelectTrigger className="w-full">
              <Pecha.SelectValue />
            </Pecha.SelectTrigger>
            <Pecha.SelectContent>
              {languageOptions.map((lang) => (
                <Pecha.SelectItem key={lang.value} value={lang.value}>
                  {lang.label}
                </Pecha.SelectItem>
              ))}
            </Pecha.SelectContent>
          </Pecha.Select>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-bold">
            {t("studio.common.status")}
          </label>
          <Pecha.Select
            value={poemStatus}
            onValueChange={(v) => setPoemStatus(v as PoemStatus)}
          >
            <Pecha.SelectTrigger className="w-full">
              <Pecha.SelectValue />
            </Pecha.SelectTrigger>
            <Pecha.SelectContent>
              <Pecha.SelectItem value="DRAFT">
                {t("studio.common.draft")}
              </Pecha.SelectItem>
              <Pecha.SelectItem value="PUBLISHED">
                {t("studio.common.published")}
              </Pecha.SelectItem>
            </Pecha.SelectContent>
          </Pecha.Select>
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-bold">
          {t("studio.poems.form.image_label")}
        </label>
        <div className="flex gap-4 items-start">
          {!imagePreview && (
            <button
              type="button"
              onClick={() => setIsImageDialogOpen(true)}
              className="border w-32 h-24 border-dashed border-gray-300 rounded-lg flex items-center justify-center hover:border-gray-400 transition-colors"
              aria-label={t("studio.poems.form.upload_image_aria")}
            >
              <IoMdAdd className="h-8 w-8 text-gray-400" />
            </button>
          )}
          {imagePreview && (
            <div className="relative">
              <img
                src={imagePreview}
                alt={t("studio.poems.form.image_preview_alt")}
                className="w-32 h-24 object-cover rounded-lg border"
              />
              <button
                type="button"
                onClick={handleRemoveImage}
                className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-1"
                aria-label={t("studio.poems.form.remove_image_aria")}
              >
                <IoMdClose className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isPending}
        >
          {t("studio.common.cancel")}
        </Button>
        <Button
          type="submit"
          className="bg-[#A51C21] text-white hover:bg-[#A51C21]/90"
          disabled={isPending}
        >
          {isPending
            ? mode === "edit"
              ? t("studio.poems.form.updating")
              : t("studio.common.creating")
            : mode === "edit"
              ? t("studio.common.update")
              : t("studio.common.create")}
        </Button>
      </div>

      <Pecha.Dialog
        open={isImageDialogOpen}
        onOpenChange={setIsImageDialogOpen}
      >
        <Pecha.DialogContent showCloseButton>
          <Pecha.DialogHeader>
            <Pecha.DialogTitle>
              {t("studio.poems.form.upload_crop_image")}
            </Pecha.DialogTitle>
          </Pecha.DialogHeader>
          <ImageContentData
            onUpload={handleImageUpload}
            isLoading={isImageUploading}
          />
        </Pecha.DialogContent>
      </Pecha.Dialog>
    </form>
  );
};

export default PoemForm;
