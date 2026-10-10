import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTranslate } from "@tolgee/react";
import type { UniqueIdentifier } from "@dnd-kit/core";
import { reorderSubtasks } from "../api/taskApi";
import { reorderArray } from "@/lib/utils";

interface Subtask {
  id: string;
  display_order: number;
  [key: string]: any;
}

interface TaskDetails {
  subtasks: Subtask[];
  [key: string]: any;
}

export const useSubtaskReorder = (
  taskDetails: TaskDetails | undefined,
  task_id: string | undefined,
) => {
  const [optimisticSubtasks, setOptimisticSubtasks] = useState<Subtask[]>([]);
  const queryClient = useQueryClient();
  const { t } = useTranslate();

  useEffect(() => {
    if (taskDetails?.subtasks) {
      const sortedSubtasks = [...taskDetails.subtasks].sort(
        (a, b) => a.display_order - b.display_order,
      );
      setOptimisticSubtasks(sortedSubtasks);
    }
  }, [taskDetails]);

  const reorderMutation = useMutation({
    mutationFn: ({
      taskId,
      subtasks,
    }: {
      taskId: string;
      subtasks: Array<{ id: string; display_order: number }>;
    }) => reorderSubtasks(taskId, subtasks),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["taskDetails", task_id] });
    },
    onError: () => {
      if (taskDetails?.subtasks) {
        const originalSubtasks = [...taskDetails.subtasks].sort(
          (a, b) => a.display_order - b.display_order,
        );
        setOptimisticSubtasks(originalSubtasks);
      }
      toast.error(t("studio.task.mutations.reorder_subtasks_failed"), {
        description: t("studio.common.something_went_wrong"),
      });
      queryClient.refetchQueries({ queryKey: ["taskDetails", task_id] });
    },
  });

  const handleSubtaskReorder = (
    activeId: UniqueIdentifier,
    overId: UniqueIdentifier,
  ) => {
    const activeSubtaskId = String(activeId);
    const overSubtaskId = String(overId);

    if (activeSubtaskId === overSubtaskId) return;

    const currentSubtasks =
      optimisticSubtasks.length > 0
        ? optimisticSubtasks
        : [...(taskDetails?.subtasks || [])].sort(
            (a, b) => a.display_order - b.display_order,
          );

    const newSubtasks = reorderArray(
      currentSubtasks,
      activeSubtaskId,
      overSubtaskId,
    );

    if (!newSubtasks) return;

    setOptimisticSubtasks(newSubtasks);

    const subtasksPayload = newSubtasks.map((subtask, index) => ({
      id: subtask.id,
      display_order: index + 1,
    }));

    if (task_id) {
      reorderMutation.mutate({
        taskId: task_id,
        subtasks: subtasksPayload,
      });
    }
  };

  const getDisplaySubtasks = (): Subtask[] => {
    if (optimisticSubtasks.length > 0) {
      return optimisticSubtasks;
    }
    return [...(taskDetails?.subtasks || [])].sort(
      (a, b) => a.display_order - b.display_order,
    );
  };

  return {
    handleSubtaskReorder,
    getDisplaySubtasks,
  };
};
