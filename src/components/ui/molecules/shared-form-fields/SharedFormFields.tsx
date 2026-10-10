import { IoMdAdd, IoMdClose } from "react-icons/io";
import type { Control } from "react-hook-form";
import { useTranslate } from "@tolgee/react";
import { Textarea } from "@/components/ui/atoms/textarea";
import { Pecha } from "@/components/ui/shadimport";
import TagInput from "@/components/ui/molecules/tag-input/TagInput";

type TitleFieldProps = {
  control: Control<any>;
  label: string;
  placeholder: string;
};

export const TitleField = ({
  control,
  label,
  placeholder,
}: TitleFieldProps) => {
  return (
    <Pecha.FormField
      control={control}
      name="title"
      render={({ field }) => (
        <Pecha.FormItem>
          <Pecha.FormLabel className="text-sm font-bold">
            {label}
          </Pecha.FormLabel>
          <Pecha.FormControl>
            <Pecha.Input
              placeholder={placeholder}
              className="h-12 text-base bg-white"
              {...field}
            />
          </Pecha.FormControl>
          <Pecha.FormMessage />
        </Pecha.FormItem>
      )}
    />
  );
};

type DescriptionFieldProps = {
  control: Control<any>;
  label: string;
  placeholder: string;
};

export const DescriptionField = ({
  control,
  label,
  placeholder,
}: DescriptionFieldProps) => {
  return (
    <Pecha.FormField
      control={control}
      name="description"
      render={({ field }) => (
        <Pecha.FormItem>
          <Pecha.FormLabel className="text-sm font-bold">
            {label}
          </Pecha.FormLabel>
          <Pecha.FormControl>
            <Textarea
              placeholder={placeholder}
              className="min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-base  placeholder:text-muted-foreground focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 resize-none"
              {...field}
            />
          </Pecha.FormControl>
          <Pecha.FormMessage />
        </Pecha.FormItem>
      )}
    />
  );
};

type CoverImageFieldProps = {
  control: Control<any>;
  heading: string;
  description: string;
  imagePreview: string | null;
  selectedImage: File | null;
  onOpenUploadDialog: () => void;
  onRemoveImage: () => void;
};

export const CoverImageField = ({
  control,
  heading,
  description,
  imagePreview,
  selectedImage,
  onOpenUploadDialog,
  onRemoveImage,
}: CoverImageFieldProps) => {
  const { t } = useTranslate();
  return (
    <Pecha.FormField
      control={control}
      name="image_url"
      render={({ field }) => (
        <Pecha.FormItem>
          <div>
            <h3 className="text-sm font-bold">{heading}</h3>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
          <Pecha.FormControl>
            <div className="flex gap-4 mt-4 items-start">
              {!imagePreview && (
                <button
                  type="button"
                  onClick={onOpenUploadDialog}
                  className="border w-48 h-32 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-gray-400 transition-colors cursor-pointer focus:outline-none"
                  aria-label={t(
                    "studio.molecules.form_fields.upload_cover_image",
                  )}
                >
                  <IoMdAdd className="mx-auto h-8 w-8 text-gray-400 mb-2" />
                </button>
              )}

              {imagePreview && (
                <div className="relative">
                  <img
                    src={imagePreview}
                    alt={t("studio.molecules.form_fields.cover_preview_alt")}
                    className="w-48 h-32 object-cover rounded-lg border"
                  />
                  <div className="flex items-center justify-between absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent rounded-b-lg p-2">
                    {selectedImage && (
                      <p className="text-xs text-white truncate max-w-32">
                        {selectedImage.name}
                      </p>
                    )}
                    <button
                      aria-label={t(
                        "studio.molecules.form_fields.remove_image",
                      )}
                      type="button"
                      onClick={onRemoveImage}
                      className=" text-white cursor-pointer rounded-full p-1 transition-colors ml-2"
                      data-testid="image-remove"
                    >
                      <IoMdClose className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}
              <input type="hidden" {...field} />
            </div>
          </Pecha.FormControl>
          <Pecha.FormMessage />
        </Pecha.FormItem>
      )}
    />
  );
};

type TagsFieldProps = {
  control: Control<any>;
};

export const TagsField = ({ control }: TagsFieldProps) => {
  return (
    <Pecha.FormField
      control={control}
      name="tags"
      render={({ field }) => (
        <Pecha.FormItem>
          <Pecha.FormControl>
            <TagInput value={field.value} onChange={field.onChange} />
          </Pecha.FormControl>
          <Pecha.FormMessage />
        </Pecha.FormItem>
      )}
    />
  );
};
