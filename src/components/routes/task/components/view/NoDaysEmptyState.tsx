import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { IoCalendarClearOutline } from "react-icons/io5";
import DayCreateDialog from "@/components/ui/molecules/modals/day-create/DayCreateDialog";
import {
  usePlanMutations,
  PLAN_DAYS_OVERLAP_NEXT_PLAN_CODE,
} from "../../hooks/usePlanMutations";
import type { CreateDaysRequest } from "../../api/planApi";

interface NoDaysEmptyStateProps {
  planId?: string;
  isEditable?: boolean;
}

/**
 * Shown instead of the task editor while a plan has no days. A task belongs to
 * a day, so without one there is nothing a subtask could be saved against —
 * this says so up front rather than letting the form be filled in and fail.
 */
const NoDaysEmptyState = ({
  planId,
  isEditable = true,
}: NoDaysEmptyStateProps) => {
  const queryClient = useQueryClient();
  const { createNewDay } = usePlanMutations(planId);

  const handleCreateDays = (req: CreateDaysRequest) => {
    createNewDay.mutate(req, {
      onSuccess: () => {
        queryClient.refetchQueries({ queryKey: ["planDetails", planId] });
      },
      onError: (error: any) => {
        // Shifting the rest of a series forward is offered by the sidebar's
        // own Add Day flow, which owns that prompt.
        if (
          error?.response?.data?.detail?.code ===
          PLAN_DAYS_OVERLAP_NEXT_PLAN_CODE
        ) {
          toast.error("These days overlap the next plan in the series", {
            description:
              "Use Add New Day in the sidebar to shift the following plans.",
          });
        }
      },
    });
  };

  return (
    <div className="w-full my-4 h-[calc(100vh-40px)] bg-[#F5F5F5] dark:bg-[#181818] rounded-l-2xl border border-dashed flex items-center justify-center">
      <div className="max-w-sm px-6 text-center space-y-3">
        <IoCalendarClearOutline className="w-10 h-10 mx-auto text-muted-foreground" />
        <h2 className="text-xl font-semibold">This plan has no days yet</h2>
        <p className="text-sm text-muted-foreground">
          Tasks and subtasks belong to a day. Create the first day to start
          adding them.
        </p>
        {isEditable && (
          <div className="pt-2">
            <DayCreateDialog
              isPending={createNewDay.isPending}
              onSubmit={handleCreateDays}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default NoDaysEmptyState;
