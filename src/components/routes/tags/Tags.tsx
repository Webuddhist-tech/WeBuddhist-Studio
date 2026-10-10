import { useState, Activity } from "react";
import { IoMdAdd, IoMdSearch } from "react-icons/io";
import { useDebounce } from "use-debounce";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTranslate } from "@tolgee/react";
import { Pecha } from "@/components/ui/shadimport";
import { Button } from "@/components/ui/atoms/button";
import AuthButton from "@/components/ui/molecules/auth-button/AuthButton";
import { Pagination } from "@/components/ui/molecules/pagination/Pagination";
import { getApiErrorMessage } from "@/lib/apiErrors";
import {
  createTag,
  deleteTag,
  fetchPlanOptions,
  fetchTags,
  updateTag,
  type Tag,
  type TagPayload,
} from "./api/tagsApi";
import { useUserInfo } from "@/hooks/useUserInfo";
import { shouldShowCmsActionsColumn } from "@/lib/platformAccess";
import TagFormDialog from "./TagFormDialog";
import TagsTable from "./TagsTable";

const PAGE_SIZE = 10;

const Tags = () => {
  const { t } = useTranslate();
  const { data: userInfo } = useUserInfo();
  const showActionsColumn = shouldShowCmsActionsColumn(userInfo?.platform_role);
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [debouncedSearch] = useDebounce(search, 500);
  const [formOpen, setFormOpen] = useState(false);
  const [editingTag, setEditingTag] = useState<Tag | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Tag | null>(null);

  const queryClient = useQueryClient();

  const {
    data: tagsData,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["cms-tags", currentPage, debouncedSearch],
    queryFn: () => fetchTags(currentPage, PAGE_SIZE, debouncedSearch),
    refetchOnWindowFocus: false,
    retry: false,
  });

  const { data: planOptions = [] } = useQuery({
    queryKey: ["cms-plans-options"],
    queryFn: fetchPlanOptions,
    refetchOnWindowFocus: false,
  });

  const invalidateTags = () => {
    queryClient.invalidateQueries({ queryKey: ["cms-tags"] });
  };

  const createMutation = useMutation({
    mutationFn: createTag,
    onSuccess: () => {
      toast.success(t("studio.tags.toast.created"));
      setFormOpen(false);
      invalidateTags();
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: TagPayload }) =>
      updateTag(id, payload),
    onSuccess: () => {
      toast.success(t("studio.tags.toast.updated"));
      setFormOpen(false);
      setEditingTag(null);
      invalidateTags();
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteTag,
    onSuccess: () => {
      toast.success(t("studio.tags.toast.deleted"));
      setDeleteTarget(null);
      invalidateTags();
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  const handleOpenCreate = () => {
    setEditingTag(null);
    setFormOpen(true);
  };

  const handleOpenEdit = (tag: Tag) => {
    setEditingTag(tag);
    setFormOpen(true);
  };

  const handleFormSubmit = (payload: TagPayload) => {
    if (editingTag) {
      updateMutation.mutate({ id: editingTag.id, payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const totalPages = tagsData ? Math.ceil(tagsData.total / PAGE_SIZE) : 1;
  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="flex flex-col border h-[calc(100vh-40px)] overflow-auto bg-[#F5F5F5] dark:bg-[#181818] my-4 rounded-l-2xl font-dynamic max-md:my-0 max-md:h-full max-md:rounded-none max-md:border-0">
      <div className="mb-4 px-4 pt-10 flex items-center justify-between max-md:flex-wrap max-md:gap-3 max-md:px-4 max-md:pt-4">
        <div className="flex items-center space-x-2 max-md:flex-wrap max-md:gap-y-2">
          <div className="border w-fit px-2 bg-white dark:bg-input/30 rounded-md border-gray-200 dark:border-[#313132] flex items-center">
            <IoMdSearch className="w-4 h-4" />
            <Pecha.Input
              placeholder={t("studio.tags.search_placeholder")}
              className="rounded-md border-none dark:bg-transparent px-4 shadow-none py-2"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                if (currentPage !== 1) setCurrentPage(1);
              }}
            />
          </div>
          {showActionsColumn ? (
            <Button
              variant="outline"
              className="bg-gray-100 hover:bg-gray-200"
              onClick={handleOpenCreate}
            >
              <IoMdAdd /> {t("studio.tags.add_tag")}
            </Button>
          ) : null}
        </div>
        <AuthButton />
      </div>

      <div className="border-b w-full border-dashed border-gray-300 dark:border-input" />

      <div className="px-4 pt-4 h-full flex flex-col items-center justify-between flex-1 min-h-0">
        {error ? (
          <p className="text-sm text-red-500 py-8">
            {t("studio.tags.load_failed")} {getApiErrorMessage(error)}
          </p>
        ) : tagsData?.tags.length === 0 && !isLoading ? (
          <div className="flex flex-col h-full items-center justify-center">
            <p className="text-base text-muted-foreground">
              {t("studio.tags.empty")}
            </p>
            {showActionsColumn ? (
              <Button
                variant="outline"
                className="mt-2"
                onClick={handleOpenCreate}
              >
                <IoMdAdd /> {t("studio.tags.add_tag")}
              </Button>
            ) : null}
          </div>
        ) : (
          <TagsTable
            tags={tagsData?.tags ?? []}
            isLoading={isLoading}
            showActionsColumn={showActionsColumn}
            onEdit={handleOpenEdit}
            onDelete={setDeleteTarget}
          />
        )}
      </div>

      <Activity mode={tagsData?.tags?.length ? "visible" : "hidden"}>
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
        />
      </Activity>

      <TagFormDialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) setEditingTag(null);
        }}
        tag={editingTag}
        plans={planOptions}
        isSubmitting={isSubmitting}
        onSubmit={handleFormSubmit}
      />

      <Pecha.AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <Pecha.AlertDialogContent>
          <Pecha.AlertDialogHeader>
            <Pecha.AlertDialogTitle>
              {t("studio.tags.delete_dialog.title")}
            </Pecha.AlertDialogTitle>
            <Pecha.AlertDialogDescription>
              {t("studio.tags.delete_dialog.description", {
                name: deleteTarget?.name ?? "",
              })}
            </Pecha.AlertDialogDescription>
          </Pecha.AlertDialogHeader>
          <Pecha.AlertDialogFooter>
            <Pecha.AlertDialogCancel disabled={deleteMutation.isPending}>
              {t("studio.common.cancel")}
            </Pecha.AlertDialogCancel>
            <Pecha.AlertDialogAction
              className="bg-[#AD1B21] dark:text-white hover:bg-[#AD1B21]/90"
              disabled={deleteMutation.isPending}
              onClick={() =>
                deleteTarget && deleteMutation.mutate(deleteTarget.id)
              }
            >
              {deleteMutation.isPending
                ? t("studio.common.deleting")
                : t("studio.common.delete")}
            </Pecha.AlertDialogAction>
          </Pecha.AlertDialogFooter>
        </Pecha.AlertDialogContent>
      </Pecha.AlertDialog>
    </div>
  );
};

export default Tags;
