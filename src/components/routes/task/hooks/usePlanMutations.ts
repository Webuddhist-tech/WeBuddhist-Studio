import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTranslate } from "@tolgee/react";
import {
  createNewDays,
  deleteDays,
  deleteTask,
  type CreateDaysRequest,
} from "../api/planApi";
import { getApiErrorMessage } from "@/lib/apiErrors";

export const PLAN_DAYS_OVERLAP_NEXT_PLAN_CODE = "PLAN_DAYS_OVERLAP_NEXT_PLAN";

export const usePlanMutations = (plan_id: string | undefined) => {
  const queryClient = useQueryClient();
  const { t } = useTranslate();

  const deleteTaskMutation = useMutation({
    mutationFn: (task_id: string) => deleteTask(task_id),
    onSuccess: () => {
      toast.success(t("studio.task.mutations.task_deleted"), {
        description: t("studio.task.mutations.task_deleted_description"),
      });
      queryClient.refetchQueries({ queryKey: ["planDetails", plan_id] });
    },
    onError: (error: any) => {
      toast.error(t("studio.task.mutations.task_delete_failed"), {
        description:
          error.response?.data?.detail?.message ||
          t("studio.common.something_went_wrong"),
      });
    },
  });

  const deleteDaysMutation = useMutation({
    mutationFn: (day_ids: string[]) => deleteDays(plan_id!, day_ids),
    onSuccess: (_data, day_ids) => {
      const count = day_ids.length;
      toast.success(
        count === 1
          ? t("studio.task.mutations.day_deleted_one")
          : t("studio.task.mutations.day_deleted_other", { count }),
        { description: t("studio.task.mutations.days_renumbered") },
      );
      queryClient.refetchQueries({ queryKey: ["planDetails", plan_id] });
    },
    onError: (error: any) => {
      toast.error(t("studio.task.mutations.day_delete_failed"), {
        description: getApiErrorMessage(error),
      });
    },
  });

  const createNewDaysMutation = useMutation({
    mutationFn: (body?: CreateDaysRequest) => createNewDays(plan_id!, body),
    onError: (error: any) => {
      // The overlap case is handled by the caller, which offers to shift the
      // rest of the series forward instead of showing a dead-end error.
      if (
        error?.response?.data?.detail?.code === PLAN_DAYS_OVERLAP_NEXT_PLAN_CODE
      ) {
        return;
      }
      toast.error(t("studio.task.mutations.days_create_failed"), {
        description: getApiErrorMessage(error),
      });
    },
  });

  return {
    deleteTask: deleteTaskMutation,
    deleteDay: deleteDaysMutation,
    createNewDay: createNewDaysMutation,
  };
};
