import { useState, Activity } from "react";
import { IoMdAdd, IoMdSearch } from "react-icons/io";
import { useDebounce } from "use-debounce";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Pecha } from "@/components/ui/shadimport";
import { Button } from "@/components/ui/atoms/button";
import AuthButton from "@/components/ui/molecules/auth-button/AuthButton";
import { Pagination } from "@/components/ui/molecules/pagination/Pagination";
import { getApiErrorMessage } from "@/lib/apiErrors";
import { capitalizeFirstLetter } from "@/lib/textUtils";
import {
  createTradition,
  deleteTradition,
  fetchTraditions,
  updateTradition,
  type Tradition,
  type TraditionPayload,
} from "./api/traditionsApi";
import { useUserInfo } from "@/hooks/useUserInfo";
import { shouldShowCmsActionsColumn } from "@/lib/platformAccess";
import TraditionFormDialog from "./TraditionFormDialog";
import TraditionsTable from "./TraditionsTable";

const PAGE_SIZE = 10;

const TraditionsPage = () => {
  const { data: userInfo } = useUserInfo();
  const showActionsColumn = shouldShowCmsActionsColumn(userInfo?.platform_role);
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [debouncedSearch] = useDebounce(search, 500);
  const [formOpen, setFormOpen] = useState(false);
  const [editingTradition, setEditingTradition] = useState<Tradition | null>(
    null,
  );
  const [deleteTarget, setDeleteTarget] = useState<Tradition | null>(null);

  const queryClient = useQueryClient();

  const {
    data: traditionsData,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["cms-traditions", currentPage, debouncedSearch],
    queryFn: () => fetchTraditions(currentPage, PAGE_SIZE, debouncedSearch),
    refetchOnWindowFocus: false,
    retry: false,
  });

  const invalidateTraditions = () => {
    queryClient.invalidateQueries({ queryKey: ["cms-traditions"] });
  };

  const createMutation = useMutation({
    mutationFn: createTradition,
    onSuccess: () => {
      toast.success("Tradition created successfully");
      setFormOpen(false);
      invalidateTraditions();
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: TraditionPayload }) =>
      updateTradition(id, payload),
    onSuccess: () => {
      toast.success("Tradition updated successfully");
      setFormOpen(false);
      setEditingTradition(null);
      invalidateTraditions();
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteTradition,
    onSuccess: () => {
      toast.success("Tradition deleted successfully");
      setDeleteTarget(null);
      invalidateTraditions();
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  const handleOpenCreate = () => {
    setEditingTradition(null);
    setFormOpen(true);
  };

  const handleOpenEdit = (tradition: Tradition) => {
    setEditingTradition(tradition);
    setFormOpen(true);
  };

  const handleFormSubmit = (payload: TraditionPayload) => {
    if (editingTradition) {
      updateMutation.mutate({ id: editingTradition.id, payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const totalPages = traditionsData
    ? Math.ceil(traditionsData.total / PAGE_SIZE)
    : 1;
  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="flex flex-col border h-[calc(100vh-40px)] overflow-auto bg-[#F5F5F5] dark:bg-[#181818] my-4 rounded-l-2xl font-dynamic max-md:my-0 max-md:h-full max-md:rounded-none max-md:border-0">
      <div className="mb-4 px-4 pt-10 flex items-center justify-between max-md:flex-wrap max-md:gap-3 max-md:px-4 max-md:pt-4">
        <div className="flex items-center space-x-2 max-md:flex-wrap max-md:gap-y-2">
          <div className="border w-fit px-2 bg-white dark:bg-input/30 rounded-md border-gray-200 dark:border-[#313132] flex items-center">
            <IoMdSearch className="w-4 h-4" />
            <Pecha.Input
              placeholder="Search traditions..."
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
              <IoMdAdd /> Add Tradition
            </Button>
          ) : null}
        </div>
        <AuthButton />
      </div>

      <div className="border-b w-full border-dashed border-gray-300 dark:border-input" />

      <div className="px-4 pt-4 h-full flex flex-col items-center justify-between flex-1 min-h-0">
        {error ? (
          <p className="text-sm text-red-500 py-8">
            Failed to load traditions. {getApiErrorMessage(error)}
          </p>
        ) : traditionsData?.traditions.length === 0 && !isLoading ? (
          <div className="flex flex-col h-full items-center justify-center">
            <p className="text-base text-muted-foreground">
              No traditions found
            </p>
            {showActionsColumn ? (
              <Button
                variant="outline"
                className="mt-2"
                onClick={handleOpenCreate}
              >
                <IoMdAdd /> Add Tradition
              </Button>
            ) : null}
          </div>
        ) : (
          <TraditionsTable
            traditions={traditionsData?.traditions ?? []}
            isLoading={isLoading}
            showActionsColumn={showActionsColumn}
            onEdit={handleOpenEdit}
            onDelete={setDeleteTarget}
          />
        )}
      </div>

      <Activity
        mode={traditionsData?.traditions?.length ? "visible" : "hidden"}
      >
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
        />
      </Activity>

      <TraditionFormDialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) setEditingTradition(null);
        }}
        tradition={editingTradition}
        isSubmitting={isSubmitting}
        onSubmit={handleFormSubmit}
      />

      <Pecha.AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <Pecha.AlertDialogContent>
          <Pecha.AlertDialogHeader>
            <Pecha.AlertDialogTitle>Delete tradition?</Pecha.AlertDialogTitle>
            <Pecha.AlertDialogDescription>
              This will permanently delete{" "}
              <strong>
                {capitalizeFirstLetter(
                  deleteTarget?.name?.trim() ||
                    deleteTarget?.code ||
                    "Untitled",
                )}
              </strong>{" "}
              and remove it from users who selected it.
            </Pecha.AlertDialogDescription>
          </Pecha.AlertDialogHeader>
          <Pecha.AlertDialogFooter>
            <Pecha.AlertDialogCancel disabled={deleteMutation.isPending}>
              Cancel
            </Pecha.AlertDialogCancel>
            <Pecha.AlertDialogAction
              disabled={deleteMutation.isPending}
              onClick={() => {
                if (deleteTarget) deleteMutation.mutate(deleteTarget.id);
              }}
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </Pecha.AlertDialogAction>
          </Pecha.AlertDialogFooter>
        </Pecha.AlertDialogContent>
      </Pecha.AlertDialog>
    </div>
  );
};

export default TraditionsPage;
