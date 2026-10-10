import { useTranslate } from "@tolgee/react";
import { Pecha } from "@/components/ui/shadimport";
import { IoMdCreate, IoMdTrash } from "react-icons/io";
import defaultCover from "/default-image.webp";
import type { Tag } from "./api/tagsApi";

interface TagsTableProps {
  tags: Tag[];
  isLoading?: boolean;
  showActionsColumn?: boolean;
  onEdit: (tag: Tag) => void;
  onDelete: (tag: Tag) => void;
}

const TagsTable = ({
  tags,
  isLoading,
  showActionsColumn = true,
  onEdit,
  onDelete,
}: TagsTableProps) => {
  const { t } = useTranslate();
  if (isLoading) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center">
        {t("studio.tags.loading")}
      </p>
    );
  }

  return (
    <div className="w-full overflow-x-auto">
      <Pecha.Table>
        <Pecha.TableHeader>
          <Pecha.TableRow>
            <Pecha.TableHead className="w-20">
              {t("studio.common.image")}
            </Pecha.TableHead>
            <Pecha.TableHead>{t("studio.common.name")}</Pecha.TableHead>
            <Pecha.TableHead className="w-24">
              {t("studio.tags.table.plans")}
            </Pecha.TableHead>
            {showActionsColumn ? (
              <Pecha.TableHead className="w-28 text-right">
                {t("studio.common.actions")}
              </Pecha.TableHead>
            ) : null}
          </Pecha.TableRow>
        </Pecha.TableHeader>
        <Pecha.TableBody>
          {tags.map((tag) => (
            <Pecha.TableRow key={tag.id}>
              <Pecha.TableCell>
                <img
                  src={tag.image || defaultCover}
                  alt={tag.name}
                  className="w-12 h-12 object-cover rounded-md border"
                />
              </Pecha.TableCell>
              <Pecha.TableCell>
                <div className="flex flex-col gap-1">
                  <span className="font-medium">{tag.name}</span>
                  {tag.metadata && tag.metadata.length > 0 && (
                    <div className="flex gap-1">
                      {tag.metadata.map((meta) => (
                        <span
                          key={meta.id}
                          className="text-xs px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400"
                        >
                          {meta.language}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </Pecha.TableCell>

              <Pecha.TableCell>{tag.plan_ids.length}</Pecha.TableCell>
              {showActionsColumn ? (
                <Pecha.TableCell>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => onEdit(tag)}
                      className="p-2 rounded-md border hover:bg-muted/50 transition-colors"
                      aria-label={t("studio.tags.table.edit_aria", {
                        name: tag.name,
                      })}
                    >
                      <IoMdCreate className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(tag)}
                      className="p-2 rounded-md border text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                      aria-label={t("studio.tags.table.delete_aria", {
                        name: tag.name,
                      })}
                    >
                      <IoMdTrash className="w-4 h-4" />
                    </button>
                  </div>
                </Pecha.TableCell>
              ) : null}
            </Pecha.TableRow>
          ))}
        </Pecha.TableBody>
      </Pecha.Table>
    </div>
  );
};

export default TagsTable;
