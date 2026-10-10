import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTranslate } from "@tolgee/react";
import type { UniqueIdentifier } from "@dnd-kit/core";
import { reorderTasks } from "../api/taskApi";
import { reorderArray } from "@/lib/utils";

interface Task {
  id: string;
  display_order: number;
  [key: string]: any;
}

interface Day {
  id: string;
  tasks: Task[];
  [key: string]: any;
}

interface Plan {
  days: Day[];
  [key: string]: any;
}

export const useTaskReorder = (
  currentPlan: Plan | undefined,
  plan_id: string | undefined,
) => {
  const [optimisticTasks, setOptimisticTasks] = useState<{
    [dayId: string]: Task[];
  }>({});
  const queryClient = useQueryClient();
  const { t } = useTranslate();

  // Initialize optimistic tasks when plan loads
  useEffect(() => {
    if (currentPlan?.days) {
      const initialTasks: { [dayId: string]: Task[] } = {};
      currentPlan.days.forEach((day: Day) => {
        initialTasks[day.id] = [...day.tasks].sort(
          (a, b) => a.display_order - b.display_order,
        );
      });
      setOptimisticTasks(initialTasks);
    }
  }, [currentPlan]);

  const reorderMutation = useMutation({
    mutationFn: ({
      dayId,
      tasks,
    }: {
      dayId: string;
      tasks: Array<{ id: string; display_order: number }>;
    }) => reorderTasks(dayId, tasks),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["planDetails", plan_id] });
    },
    onError: () => {
      toast.error(t("studio.task.mutations.reorder_tasks_failed"), {
        description: t("studio.common.something_went_wrong"),
      });
      queryClient.refetchQueries({ queryKey: ["planDetails", plan_id] });
    },
  });

  //logic is ai generated so might be messy to review
  const handleTaskReorder = (
    activeId: UniqueIdentifier,
    overId: UniqueIdentifier,
  ) => {
    const activeTaskId = String(activeId);
    const overTaskId = String(overId);

    if (activeTaskId === overTaskId) return;

    const dayContainingActiveTask = currentPlan?.days.find((day: Day) =>
      day.tasks.some((task: Task) => task.id === activeTaskId),
    );

    if (!dayContainingActiveTask) return;

    const dayId = dayContainingActiveTask.id;
    const currentTasks =
      optimisticTasks[dayId] ||
      [...dayContainingActiveTask.tasks].sort(
        (a, b) => a.display_order - b.display_order,
      );

    const newTasks = reorderArray(currentTasks, activeTaskId, overTaskId);

    if (!newTasks) return;

    setOptimisticTasks((prev) => ({
      ...prev,
      [dayId]: newTasks,
    }));

    const tasksPayload = newTasks.map((task, index) => ({
      id: task.id,
      display_order: index + 1,
    }));

    reorderMutation.mutate({
      dayId,
      tasks: tasksPayload,
    });
  };

  const getDisplayTasks = (day: Day): Task[] => {
    if (optimisticTasks[day.id]) {
      return optimisticTasks[day.id];
    }
    return [...day.tasks].sort((a, b) => a.display_order - b.display_order);
  };

  return {
    handleTaskReorder,
    getDisplayTasks,
  };
};
