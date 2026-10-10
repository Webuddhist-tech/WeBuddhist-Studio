import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTranslate } from "@tolgee/react";
import type { UniqueIdentifier } from "@dnd-kit/core";
import { reorderDays } from "../api/planApi";
import { reorderArray } from "@/lib/utils";

interface Day {
  id: string;
  day_number: number;
  [key: string]: any;
}

interface Plan {
  days: Day[];
  [key: string]: any;
}

export const useDayReorder = (
  currentPlan: Plan | undefined,
  plan_id: string | undefined,
) => {
  const [optimisticDays, setOptimisticDays] = useState<Day[]>([]);
  const queryClient = useQueryClient();
  const { t } = useTranslate();

  useEffect(() => {
    if (currentPlan?.days) {
      const sortedDays = [...currentPlan.days].sort(
        (a, b) => a.day_number - b.day_number,
      );
      setOptimisticDays(sortedDays);
    }
  }, [currentPlan]);

  const reorderMutation = useMutation({
    mutationFn: ({
      planId,
      days,
    }: {
      planId: string;
      days: Array<{ id: string; day_number: number }>;
    }) => reorderDays(planId, days),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["planDetails", plan_id] });
    },
    onError: () => {
      if (currentPlan?.days) {
        const originalDays = [...currentPlan.days].sort(
          (a, b) => a.day_number - b.day_number,
        );
        setOptimisticDays(originalDays);
      }
      toast.error(t("studio.task.mutations.reorder_days_failed"), {
        description: t("studio.common.something_went_wrong"),
      });
      queryClient.refetchQueries({ queryKey: ["planDetails", plan_id] });
    },
  });

  const handleDayReorder = (
    activeId: UniqueIdentifier,
    overId: UniqueIdentifier,
  ) => {
    const activeDayId = String(activeId);
    const overDayId = String(overId);

    if (activeDayId === overDayId) return;

    const currentDays =
      optimisticDays.length > 0
        ? optimisticDays
        : [...(currentPlan?.days || [])].sort(
            (a, b) => a.day_number - b.day_number,
          );

    const newDays = reorderArray(currentDays, activeDayId, overDayId);

    if (!newDays) return;

    setOptimisticDays(newDays);

    const daysPayload = newDays.map((day, index) => ({
      id: day.id,
      day_number: index + 1,
    }));

    if (plan_id) {
      reorderMutation.mutate({
        planId: plan_id,
        days: daysPayload,
      });
    }
  };

  const getDisplayDays = (): Day[] => {
    if (optimisticDays.length > 0) {
      return optimisticDays;
    }
    return [...(currentPlan?.days || [])].sort(
      (a, b) => a.day_number - b.day_number,
    );
  };

  return {
    handleDayReorder,
    getDisplayDays,
  };
};
