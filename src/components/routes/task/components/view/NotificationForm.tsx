import { useState, useEffect } from "react";
import { Pecha } from "@/components/ui/shadimport";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  getNotification,
  createNotification,
  updateNotification,
  deleteNotification,
} from "../../api/notificationApi";
import { uploadImageToS3 } from "../../api/taskApi";
import { MdOutlineImage } from "react-icons/md";

const notificationSchema = z.object({
  title: z.string().max(40, "Title must be 40 characters or less"),
  body: z.string().max(180, "Body must be 180 characters or less"),
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
  const [imageType, setImageType] = useState<"PLAN" | "CUSTOM" | null>(null);
  const [customImageUrl, setCustomImageUrl] = useState<string | null>(null);
  const [customImagePreview, setCustomImagePreview] = useState<string | null>(
    null,
  );
  const [uploadingImage, setUploadingImage] = useState(false);

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
          ? "Notification updated successfully!"
          : "Notification created successfully!",
      );
      queryClient.invalidateQueries({ queryKey: ["notification", dayId] });
    },
    onError: (error: Error) => {
      toast.error("Failed to save notification", {
        description: error?.message || "Something went wrong",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteNotification(dayId),
    onSuccess: () => {
      toast.success("Notification deleted successfully!");
      form.reset();
      setImageType(null);
      setCustomImageUrl(null);
      setCustomImagePreview(null);
      queryClient.invalidateQueries({ queryKey: ["notification", dayId] });
    },
    onError: (error: Error) => {
      toast.error("Failed to delete notification", {
        description: error?.message || "Something went wrong",
      });
    },
  });

  const handleImageUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const fileSizeMB = file.size / (1024 * 1024);
    if (fileSizeMB > 5) {
      toast.error(
        "File size exceeds 5MB limit. Please select a smaller image.",
      );
      return;
    }

    const validTypes = ["image/png", "image/jpg", "image/jpeg", "image/webp"];
    if (!validTypes.includes(file.type)) {
      toast.error("Invalid file type. Please upload PNG, JPG, JPEG, or WebP.");
      return;
    }

    try {
      setUploadingImage(true);
      const { image, key } = await uploadImageToS3(file, planId);
      setCustomImageUrl(key);
      setCustomImagePreview(image.original);
      setImageType("CUSTOM");
      toast.success("Image uploaded successfully!");
    } catch {
      toast.error("Failed to upload image");
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
      <div className="w-full my-4 h-[calc(100vh-40px)] bg-[#F5F5F5] dark:bg-[#181818] rounded-l-2xl border border-dashed flex items-center justify-center">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  return (
    <div className="w-full my-4 h-[calc(100vh-40px)] bg-[#F5F5F5] dark:bg-[#181818] rounded-l-2xl border border-dashed overflow-y-auto">
      <div className="p-4">
        <Pecha.Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <Pecha.FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <Pecha.FormItem>
                  <Pecha.FormLabel>Title</Pecha.FormLabel>
                  <Pecha.FormControl>
                    <Pecha.Input
                      {...field}
                      placeholder="What's the day about?"
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
                  <Pecha.FormLabel>Body</Pecha.FormLabel>
                  <Pecha.FormControl>
                    <Pecha.Textarea
                      {...field}
                      placeholder="Why open the app today?"
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
              <Pecha.FormLabel>Image</Pecha.FormLabel>

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
                          alt="Custom"
                          className="w-full h-full object-cover rounded"
                        />
                      ) : (
                        <MdOutlineImage className="w-6 h-6 text-gray-400" />
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">Custom</p>
                      <p className="text-xs text-gray-500">
                        Up to 5 MB. PNG, JPG, JPEG or WebP
                      </p>
                      <p className="text-xs text-gray-500">
                        Best in 3:4 ratio (cropping available)
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
                          {uploadingImage ? "Uploading..." : "Upload"}
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
                          alt="Plan cover"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <MdOutlineImage className="w-6 h-6 text-gray-400" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium">Use plan cover</p>
                    </div>
                  </label>
                </div>

                <div className="flex items-center space-x-3 border border-gray-300 dark:border-input rounded-md p-4">
                  <Pecha.RadioGroupItem value="" id="no-image" />
                  <label htmlFor="no-image" className="flex-1 cursor-pointer">
                    <p className="font-medium">No image</p>
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
                Clear
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
                  ? "Saving..."
                  : existingNotification
                    ? "Update"
                    : "Save"}
              </Pecha.Button>
            </div>
          </form>
        </Pecha.Form>
      </div>
    </div>
  );
};
