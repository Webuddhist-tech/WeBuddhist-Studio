import { useState } from "react";
import { useTranslate } from "@tolgee/react";
import { Pecha } from "@/components/ui/shadimport";
import { FiTrash } from "react-icons/fi";

interface TaskDeleteDialogProps {
  taskId: string;
  onDelete: (taskId: string) => void;
}

const TaskDeleteDialog = ({ taskId, onDelete }: TaskDeleteDialogProps) => {
  const { t } = useTranslate();
  const [open, setOpen] = useState(false);
  return (
    <Pecha.AlertDialog open={open} onOpenChange={setOpen}>
      <Pecha.AlertDialogTrigger asChild>
        <span
          onClick={(e) => {
            e.stopPropagation();
            setOpen(true);
          }}
          className="flex items-center gap-2 cursor-pointer w-full"
        >
          <FiTrash className="w-4 h-4" /> {t("studio.common.delete")}
        </span>
      </Pecha.AlertDialogTrigger>
      <Pecha.AlertDialogContent>
        <Pecha.AlertDialogHeader>
          <Pecha.AlertDialogTitle>
            {t("studio.common.are_you_sure")}
          </Pecha.AlertDialogTitle>
          <Pecha.AlertDialogDescription>
            {t("studio.modals.task_delete.description")}
          </Pecha.AlertDialogDescription>
        </Pecha.AlertDialogHeader>
        <Pecha.AlertDialogFooter>
          <Pecha.AlertDialogCancel onClick={() => setOpen(false)}>
            {t("studio.common.cancel")}
          </Pecha.AlertDialogCancel>
          <Pecha.AlertDialogAction
            className="bg-[#AD1B21] dark:text-white hover:bg-[#AD1B21]/90"
            onClick={() => {
              onDelete(taskId);
              setOpen(false);
            }}
          >
            {t("studio.modals.delete_task")}
          </Pecha.AlertDialogAction>
        </Pecha.AlertDialogFooter>
      </Pecha.AlertDialogContent>
    </Pecha.AlertDialog>
  );
};

export default TaskDeleteDialog;
