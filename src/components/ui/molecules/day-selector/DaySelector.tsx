import { Pecha } from "@/components/ui/shadimport";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { toast } from "sonner";
import { useTranslate } from "@tolgee/react";
import { ChangeTaskDay } from "@/components/routes/task/api/taskApi";

interface DaySelectorProps {
  selectedDay: number;
  taskId: string;
}

const DaySelector = ({ selectedDay, taskId }: DaySelectorProps) => {
  const { t } = useTranslate();
  const queryClient = useQueryClient();
  const { planId } = useParams<{ planId: string }>();

  const currentPlan = queryClient.getQueryData<any>(["planDetails", planId]);
  const days = currentPlan?.days || [];

  const changeTaskDayMutation = useMutation({
    mutationFn: async (target_day_id: string) => {
      return await ChangeTaskDay(taskId, target_day_id);
    },
    onSuccess: () => {
      toast.success(t("studio.molecules.day_selector.moved"), {
        description: t("studio.molecules.day_selector.moved_description"),
      });
      queryClient.invalidateQueries({ queryKey: ["planDetails", planId] });
      queryClient.invalidateQueries({ queryKey: ["taskDetails", taskId] });
    },
    onError: (error: any) => {
      toast.error(t("studio.molecules.day_selector.move_failed"), {
        description: error?.message || t("studio.common.something_went_wrong"),
      });
    },
  });

  const handleDayChange = (value: string) => {
    changeTaskDayMutation.mutate(value);
  };

  return (
    <div>
      <Pecha.Select onValueChange={handleDayChange}>
        <Pecha.SelectTrigger className="bg-white dark:bg-[#161616] w-32">
          <Pecha.SelectValue
            className="bg-white dark:bg-[#161616]"
            placeholder={t("studio.day_audio.day_label", {
              number: selectedDay,
            })}
          />
        </Pecha.SelectTrigger>
        <Pecha.SelectContent>
          <Pecha.SelectGroup>
            <Pecha.SelectLabel>
              {t("studio.molecules.day_selector.days")}
            </Pecha.SelectLabel>
            {days.map((day: any) => (
              <Pecha.SelectItem
                disabled={day.day_number === selectedDay}
                key={day.id}
                value={day.id}
                className="cursor-pointer"
              >
                {t("studio.day_audio.day_label", { number: day.day_number })}
              </Pecha.SelectItem>
            ))}
          </Pecha.SelectGroup>
        </Pecha.SelectContent>
      </Pecha.Select>
    </div>
  );
};

export default DaySelector;
