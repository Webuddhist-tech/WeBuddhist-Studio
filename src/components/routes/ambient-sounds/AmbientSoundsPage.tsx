import { useState } from "react";
import { IoMdAdd } from "react-icons/io";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTranslate } from "@tolgee/react";
import { Pecha } from "@/components/ui/shadimport";
import { Button } from "@/components/ui/atoms/button";
import AuthButton from "@/components/ui/molecules/auth-button/AuthButton";
import { getApiErrorMessage } from "@/lib/apiErrors";
import { useUserInfo } from "@/hooks/useUserInfo";
import { canManageAmbientSounds } from "@/lib/platformAccess";
import {
  createAmbientSound,
  deleteAmbientSound,
  fetchAmbientSounds,
  updateAmbientSound,
  type AmbientSound,
} from "./api/ambientSoundsApi";
import AmbientSoundsTable from "./AmbientSoundsTable";
import AmbientSoundFormDialog, {
  type AmbientSoundFormPayload,
} from "./AmbientSoundFormDialog";
import { useAmbientSoundReorder } from "./hooks/useAmbientSoundReorder";

const AmbientSoundsPage = () => {
  const { t } = useTranslate();
  const { data: userInfo } = useUserInfo();
  const canManage = canManageAmbientSounds(userInfo?.platform_role);
  const [formOpen, setFormOpen] = useState(false);
  const [editingSound, setEditingSound] = useState<AmbientSound | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AmbientSound | null>(null);

  const queryClient = useQueryClient();

  const {
    data: soundsData,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["cms-ambient-sounds"],
    queryFn: fetchAmbientSounds,
    refetchOnWindowFocus: false,
    retry: false,
  });

  const { displaySounds, canReorder, handleReorder } = useAmbientSoundReorder(
    soundsData?.sounds,
    canManage,
  );

  const invalidateSounds = () => {
    queryClient.invalidateQueries({ queryKey: ["cms-ambient-sounds"] });
  };

  const createMutation = useMutation({
    mutationFn: createAmbientSound,
    onSuccess: () => {
      toast.success(t("studio.ambient_sounds.toast_added"));
      setFormOpen(false);
      invalidateSounds();
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: Parameters<typeof updateAmbientSound>[1];
    }) => updateAmbientSound(id, payload),
    onSuccess: () => {
      toast.success(t("studio.ambient_sounds.toast_updated"));
      setFormOpen(false);
      setEditingSound(null);
      invalidateSounds();
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteAmbientSound,
    onSuccess: () => {
      toast.success(t("studio.ambient_sounds.toast_deleted"));
      setDeleteTarget(null);
      invalidateSounds();
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  const handleOpenCreate = () => {
    setEditingSound(null);
    setFormOpen(true);
  };

  const handleOpenEdit = (sound: AmbientSound) => {
    setEditingSound(sound);
    setFormOpen(true);
  };

  const handleFormSubmit = (payload: AmbientSoundFormPayload) => {
    if (editingSound) {
      updateMutation.mutate({
        id: editingSound.id,
        payload: {
          name: payload.name,
          displayOrder: payload.displayOrder,
          isDefault: payload.isDefault,
          file: payload.file ?? undefined,
          imageFile: payload.imageFile ?? undefined,
        },
      });
    } else {
      createMutation.mutate({
        name: payload.name,
        displayOrder: payload.displayOrder,
        isDefault: payload.isDefault,
        file: payload.file as File,
        imageFile: payload.imageFile ?? undefined,
      });
    }
  };

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="flex flex-col border h-[calc(100vh-40px)] overflow-auto bg-[#F5F5F5] dark:bg-[#181818] my-4 rounded-l-2xl font-dynamic max-md:my-0 max-md:h-full max-md:rounded-none max-md:border-0">
      <div className="mb-4 px-4 pt-10 flex items-center justify-between max-md:flex-wrap max-md:gap-3 max-md:px-4 max-md:pt-4">
        <div className="flex items-center space-x-2 max-md:flex-wrap max-md:gap-y-2">
          <h1 className="text-xl font-semibold">
            {t("studio.ambient_sounds.title")}
          </h1>
          {canManage ? (
            <Button
              variant="outline"
              className="bg-gray-100 hover:bg-gray-200"
              onClick={handleOpenCreate}
            >
              <IoMdAdd /> {t("studio.ambient_sounds.form.add_sound")}
            </Button>
          ) : null}
        </div>
        <AuthButton />
      </div>

      <div className="border-b w-full border-dashed border-gray-300 dark:border-input" />

      <div className="px-4 pt-4 h-full flex flex-col items-center justify-between flex-1 min-h-0">
        {error ? (
          <p className="text-sm text-red-500 py-8">
            {t("studio.ambient_sounds.load_failed")} {getApiErrorMessage(error)}
          </p>
        ) : displaySounds.length === 0 && !isLoading ? (
          <div className="flex flex-col h-full items-center justify-center">
            <p className="text-base text-muted-foreground">
              {t("studio.ambient_sounds.empty")}
            </p>
            {canManage ? (
              <Button
                variant="outline"
                className="mt-2"
                onClick={handleOpenCreate}
              >
                <IoMdAdd /> {t("studio.ambient_sounds.form.add_sound")}
              </Button>
            ) : null}
          </div>
        ) : (
          <div className="w-full flex-1 overflow-auto">
            <AmbientSoundsTable
              sounds={displaySounds}
              isLoading={isLoading}
              canManage={canManage}
              canReorder={canReorder}
              onReorder={handleReorder}
              onEdit={handleOpenEdit}
              onDelete={setDeleteTarget}
            />
          </div>
        )}
      </div>

      {canManage ? (
        <AmbientSoundFormDialog
          open={formOpen}
          onOpenChange={(open) => {
            setFormOpen(open);
            if (!open) setEditingSound(null);
          }}
          sound={editingSound}
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
              {t("studio.ambient_sounds.delete_title")}
            </Pecha.AlertDialogTitle>
            <Pecha.AlertDialogDescription>
              {t("studio.ambient_sounds.delete_description", {
                name: deleteTarget?.name ?? "",
              })}
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

export default AmbientSoundsPage;
