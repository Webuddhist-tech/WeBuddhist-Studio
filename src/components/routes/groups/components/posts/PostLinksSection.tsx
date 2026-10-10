import type { UseFormReturn } from "react-hook-form";
import { useTranslate } from "@tolgee/react";
import { IoMdAdd, IoMdClose } from "react-icons/io";
import { PiDotsSixVertical } from "react-icons/pi";
import { Pecha } from "@/components/ui/shadimport";
import { SortableItem, SortableList } from "@/components/ui/atoms/sortable";
import type { PostFormData } from "@/schema/PostSchema";
import { POST_LINK_TYPES } from "@/schema/PostSchema";

type PostLinksSectionProps = {
  form: UseFormReturn<PostFormData>;
  fields: { id: string }[];
  readOnly: boolean;
  onAdd: () => void;
  onRemove: (index: number) => void;
  onMove: (from: number, to: number) => void;
};

const PostLinksSection = ({
  form,
  fields,
  readOnly,
  onAdd,
  onRemove,
  onMove,
}: PostLinksSectionProps) => {
  const { t } = useTranslate();
  const canReorder = !readOnly && fields.length > 1;

  const handleReorder = (activeId: string, overId: string) => {
    const from = fields.findIndex((f) => f.id === activeId);
    const to = fields.findIndex((f) => f.id === overId);
    if (from === -1 || to === -1) return;
    onMove(from, to);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold">
            {t("studio.groups.posts.links.title")}
          </h3>
          <p className="text-xs text-muted-foreground">
            {t("studio.groups.posts.links.description")}
          </p>
        </div>
        {!readOnly ? (
          <Pecha.Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onAdd}
            className="gap-1"
          >
            <IoMdAdd className="h-4 w-4" /> {t("studio.groups.posts.links.add")}
          </Pecha.Button>
        ) : null}
      </div>

      {fields.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {t("studio.groups.posts.links.empty")}
        </p>
      ) : null}

      <SortableList
        items={fields.map((f) => f.id)}
        onReorder={handleReorder}
        disabled={!canReorder}
      >
        <div className="space-y-3">
          {fields.map((field, index) => (
            <SortableItem
              key={field.id}
              id={field.id}
              disabled={!canReorder}
              className="space-y-3 rounded-lg border border-border bg-[#FAFAFA] p-4 dark:bg-[#262626]"
            >
              {({ listeners }: { listeners: Record<string, unknown> }) => (
                <>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2">
                      {!readOnly ? (
                        <button
                          type="button"
                          aria-label={t(
                            "studio.groups.posts.links.reorder_aria",
                          )}
                          disabled={!canReorder}
                          className="mt-8 shrink-0 cursor-grab touch-none rounded p-1 text-muted-foreground hover:text-foreground active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-30"
                          {...listeners}
                        >
                          <PiDotsSixVertical className="h-5 w-5" />
                        </button>
                      ) : null}

                      <Pecha.FormField
                        control={form.control}
                        name={`links.${index}.type`}
                        render={({ field: typeField }) => (
                          <Pecha.FormItem className="w-48">
                            <Pecha.FormLabel>
                              {t("studio.groups.posts.links.type_label")}
                            </Pecha.FormLabel>
                            <Pecha.Select
                              value={typeField.value}
                              onValueChange={typeField.onChange}
                              disabled={readOnly}
                            >
                              <Pecha.FormControl>
                                <Pecha.SelectTrigger className="w-full bg-white dark:bg-[#181818]">
                                  <Pecha.SelectValue
                                    placeholder={t(
                                      "studio.groups.posts.links.type_placeholder",
                                    )}
                                  />
                                </Pecha.SelectTrigger>
                              </Pecha.FormControl>
                              <Pecha.SelectContent>
                                {POST_LINK_TYPES.map((option) => (
                                  <Pecha.SelectItem
                                    key={option.value}
                                    value={option.value}
                                  >
                                    {t(
                                      `studio.groups.posts.links.type.${option.value.toLowerCase()}`,
                                    )}
                                  </Pecha.SelectItem>
                                ))}
                              </Pecha.SelectContent>
                            </Pecha.Select>
                            <Pecha.FormMessage />
                          </Pecha.FormItem>
                        )}
                      />
                    </div>

                    {!readOnly ? (
                      <button
                        type="button"
                        aria-label={t("studio.groups.posts.links.remove_aria")}
                        onClick={() => onRemove(index)}
                        className="mt-8 text-muted-foreground hover:text-destructive"
                      >
                        <IoMdClose className="h-5 w-5" />
                      </button>
                    ) : null}
                  </div>

                  <Pecha.FormField
                    control={form.control}
                    name={`links.${index}.url`}
                    render={({ field: urlField }) => (
                      <Pecha.FormItem>
                        <Pecha.FormLabel>
                          {t("studio.groups.posts.links.url_label")}
                        </Pecha.FormLabel>
                        <Pecha.FormControl>
                          <Pecha.Input
                            {...urlField}
                            type="url"
                            inputMode="url"
                            placeholder="https://example.com"
                            disabled={readOnly}
                            className="bg-white dark:bg-[#181818]"
                          />
                        </Pecha.FormControl>
                        <Pecha.FormMessage />
                      </Pecha.FormItem>
                    )}
                  />

                  <Pecha.FormField
                    control={form.control}
                    name={`links.${index}.label`}
                    render={({ field: labelField }) => (
                      <Pecha.FormItem>
                        <Pecha.FormLabel>
                          {t("studio.groups.posts.links.label_label")}
                        </Pecha.FormLabel>
                        <Pecha.FormControl>
                          <Pecha.Input
                            {...labelField}
                            placeholder={t(
                              "studio.groups.posts.links.label_placeholder",
                            )}
                            disabled={readOnly}
                            className="bg-white dark:bg-[#181818]"
                          />
                        </Pecha.FormControl>
                        <Pecha.FormMessage />
                      </Pecha.FormItem>
                    )}
                  />
                </>
              )}
            </SortableItem>
          ))}
        </div>
      </SortableList>
    </div>
  );
};

export default PostLinksSection;
