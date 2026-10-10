import { useState } from "react";
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
import { shouldShowCmsActionsColumn } from "@/lib/platformAccess";
import {
  createAccumulatorPreset,
  deleteAccumulatorPreset,
  fetchAccumulatorPresets,
  updateAccumulatorPreset,
  type AccumulatorPreset,
  type AccumulatorPresetPayload,
  type UpdateAccumulatorPresetPayload,
  presetDisplayName,
} from "./api/accumulatorPresetsApi";
import AccumulatorPresetsTable from "./AccumulatorPresetsTable";
import PresetFormDialog from "./PresetFormDialog";

const PAGE_SIZE = 10;

const AccumulatorPresetsPage = () => {
  const { t } = useTranslate();
  const { data: userInfo } = useUserInfo();
  const showActionsColumn = shouldShowCmsActionsColumn(userInfo?.platform_role);
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [debouncedSearch] = useDebounce(search, 500);
  const [formOpen, setFormOpen] = useState(false);
  const [editingPreset, setEditingPreset] = useState<AccumulatorPreset | null>(
    null,
  );
  const [deleteTarget, setDeleteTarget] = useState<AccumulatorPreset | null>(
    null,
  );

  const queryClient = useQueryClient();

  const {
    data: presetsData,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["cms-accumulator-presets", currentPage, debouncedSearch],
    queryFn: () =>
      fetchAccumulatorPresets(currentPage, PAGE_SIZE, debouncedSearch),
    refetchOnWindowFocus: false,
    retry: false,
  });

  const invalidatePresets = () => {
    queryClient.invalidateQueries({ queryKey: ["cms-accumulator-presets"] });
  };

  const createMutation = useMutation({
    mutationFn: createAccumulatorPreset,
    onSuccess: () => {
      toast.success(t("studio.accumulator_presets.toast.created"));
      setFormOpen(false);
      invalidatePresets();
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: UpdateAccumulatorPresetPayload;
    }) => updateAccumulatorPreset(id, payload),
    onSuccess: () => {
      toast.success(t("studio.accumulator_presets.toast.updated"));
      setFormOpen(false);
      setEditingPreset(null);
      invalidatePresets();
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteAccumulatorPreset,
    onSuccess: () => {
      toast.success(t("studio.accumulator_presets.toast.deleted"));
      setDeleteTarget(null);
      invalidatePresets();
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  const handleOpenCreate = () => {
    setEditingPreset(null);
    setFormOpen(true);
  };

  const handleOpenEdit = (preset: AccumulatorPreset) => {
    setEditingPreset(preset);
    setFormOpen(true);
  };

  const handleFormSubmit = (
    payload: AccumulatorPresetPayload | UpdateAccumulatorPresetPayload,
  ) => {
    if (editingPreset) {
      updateMutation.mutate({ id: editingPreset.id, payload });
    } else {
      createMutation.mutate(payload as AccumulatorPresetPayload);
    }
  };

  const totalPages = presetsData ? Math.ceil(presetsData.total / PAGE_SIZE) : 1;
  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="flex flex-col border h-[calc(100vh-40px)] overflow-auto bg-[#F5F5F5] dark:bg-[#181818] my-4 rounded-l-2xl font-dynamic max-md:my-0 max-md:h-full max-md:rounded-none max-md:border-0">
      <div className="mb-4 px-4 pt-10 flex items-center justify-between max-md:flex-wrap max-md:gap-3 max-md:px-4 max-md:pt-4">
        <div className="flex items-center space-x-2 max-md:flex-wrap max-md:gap-y-2">
          <div className="border w-fit px-2 bg-white dark:bg-input/30 rounded-md border-gray-200 dark:border-[#313132] flex items-center">
            <IoMdSearch className="w-4 h-4" />
            <Pecha.Input
              placeholder={t("studio.accumulator_presets.search_placeholder")}
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
              <IoMdAdd /> {t("studio.accumulator_presets.add_preset")}
            </Button>
          ) : null}
        </div>
        <AuthButton />
      </div>

      <div className="border-b w-full border-dashed border-gray-300 dark:border-input" />

      <div className="px-4 pt-4 h-full flex flex-col items-center justify-between flex-1 min-h-0">
        {error ? (
          <p className="text-sm text-red-500 py-8">
            {t("studio.accumulator_presets.load_failed")}{" "}
            {getApiErrorMessage(error)}
          </p>
        ) : presetsData?.accumulators.length === 0 && !isLoading ? (
          <div className="flex flex-col h-full items-center justify-center">
            <p className="text-base text-muted-foreground">
              {t("studio.accumulator_presets.empty")}
            </p>
            {showActionsColumn ? (
              <Button
                variant="outline"
                className="mt-2"
                onClick={handleOpenCreate}
              >
                <IoMdAdd /> {t("studio.accumulator_presets.add_preset")}
              </Button>
            ) : null}
          </div>
        ) : (
          <>
            <div className="w-full flex-1 overflow-auto">
              <AccumulatorPresetsTable
                presets={presetsData?.accumulators ?? []}
                isLoading={isLoading}
                showActionsColumn={showActionsColumn}
                onEdit={handleOpenEdit}
                onDelete={setDeleteTarget}
              />
            </div>
            {totalPages > 1 ? (
              <div className="py-4">
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={setCurrentPage}
                />
              </div>
            ) : null}
          </>
        )}
      </div>

      {showActionsColumn ? (
        <PresetFormDialog
          open={formOpen}
          onOpenChange={(open) => {
            setFormOpen(open);
            if (!open) setEditingPreset(null);
          }}
          preset={editingPreset}
          isSubmitting={isSubmitting}
          onSubmit={handleFormSubmit}
        />
      ) : null}

      <Pecha.AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <Pecha.AlertDialogContent>
          <Pecha.AlertDialogHeader>
            <Pecha.AlertDialogTitle>
              {t("studio.accumulator_presets.delete_dialog.title")}
            </Pecha.AlertDialogTitle>
            <Pecha.AlertDialogDescription>
              {t("studio.accumulator_presets.delete_dialog.description_before")}{" "}
              <strong>
                {deleteTarget ? presetDisplayName(deleteTarget) : ""}
              </strong>
              {t("studio.accumulator_presets.delete_dialog.description_after")}
            </Pecha.AlertDialogDescription>
          </Pecha.AlertDialogHeader>
          <Pecha.AlertDialogFooter>
            <Pecha.AlertDialogCancel>
              {t("studio.common.cancel")}
            </Pecha.AlertDialogCancel>
            <Pecha.AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => {
                if (deleteTarget) deleteMutation.mutate(deleteTarget.id);
              }}
              disabled={deleteMutation.isPending}
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

export default AccumulatorPresetsPage;
