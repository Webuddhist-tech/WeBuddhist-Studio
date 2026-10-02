import { useState } from "react";
import { IoMdAdd, IoMdSearch } from "react-icons/io";
import { useDebounce } from "use-debounce";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Pecha } from "@/components/ui/shadimport";
import { Button } from "@/components/ui/atoms/button";
import AuthButton from "@/components/ui/molecules/auth-button/AuthButton";
import { Pagination } from "@/components/ui/molecules/pagination/Pagination";
import { getApiErrorMessage } from "@/lib/apiErrors";
import {
  fetchVerseOfDayList,
  deleteVerseOfDay,
  type SortOrder,
  type VerseOfDayItem,
} from "./api/verseOfDayApi";
import VerseOfDayList from "./VerseOfDayList";
import VerseOfDayFormDialog from "./VerseOfDayFormDialog";

const PAGE_SIZE = 10;

const VerseOfDay = () => {
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [debouncedSearch] = useDebounce(search, 500);
  const [formOpen, setFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<VerseOfDayItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<VerseOfDayItem | null>(null);

  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["verse-of-day-list", currentPage, debouncedSearch, sortOrder],
    queryFn: () =>
      fetchVerseOfDayList({
        page: currentPage,
        limit: PAGE_SIZE,
        search: debouncedSearch,
        sortOrder,
      }),
    refetchOnWindowFocus: false,
    retry: false,
  });

  const invalidateVerses = () => {
    queryClient.invalidateQueries({ queryKey: ["verse-of-day-list"] });
  };

  const deleteMutation = useMutation({
    mutationFn: deleteVerseOfDay,
    onSuccess: () => {
      toast.success("Verse of Day deleted successfully!");
      setDeleteTarget(null);
      if (data?.verses.length === 1 && currentPage > 1) {
        setCurrentPage(currentPage - 1);
      }
      invalidateVerses();
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

  const handleOpenEdit = (item: VerseOfDayItem) => {
    setEditingItem(item);
    setFormOpen(true);
  };

  const handleFormSuccess = () => {
    setFormOpen(false);
    setEditingItem(null);
    invalidateVerses();
  };

  const handleToggleSort = () => {
    setSortOrder((prev) => (prev === "desc" ? "asc" : "desc"));
    if (currentPage !== 1) setCurrentPage(1);
  };

  const verses = data?.verses ?? [];

  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-[#F5F5F5] dark:bg-[#181818] font-dynamic max-md:h-full">
      <div className="px-6 py-4 flex items-center justify-between border-b border-gray-200 dark:border-[#313132] bg-white dark:bg-[#1E1E1E] max-md:flex-wrap max-md:gap-3 max-md:px-4 max-md:pt-4">
        <div className="flex items-center space-x-2 max-md:flex-wrap max-md:gap-y-2">
          <div className="border w-fit px-2 bg-white dark:bg-input/30 rounded-md border-gray-200 dark:border-[#313132] flex items-center">
            <IoMdSearch className="w-4 h-4" />
            <Pecha.Input
              placeholder="Search verses..."
              className="rounded-md border-none dark:bg-transparent px-4 shadow-none py-2"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                if (currentPage !== 1) setCurrentPage(1);
              }}
            />
          </div>
          <Button
            variant="outline"
            className="bg-gray-100 hover:bg-gray-200"
            onClick={handleOpenCreate}
          >
            <IoMdAdd /> Add Verse
          </Button>
        </div>
        <AuthButton />
      </div>

      <div className="flex-1 overflow-hidden px-6 py-4">
        {error ? (
          <p className="text-sm text-red-500 py-8">
            Failed to load verses. {getApiErrorMessage(error)}
          </p>
        ) : verses.length === 0 && !isLoading ? (
          <div className="flex flex-col h-full items-center justify-center">
            <p className="text-base text-muted-foreground">No verses found</p>
            <Button
              variant="outline"
              className="mt-2"
              onClick={handleOpenCreate}
            >
              <IoMdAdd /> Add Verse
            </Button>
          </div>
        ) : (
          <div className="h-full overflow-auto">
            <VerseOfDayList
              verses={verses}
              isLoading={isLoading}
              sortOrder={sortOrder}
              onToggleSort={handleToggleSort}
              onEdit={handleOpenEdit}
              onDelete={setDeleteTarget}
            />
          </div>
        )}
      </div>

      {verses.length > 0 && (
        <div className="border-t border-gray-200 dark:border-[#313132] px-6 py-4 bg-white dark:bg-[#1E1E1E]">
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
          />
        </div>
      )}

      <VerseOfDayFormDialog
        open={formOpen}
        onOpenChange={(open: boolean) => {
          setFormOpen(open);
          if (!open) setEditingItem(null);
        }}
        editingItem={editingItem}
        onSuccess={handleFormSuccess}
        existingVerses={verses}
      />

      <Pecha.AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <Pecha.AlertDialogContent>
          <Pecha.AlertDialogHeader>
            <Pecha.AlertDialogTitle>Delete Verse of Day</Pecha.AlertDialogTitle>
            <Pecha.AlertDialogDescription>
              Are you sure you want to delete this verse? This action cannot be
              undone.
            </Pecha.AlertDialogDescription>
          </Pecha.AlertDialogHeader>
          <Pecha.AlertDialogFooter>
            <Pecha.AlertDialogCancel disabled={deleteMutation.isPending}>
              Cancel
            </Pecha.AlertDialogCancel>
            <Pecha.AlertDialogAction
              className="bg-[#AD1B21] dark:text-white hover:bg-[#AD1B21]/90"
              disabled={deleteMutation.isPending}
              onClick={() =>
                deleteTarget && deleteMutation.mutate(deleteTarget.id)
              }
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </Pecha.AlertDialogAction>
          </Pecha.AlertDialogFooter>
        </Pecha.AlertDialogContent>
      </Pecha.AlertDialog>
    </div>
  );
};

export default VerseOfDay;
