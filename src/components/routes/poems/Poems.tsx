import { useEffect, useState } from "react";
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
import { useUserInfo } from "@/hooks/useUserInfo";
import { useLanguages } from "@/hooks/useLanguages";
import { shouldShowCmsActionsColumn } from "@/lib/platformAccess";
import { fetchPoemsList, deletePoem, type PoemItem } from "./api/poemApi";
import PoemsList from "./PoemsList";
import PoemFormDialog from "./PoemFormDialog";

const PAGE_SIZE = 10;

const Poems = () => {
  const { t } = useTranslate();
  const { data: userInfo } = useUserInfo();
  const showActionsColumn =
    !!userInfo && shouldShowCmsActionsColumn(userInfo.platform_role);
  const { languageOptions } = useLanguages();
  const [search, setSearch] = useState("");
  const [languageFilter, setLanguageFilter] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [debouncedSearch] = useDebounce(search, 500);
  const [formOpen, setFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<PoemItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PoemItem | null>(null);

  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["poems-list", currentPage, debouncedSearch, languageFilter],
    queryFn: () =>
      fetchPoemsList({
        page: currentPage,
        limit: PAGE_SIZE,
        authorName: debouncedSearch,
        language: languageFilter || undefined,
      }),
    refetchOnWindowFocus: false,
    retry: false,
  });

  const invalidatePoems = () => {
    queryClient.invalidateQueries({ queryKey: ["poems-list"] });
  };

  const deleteMutation = useMutation({
    mutationFn: deletePoem,
    onSuccess: () => {
      toast.success(t("studio.poems.toast.deleted"));
      setDeleteTarget(null);
      if (data?.poems.length === 1 && currentPage > 1) {
        setCurrentPage(currentPage - 1);
      }
      invalidatePoems();
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err));
      setDeleteTarget(null);
    },
  });

  const handleOpenCreate = () => {
    setEditingItem(null);
    setFormOpen(true);
  };

  const handleOpenEdit = (item: PoemItem) => {
    setEditingItem(item);
    setFormOpen(true);
  };

  const handleFormSuccess = () => {
    setFormOpen(false);
    setEditingItem(null);
    invalidatePoems();
  };

  const poems = data?.poems ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // If the dataset shrank (deletions elsewhere, filter change) enough that
  // the selected page no longer exists, snap back to the last valid page
  // instead of showing a false "no poems" state with pagination hidden.
  useEffect(() => {
    if (data && currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [data, currentPage, totalPages]);

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-[#F5F5F5] dark:bg-[#181818] font-dynamic max-md:h-full">
      <div className="px-6 py-4 flex items-center justify-between border-b border-gray-200 dark:border-[#313132] bg-white dark:bg-[#1E1E1E] max-md:flex-wrap max-md:gap-3 max-md:px-4 max-md:pt-4">
        <div className="flex items-center space-x-2 max-md:flex-wrap max-md:gap-y-2">
          <div className="border w-fit px-2 bg-white dark:bg-input/30 rounded-md border-gray-200 dark:border-[#313132] flex items-center">
            <IoMdSearch className="w-4 h-4" />
            <Pecha.Input
              placeholder={t("studio.poems.search_placeholder")}
              className="rounded-md border-none dark:bg-transparent px-4 shadow-none py-2"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                if (currentPage !== 1) setCurrentPage(1);
              }}
            />
          </div>
          <Pecha.Select
            value={languageFilter || "ALL"}
            onValueChange={(v) => {
              setLanguageFilter(v === "ALL" ? "" : v);
              if (currentPage !== 1) setCurrentPage(1);
            }}
          >
            <Pecha.SelectTrigger className="w-[160px]">
              <Pecha.SelectValue
                placeholder={t("studio.poems.all_languages")}
              />
            </Pecha.SelectTrigger>
            <Pecha.SelectContent>
              <Pecha.SelectItem value="ALL">
                {t("studio.poems.all_languages")}
              </Pecha.SelectItem>
              {languageOptions.map((lang) => (
                <Pecha.SelectItem key={lang.value} value={lang.value}>
                  {lang.label}
                </Pecha.SelectItem>
              ))}
            </Pecha.SelectContent>
          </Pecha.Select>
          {showActionsColumn ? (
            <Button
              variant="outline"
              className="bg-gray-100 hover:bg-gray-200"
              onClick={handleOpenCreate}
            >
              <IoMdAdd /> {t("studio.poems.add_poem")}
            </Button>
          ) : null}
        </div>
        <AuthButton />
      </div>

      <div className="flex-1 overflow-hidden px-6 py-4">
        {error ? (
          <p className="text-sm text-red-500 py-8">
            {t("studio.poems.load_failed")} {getApiErrorMessage(error)}
          </p>
        ) : poems.length === 0 && !isLoading ? (
          <div className="flex flex-col h-full items-center justify-center">
            <p className="text-base text-muted-foreground">
              {t("studio.poems.empty")}
            </p>
            {showActionsColumn ? (
              <Button
                variant="outline"
                className="mt-2"
                onClick={handleOpenCreate}
              >
                <IoMdAdd /> {t("studio.poems.add_poem")}
              </Button>
            ) : null}
          </div>
        ) : (
          <div className="h-full overflow-auto">
            <PoemsList
              poems={poems}
              isLoading={isLoading}
              showActionsColumn={showActionsColumn}
              onEdit={handleOpenEdit}
              onDelete={setDeleteTarget}
            />
          </div>
        )}
      </div>

      {poems.length > 0 && (
        <div className="border-t border-gray-200 dark:border-[#313132] px-6 py-4 bg-white dark:bg-[#1E1E1E]">
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
          />
        </div>
      )}

      {showActionsColumn ? (
        <PoemFormDialog
          open={formOpen}
          onOpenChange={(open: boolean) => {
            setFormOpen(open);
            if (!open) setEditingItem(null);
          }}
          editingItem={editingItem}
          onSuccess={handleFormSuccess}
        />
      ) : null}

      <Pecha.AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <Pecha.AlertDialogContent>
          <Pecha.AlertDialogHeader>
            <Pecha.AlertDialogTitle>
              {t("studio.poems.delete_dialog.title")}
            </Pecha.AlertDialogTitle>
            <Pecha.AlertDialogDescription>
              {t("studio.poems.delete_dialog.description", {
                title: deleteTarget?.title ?? "",
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

export default Poems;
