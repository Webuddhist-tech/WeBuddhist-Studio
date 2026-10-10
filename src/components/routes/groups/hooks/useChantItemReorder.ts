import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { tolgee } from "@/i18n/tolgee";
import { getApiErrorMessage } from "@/lib/apiErrors";
import { reorderArray } from "@/lib/utils";
import {
  reorderChantItems,
  type ChantCollectionItemDTO,
} from "../api/chantsApi";

const sortByDisplayOrder = (items: ChantCollectionItemDTO[]) =>
  [...items].sort((a, b) => a.display_order - b.display_order);

export const useChantItemReorder = (
  groupId: string | undefined,
  collectionId: string | undefined,
  items: ChantCollectionItemDTO[] | undefined,
  canWrite: boolean,
) => {
  const queryClient = useQueryClient();
  const [orderedItems, setOrderedItems] = useState<ChantCollectionItemDTO[]>(
    [],
  );

  useEffect(() => {
    if (items) {
      setOrderedItems(sortByDisplayOrder(items));
    }
  }, [items]);

  const reorderMutation = useMutation({
    mutationFn: (itemIds: string[]) =>
      reorderChantItems(groupId!, collectionId!, itemIds),
    onSuccess: (updated) => {
      queryClient.setQueryData(
        ["cms-chant-collection", groupId, collectionId],
        updated,
      );
      setOrderedItems(sortByDisplayOrder(updated.items));
    },
    onError: (err) => {
      if (items) {
        setOrderedItems(sortByDisplayOrder(items));
      }
      toast.error(tolgee.t("studio.groups.shared.chant_reorder_error"), {
        description: getApiErrorMessage(err),
      });
    },
  });

  const displayItems = orderedItems.length > 0 ? orderedItems : (items ?? []);
  const canReorder = canWrite && displayItems.length > 1;

  const handleReorder = (activeId: string, overId: string) => {
    if (!canReorder || activeId === overId) return;

    const next = reorderArray(displayItems, activeId, overId);
    if (!next) return;

    setOrderedItems(next);
    reorderMutation.mutate(next.map((item) => item.id));
  };

  return {
    displayItems,
    canReorder,
    handleReorder,
  };
};
