import { useState } from "react";
import { IoMdAdd } from "react-icons/io";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Pecha } from "@/components/ui/shadimport";
import { Button } from "@/components/ui/atoms/button";
import AuthButton from "@/components/ui/molecules/auth-button/AuthButton";
import { getApiErrorMessage } from "@/lib/apiErrors";
import { useUserInfo } from "@/hooks/useUserInfo";
import { canManageTimerAudios } from "@/lib/platformAccess";
import {
  createTimerAudioPreset,
  deleteTimerAudioPreset,
  fetchTimerAudioPresets,
  updateTimerAudioPreset,
  type TimerAudio,
} from "./api/timerAudiosApi";
import TimerAudiosTable from "./TimerAudiosTable";
import TimerAudioFormDialog, {
  type TimerAudioFormPayload,
} from "./TimerAudioFormDialog";

const TimerAudiosPage = () => {
  const { data: userInfo } = useUserInfo();
  const canManage = canManageTimerAudios(userInfo?.platform_role);
  const [formOpen, setFormOpen] = useState(false);
  const [editingAudio, setEditingAudio] = useState<TimerAudio | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TimerAudio | null>(null);

  const queryClient = useQueryClient();

  const {
    data: audiosData,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["cms-timer-audios"],
    queryFn: fetchTimerAudioPresets,
    refetchOnWindowFocus: false,
    retry: false,
  });

  const audios = audiosData?.audios ?? [];

  const invalidateAudios = () => {
    queryClient.invalidateQueries({ queryKey: ["cms-timer-audios"] });
  };

  const createMutation = useMutation({
    mutationFn: createTimerAudioPreset,
    onSuccess: () => {
      toast.success("Preset added successfully");
      setFormOpen(false);
      invalidateAudios();
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: Parameters<typeof updateTimerAudioPreset>[1];
    }) => updateTimerAudioPreset(id, payload),
    onSuccess: () => {
      toast.success("Preset updated successfully");
      setFormOpen(false);
      setEditingAudio(null);
      invalidateAudios();
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteTimerAudioPreset,
    onSuccess: () => {
      toast.success("Preset deleted successfully");
      setDeleteTarget(null);
      invalidateAudios();
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  const handleOpenCreate = () => {
    setEditingAudio(null);
    setFormOpen(true);
  };

  const handleOpenEdit = (audio: TimerAudio) => {
    setEditingAudio(audio);
    setFormOpen(true);
  };

  const handleFormSubmit = (payload: TimerAudioFormPayload) => {
    if (editingAudio) {
      updateMutation.mutate({
        id: editingAudio.id,
        payload: {
          name: payload.name,
          audioFile: payload.audioFile ?? undefined,
          imageFile: payload.imageFile ?? undefined,
        },
      });
    } else {
      createMutation.mutate({
        name: payload.name,
        audioFile: payload.audioFile as File,
        imageFile: payload.imageFile,
      });
    }
  };

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="flex flex-col border h-[calc(100vh-40px)] overflow-auto bg-[#F5F5F5] dark:bg-[#181818] my-4 rounded-l-2xl font-dynamic">
      <div className="mb-4 px-4 pt-10 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <h1 className="text-xl font-semibold">Timer audio presets</h1>
          {canManage ? (
            <Button
              variant="outline"
              className="bg-gray-100 hover:bg-gray-200"
              onClick={handleOpenCreate}
            >
              <IoMdAdd /> Add preset
            </Button>
          ) : null}
        </div>
        <AuthButton />
      </div>

      <div className="border-b w-full border-dashed border-gray-300 dark:border-input" />

      <div className="px-4 pt-2">
        <p className="text-sm text-muted-foreground">
          Presets are offered to every user in the app. Audio that users upload
          for themselves is private to them and never appears here.
        </p>
      </div>

      <div className="px-4 pt-4 h-full flex flex-col items-center justify-between flex-1 min-h-0">
        {error ? (
          <p className="text-sm text-red-500 py-8">
            Failed to load timer audio presets. {getApiErrorMessage(error)}
          </p>
        ) : audios.length === 0 && !isLoading ? (
          <div className="flex flex-col h-full items-center justify-center">
            <p className="text-base text-muted-foreground">
              No timer audio presets found
            </p>
            {canManage ? (
              <Button
                variant="outline"
                className="mt-2"
                onClick={handleOpenCreate}
              >
                <IoMdAdd /> Add preset
              </Button>
            ) : null}
          </div>
        ) : (
          <div className="w-full flex-1 overflow-auto">
            <TimerAudiosTable
              audios={audios}
              isLoading={isLoading}
              canManage={canManage}
              onEdit={handleOpenEdit}
              onDelete={setDeleteTarget}
            />
          </div>
        )}
      </div>

      {canManage ? (
        <TimerAudioFormDialog
          open={formOpen}
          onOpenChange={(open) => {
            setFormOpen(open);
            if (!open) setEditingAudio(null);
          }}
          audio={editingAudio}
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
            <Pecha.AlertDialogTitle>Delete preset?</Pecha.AlertDialogTitle>
            <Pecha.AlertDialogDescription>
              This will permanently delete{" "}
              <strong>{deleteTarget?.name ?? ""}</strong>. Timers using it keep
              working, but lose their audio.
            </Pecha.AlertDialogDescription>
          </Pecha.AlertDialogHeader>
          <Pecha.AlertDialogFooter>
            <Pecha.AlertDialogCancel>Cancel</Pecha.AlertDialogCancel>
            <Pecha.AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => {
                if (deleteTarget) deleteMutation.mutate(deleteTarget.id);
              }}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Deleting…" : "Delete"}
            </Pecha.AlertDialogAction>
          </Pecha.AlertDialogFooter>
        </Pecha.AlertDialogContent>
      </Pecha.AlertDialog>
    </div>
  );
};

export default TimerAudiosPage;
