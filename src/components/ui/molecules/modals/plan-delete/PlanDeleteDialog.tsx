import { Pecha } from "@/components/ui/shadimport";
import { IoMdTrash } from "react-icons/io";
import { useState } from "react";
import { useTranslate } from "@tolgee/react";

interface PlanDeleteDialogProps {
  id: string;
  onDelete: (id: string) => void;
  trigger?: React.ReactNode;
  /** Legacy English label ("Plan" / "Series"); prefer `entityType`. */
  entityLabel?: string;
  entityType?: "plan" | "series";
}

const PlanDeleteDialog = ({
  id,
  onDelete,
  trigger,
  entityLabel = "Plan",
  entityType,
}: PlanDeleteDialogProps) => {
  const { t } = useTranslate();
  const [open, setOpen] = useState(false);
  const isSeries =
    entityType === "series" ||
    (!entityType && entityLabel.toLowerCase() === "series");
  const deleteLabel = isSeries
    ? t("studio.modals.delete_series")
    : t("studio.modals.delete_plan");

  const handleDelete = () => {
    onDelete(id);
    setOpen(false);
  };

  return (
    <Pecha.AlertDialog open={open} onOpenChange={setOpen}>
      <Pecha.AlertDialogTrigger asChild>
        {trigger || (
          <span
            onClick={(e) => {
              e.stopPropagation();
              setOpen(true);
            }}
            className="flex items-center gap-2 cursor-pointer w-full"
          >
            <IoMdTrash className="w-4 h-4" /> {deleteLabel}
          </span>
        )}
      </Pecha.AlertDialogTrigger>
      <Pecha.AlertDialogContent>
        <Pecha.AlertDialogHeader>
          <Pecha.AlertDialogTitle>
            {t("studio.common.are_you_sure")}
          </Pecha.AlertDialogTitle>
          <Pecha.AlertDialogDescription>
            {isSeries
              ? t("studio.modals.plan_delete.description_series")
              : t("studio.modals.plan_delete.description_plan")}
          </Pecha.AlertDialogDescription>
        </Pecha.AlertDialogHeader>
        <Pecha.AlertDialogFooter>
          <Pecha.AlertDialogCancel onClick={() => setOpen(false)}>
            {t("studio.common.cancel")}
          </Pecha.AlertDialogCancel>
          <Pecha.AlertDialogAction
            className="bg-[#AD1B21] dark:text-white hover:bg-[#AD1B21]/90"
            onClick={handleDelete}
          >
            {deleteLabel}
          </Pecha.AlertDialogAction>
        </Pecha.AlertDialogFooter>
      </Pecha.AlertDialogContent>
    </Pecha.AlertDialog>
  );
};

export default PlanDeleteDialog;
