import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getApiErrorMessage } from "@/lib/apiErrors";
import { reorderArray } from "@/lib/utils";
import { updateAmbientSound, type AmbientSound } from "../api/ambientSoundsApi";

const sortByDisplayOrder = (sounds: AmbientSound[]) =>
  [...sounds].sort((a, b) => a.display_order - b.display_order);

export const useAmbientSoundReorder = (
  sounds: AmbientSound[] | undefined,
  canManage: boolean,
) => {
  const queryClient = useQueryClient();
  const [orderedSounds, setOrderedSounds] = useState<AmbientSound[]>([]);

  useEffect(() => {
    if (sounds) {
      setOrderedSounds(sortByDisplayOrder(sounds));
    }
  }, [sounds]);

  const reconcileWithServer = () => {
    // Re-fetch rather than trusting any local snapshot: with no bulk
    // reorder endpoint, a "failed" attempt can still have partially applied
    // on the server (some of its per-row PUTs may have succeeded before one
    // failed), so the only source of truth afterward is the server itself.
    queryClient.invalidateQueries({ queryKey: ["cms-ambient-sounds"] });
  };

  const reorderMutation = useMutation({
    mutationFn: async (next: AmbientSound[]) => {
      // No bulk reorder endpoint exists - persist only the rows whose
      // position actually changed. Sequential, not Promise.all: this keeps
      // a failure's blast radius predictable (everything up to the failed
      // row is known to have been applied) instead of firing every PUT at
      // once and losing track of which ones landed.
      const updates = next
        .map((sound, index) => ({ sound, index }))
        .filter(({ sound, index }) => sound.display_order !== index);

      for (const { sound, index } of updates) {
        await updateAmbientSound(sound.id, { displayOrder: index });
      }
    },
    onSuccess: reconcileWithServer,
    onError: (err) => {
      toast.error("Failed to reorder sounds", {
        description: getApiErrorMessage(err),
      });
      reconcileWithServer();
    },
  });

  const displaySounds =
    orderedSounds.length > 0 ? orderedSounds : (sounds ?? []);
  // Serialized: block new drags while one reorder is still persisting, so
  // a second drag can't race the first's in-flight requests.
  const canReorder =
    canManage && displaySounds.length > 1 && !reorderMutation.isPending;

  const handleReorder = (activeId: string, overId: string) => {
    if (!canReorder || activeId === overId) return;

    const next = reorderArray(displaySounds, activeId, overId);
    if (!next) return;

    setOrderedSounds(next);
    reorderMutation.mutate(next);
  };

  return {
    displaySounds,
    canReorder,
    handleReorder,
  };
};
