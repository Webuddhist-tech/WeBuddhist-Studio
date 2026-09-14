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

  const reorderMutation = useMutation({
    mutationFn: async (next: AmbientSound[]) => {
      // No bulk reorder endpoint exists - persist only the rows whose
      // position actually changed, one PUT each.
      const updates = next
        .map((sound, index) => ({ sound, index }))
        .filter(({ sound, index }) => sound.display_order !== index);

      await Promise.all(
        updates.map(({ sound, index }) =>
          updateAmbientSound(sound.id, { displayOrder: index }),
        ),
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cms-ambient-sounds"] });
    },
    onError: (err) => {
      if (sounds) {
        setOrderedSounds(sortByDisplayOrder(sounds));
      }
      toast.error("Failed to reorder sounds", {
        description: getApiErrorMessage(err),
      });
    },
  });

  const displaySounds =
    orderedSounds.length > 0 ? orderedSounds : (sounds ?? []);
  const canReorder = canManage && displaySounds.length > 1;

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
