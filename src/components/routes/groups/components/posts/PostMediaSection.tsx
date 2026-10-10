import { useState } from "react";
import { IoMdAdd, IoMdClose } from "react-icons/io";
import { PiDotsSixVertical } from "react-icons/pi";
import { toast } from "sonner";
import { useTranslate } from "@tolgee/react";
import { Pecha } from "@/components/ui/shadimport";
import { SortableItem, SortableList } from "@/components/ui/atoms/sortable";
import ImageContentData from "@/components/ui/molecules/modals/image-upload/ImageContentData";
import { uploadPostImage } from "@/components/routes/groups/api/groupPostsApi";
import { MAX_POST_MEDIA_ITEMS, type PostMediaRow } from "@/schema/PostSchema";

type PostMediaSectionProps = {
  fields: { id: string }[];
  media: PostMediaRow[];
  mediaDirty: boolean;
  isNew: boolean;
  readOnly: boolean;
  onAdd: (row: PostMediaRow) => void;
  onRemove: (index: number) => void;
  onMove: (from: number, to: number) => void;
  onStartReplace: () => void;
  onClear: () => void;
};

const PostMediaSection = ({
  fields,
  media,
  mediaDirty,
  isNew,
  readOnly,
  onAdd,
  onRemove,
  onMove,
  onStartReplace,
  onClear,
}: PostMediaSectionProps) => {
  const { t } = useTranslate();
  const [isDialogOpen, setDialogOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const canAdd =
    !readOnly && (isNew || mediaDirty) && media.length < MAX_POST_MEDIA_ITEMS;
  const canReorder = !readOnly && (isNew || mediaDirty) && fields.length > 1;
  const showingExisting = !isNew && !mediaDirty && media.length > 0;

  const handleReorder = (activeId: string, overId: string) => {
    const from = fields.findIndex((f) => f.id === activeId);
    const to = fields.findIndex((f) => f.id === overId);
    if (from === -1 || to === -1) return;
    onMove(from, to);
  };

  const handleUpload = async (file: File) => {
    setIsUploading(true);
    try {
      const key = await uploadPostImage(file);
      onAdd({
        media_type: "IMAGE",
        media_key: key,
        preview_url: URL.createObjectURL(file),
        width: null,
        height: null,
        duration_ms: null,
        is_existing: false,
      });
      setDialogOpen(false);
      toast.success(t("studio.groups.shared.image_uploaded"));
    } catch (error: unknown) {
      const err = error as { response?: { status?: number } };
      if (err?.response?.status === 413) {
        toast.error(t("studio.groups.shared.image_upload_error"), {
          description: t("studio.groups.shared.image_too_large"),
        });
      } else {
        toast.error(t("studio.groups.shared.image_upload_error"));
      }
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold">
            {t("studio.groups.posts.media.title")}
          </h3>
          <p className="text-xs text-muted-foreground">
            {t("studio.groups.posts.media.description", {
              max: MAX_POST_MEDIA_ITEMS,
            })}
          </p>
        </div>
        {!readOnly ? (
          <div className="flex flex-wrap justify-end gap-2">
            {showingExisting ? (
              <Pecha.Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onStartReplace}
              >
                {t("studio.groups.posts.media.replace")}
              </Pecha.Button>
            ) : null}
            {(isNew || mediaDirty) && media.length > 0 ? (
              <Pecha.Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onClear}
              >
                {t("studio.common.clear")}
              </Pecha.Button>
            ) : null}
            {canAdd ? (
              <Pecha.Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setDialogOpen(true)}
                className="gap-1"
              >
                <IoMdAdd className="h-4 w-4" />{" "}
                {t("studio.groups.posts.media.add_image")}
              </Pecha.Button>
            ) : null}
          </div>
        ) : null}
      </div>

      {showingExisting ? (
        <p className="text-xs text-muted-foreground">
          {t("studio.groups.posts.media.existing_kept")}
        </p>
      ) : null}

      {fields.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {t("studio.groups.posts.media.empty")}
        </p>
      ) : (
        <SortableList
          items={fields.map((f) => f.id)}
          onReorder={handleReorder}
          disabled={!canReorder}
        >
          <div className="flex flex-wrap gap-3">
            {fields.map((field, index) => {
              const item = media[index];
              const preview = item?.preview_url;
              return (
                <SortableItem
                  key={field.id}
                  id={field.id}
                  disabled={!canReorder}
                  className="relative"
                >
                  {({ listeners }: { listeners: Record<string, unknown> }) => (
                    <div className="relative h-28 w-28 overflow-hidden rounded-lg border bg-muted">
                      {preview ? (
                        <img
                          src={preview}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
                          {item?.media_type
                            ? t(
                                `studio.common.${item.media_type.toLowerCase()}`,
                              )
                            : t("studio.groups.posts.media.media")}
                        </div>
                      )}
                      {!readOnly && (isNew || mediaDirty) ? (
                        <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/60 to-transparent p-1.5">
                          {canReorder ? (
                            <button
                              type="button"
                              aria-label={t(
                                "studio.groups.posts.media.reorder_aria",
                              )}
                              className="cursor-grab rounded p-0.5 text-white active:cursor-grabbing"
                              {...listeners}
                            >
                              <PiDotsSixVertical className="h-4 w-4" />
                            </button>
                          ) : (
                            <span />
                          )}
                          <button
                            type="button"
                            aria-label={t(
                              "studio.groups.posts.media.remove_aria",
                            )}
                            onClick={() => onRemove(index)}
                            className="rounded p-0.5 text-white"
                          >
                            <IoMdClose className="h-4 w-4" />
                          </button>
                        </div>
                      ) : null}
                    </div>
                  )}
                </SortableItem>
              );
            })}
          </div>
        </SortableList>
      )}

      <Pecha.Dialog open={isDialogOpen} onOpenChange={setDialogOpen}>
        <Pecha.DialogContent showCloseButton={true}>
          <Pecha.DialogHeader>
            <Pecha.DialogTitle>
              {t("studio.groups.posts.media.upload_dialog_title")}
            </Pecha.DialogTitle>
          </Pecha.DialogHeader>
          <ImageContentData onUpload={handleUpload} isLoading={isUploading} />
        </Pecha.DialogContent>
      </Pecha.Dialog>
    </div>
  );
};

export default PostMediaSection;
