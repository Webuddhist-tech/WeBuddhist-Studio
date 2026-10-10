import { useState, useEffect } from "react";
import { Pecha } from "@/components/ui/shadimport";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTranslate } from "@tolgee/react";
import {
  getNotification,
  createNotification,
  updateNotification,
  deleteNotification,
} from "../../api/notificationApi";
import { uploadImageToS3 } from "../../api/taskApi";
import { MdOutlineImage } from "react-icons/md";
import ImageCropDialog from "@/components/ui/molecules/modals/image-upload/image-crop/ImageCropDialog";

const notificationSchema = z.object({
  title: z.string().max(40, "studio.task.notification.title_max"),
  body: z.string().max(180, "studio.task.notification.body_max"),
});

type NotificationFormData = z.infer<typeof notificationSchema>;

interface NotificationFormProps {
  dayId: string;
  planId: string;
  planCoverImage?: string | null;
  isEditable?: boolean;
}

export const NotificationForm = ({
  dayId,
  planId,
  planCoverImage,
  isEditable = true,
}: NotificationFormProps) => {
  const queryClient = useQueryClient();
  const { t } = useTranslate();
  const [imageType, setImageType] = useState<"PLAN" | "CUSTOM" | null>(null);
  const [customImageUrl, setCustomImageUrl] = useState<string | null>(null);
  const [customImagePreview, setCustomImagePreview] = useState<string | null>(
    null,
  );
  const [uploadingImage, setUploadingImage] = useState(false);
  const [cropFile, setCropFile] = useState<File | null>(null);

  const form = useForm<NotificationFormData>({
    resolver: zodResolver(notificationSchema),
    defaultValues: {
      title: "",
      body: "",
    },
  });

  const { data: existingNotification, isLoading } = useQuery({
    queryKey: ["notification", dayId],
    queryFn: () => getNotification(dayId),
    enabled: !!dayId,
  });

  useEffect(() => {
    if (existingNotification) {
      form.setValue("title", existingNotification.title || "");
      form.setValue("body", existingNotification.body || "");
      setImageType(existingNotification.image_type);
      if (existingNotification.image_type === "CUSTOM") {
        setCustomImageUrl(existingNotification.image_url);
        setCustomImagePreview(existingNotification.image_url);
      }
    }
  }, [existingNotification, form]);

  const saveMutation = useMutation({
    mutationFn: async (data: NotificationFormData) => {
      let imageUrl = null;
      if (imageType === "CUSTOM") {
        imageUrl = customImageUrl;
      } else if (imageType === "PLAN") {
        imageUrl = planCoverImage || null;
      }

      const payload = {
        title: data.title,
        body: data.body,
        image_type: imageType,
        image_url: imageUrl,
      };

      if (existingNotification) {
        return updateNotification(dayId, payload);
      } else {
        return createNotification(dayId, payload);
      }
    },
    onSuccess: () => {
      toast.success(
        existingNotification
          ? t("studio.task.notification.updated")
          : t("studio.task.notification.created"),
      );
      queryClient.invalidateQueries({ queryKey: ["notification", dayId] });
    },
    onError: (error: Error) => {
      toast.error(t("studio.task.notification.save_failed"), {
        description: error?.message || t("studio.common.something_went_wrong"),
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteNotification(dayId),
    onSuccess: () => {
      toast.success(t("studio.task.notification.deleted"));
      form.reset();
      setImageType(null);
      setCustomImageUrl(null);
      setCustomImagePreview(null);
      queryClient.invalidateQueries({ queryKey: ["notification", dayId] });
    },
    onError: (error: Error) => {
      toast.error(t("studio.task.notification.delete_failed"), {
        description: error?.message || t("studio.common.something_went_wrong"),
      });
    },
  });

  const handleImageUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    const fileSizeMB = file.size / (1024 * 1024);
    if (fileSizeMB > 5) {
      toast.error(t("studio.task.notification.image_too_large"));
      return;
    }

    const validTypes = ["image/png", "image/jpg", "image/jpeg", "image/webp"];
    if (!validTypes.includes(file.type)) {
      toast.error(t("studio.task.notification.invalid_file_type"));
      return;
    }

    setCropFile(file);
  };

  const uploadCroppedImage = async (file: File) => {
    setCropFile(null);
    if (file.size > 5 * 1024 * 1024) {
      toast.error(t("studio.task.notification.image_too_large"));
      return;
    }
    try {
      setUploadingImage(true);
      const { image, key } = await uploadImageToS3(file, planId);
      setCustomImageUrl(key);
      setCustomImagePreview(image.original);
      setImageType("CUSTOM");
      toast.success(t("studio.task.form.image_uploaded"));
    } catch {
      toast.error(t("studio.task.form.image_upload_failed"));
    } finally {
      setUploadingImage(false);
    }
  };

  const handleClear = () => {
    if (existingNotification) {
      deleteMutation.mutate();
    } else {
      form.reset();
      setImageType(null);
      setCustomImageUrl(null);
      setCustomImagePreview(null);
    }
  };

  const onSubmit = (data: NotificationFormData) => {
    saveMutation.mutate(data);
  };

  const titleValue = form.watch("title");
  const bodyValue = form.watch("body");

  if (isLoading) {
    return (
      <div className="w-full my-4 h-[calc(100vh-40px)] bg-[#F5F5F5] dark:bg-[#181818] rounded-l-2xl border border-dashed flex items-center justify-center max-md:my-0 max-md:h-full max-md:rounded-none max-md:border-0">
        <p className="text-gray-500">{t("studio.common.loading")}</p>
      </div>
    );
  }

  return (
    <div className="w-full my-4 h-[calc(100vh-40px)] bg-[#F5F5F5] dark:bg-[#181818] rounded-l-2xl border border-dashed overflow-y-auto max-md:my-0 max-md:h-full max-md:rounded-none max-md:border-0">
      <div className="p-4">
        <Pecha.Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <Pecha.FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <Pecha.FormItem>
                  <Pecha.FormLabel>{t("studio.common.title")}</Pecha.FormLabel>
                  <Pecha.FormControl>
                    <Pecha.Input
                      {...field}
                      placeholder={t(
                        "studio.task.notification.title_placeholder",
                      )}
                      disabled={!isEditable}
                      maxLength={40}
                    />
                  </Pecha.FormControl>
                  <div className="flex justify-end text-xs text-gray-500">
                    {titleValue.length} / 40
                  </div>
                  <Pecha.FormMessage />
                </Pecha.FormItem>
              )}
            />

            <Pecha.FormField
              control={form.control}
              name="body"
              render={({ field }) => (
                <Pecha.FormItem>
                  <Pecha.FormLabel>
                    {t("studio.task.notification.body")}
                  </Pecha.FormLabel>
                  <Pecha.FormControl>
                    <Pecha.Textarea
                      {...field}
                      placeholder={t(
                        "studio.task.notification.body_placeholder",
                      )}
                      disabled={!isEditable}
                      maxLength={180}
                      rows={4}
                    />
                  </Pecha.FormControl>
                  <div className="flex justify-end text-xs text-gray-500">
                    {bodyValue.length} / 180
                  </div>
                  <Pecha.FormMessage />
                </Pecha.FormItem>
              )}
            />

            <div className="space-y-3">
              <Pecha.FormLabel>{t("studio.common.image")}</Pecha.FormLabel>
              <ImageCropDialog
                file={cropFile}
                onCancel={() => setCropFile(null)}
                onDone={uploadCroppedImage}
              />

              <Pecha.RadioGroup
                value={imageType || ""}
                onValueChange={(value) =>
                  setImageType(
                    value === "" ? null : (value as "PLAN" | "CUSTOM"),
                  )
                }
                disabled={!isEditable}
              >
                <div className="flex items-center space-x-3 border border-gray-300 dark:border-input rounded-md p-4">
                  <Pecha.RadioGroupItem value="CUSTOM" id="custom" />
                  <label
                    htmlFor="custom"
                    className="flex-1 cursor-pointer flex items-center gap-3"
                  >
                    <div className="flex items-center justify-center w-12 h-12 border-2 border-dashed border-gray-300 dark:border-input rounded">
                      {customImagePreview ? (
                        <img
                          src={customImagePreview}
                          alt={t("studio.task.notification.custom")}
                          className="w-full h-full object-cover rounded"
                        />
                      ) : (
                        <MdOutlineImage className="w-6 h-6 text-gray-400" />
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">
                        {t("studio.task.notification.custom")}
                      </p>
                      <p className="text-xs text-gray-500">
                        {t("studio.task.notification.image_constraints")}
                      </p>
                      <p className="text-xs text-gray-500">
                        {t("studio.task.notification.image_ratio")}
                      </p>
                    </div>
                    {isEditable && (
                      <label className="cursor-pointer">
                        <input
                          type="file"
                          accept="image/png,image/jpg,image/jpeg,image/webp"
                          onChange={handleImageUpload}
                          className="hidden"
                          disabled={uploadingImage}
                        />
                        <Pecha.Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={uploadingImage}
                          onClick={(e) => {
                            e.preventDefault();
                            e.currentTarget.previousElementSibling?.dispatchEvent(
                              new MouseEvent("click", { bubbles: true }),
                            );
                          }}
                        >
                          {uploadingImage
                            ? t("studio.common.uploading")
                            : t("studio.common.upload")}
                        </Pecha.Button>
                      </label>
                    )}
                  </label>
                </div>

                <div className="flex items-center space-x-3 border border-gray-300 dark:border-input rounded-md p-4">
                  <Pecha.RadioGroupItem value="PLAN" id="plan" />
                  <label
                    htmlFor="plan"
                    className="flex-1 cursor-pointer flex items-center gap-3"
                  >
                    <div className="flex items-center justify-center w-12 h-12 border border-gray-300 dark:border-input rounded overflow-hidden bg-gray-100 dark:bg-gray-800">
                      {planCoverImage ? (
                        <img
                          src={planCoverImage}
                          alt={t("studio.task.notification.plan_cover_alt")}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <MdOutlineImage className="w-6 h-6 text-gray-400" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium">
                        {t("studio.task.notification.use_plan_cover")}
                      </p>
                    </div>
                  </label>
                </div>

                <div className="flex items-center space-x-3 border border-gray-300 dark:border-input rounded-md p-4">
                  <Pecha.RadioGroupItem value="" id="no-image" />
                  <label htmlFor="no-image" className="flex-1 cursor-pointer">
                    <p className="font-medium">
                      {t("studio.task.notification.no_image")}
                    </p>
                  </label>
                </div>
              </Pecha.RadioGroup>
            </div>

            <div className="flex gap-3 pt-4">
              <Pecha.Button
                type="button"
                variant="outline"
                onClick={handleClear}
                disabled={
                  !isEditable ||
                  saveMutation.isPending ||
                  deleteMutation.isPending
                }
              >
                {t("studio.common.clear")}
              </Pecha.Button>

              <Pecha.Button
                type="submit"
                variant="destructive"
                disabled={
                  !isEditable ||
                  saveMutation.isPending ||
                  deleteMutation.isPending
                }
              >
                {saveMutation.isPending
                  ? t("studio.common.saving")
                  : existingNotification
                    ? t("studio.common.update")
                    : t("studio.common.save")}
              </Pecha.Button>
            </div>
          </form>
        </Pecha.Form>
      </div>
    </div>
  );
};
