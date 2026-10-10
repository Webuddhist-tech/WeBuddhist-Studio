import { useState } from "react";
import { useTranslate } from "@tolgee/react";
import { Pecha } from "@/components/ui/shadimport";
import { IoMdAdd } from "react-icons/io";

interface DayAddDialogProps {
  onAdd: () => void;
  isPending?: boolean;
  disabled?: boolean;
}

const DayAddDialog = ({ onAdd, isPending, disabled }: DayAddDialogProps) => {
  const { t } = useTranslate();
  const [open, setOpen] = useState(false);

  const handleAdd = () => {
    onAdd();
    setOpen(false);
  };

  return (
    <Pecha.AlertDialog open={open} onOpenChange={setOpen}>
      <Pecha.AlertDialogTrigger asChild>
        <Pecha.Button
          type="button"
          disabled={disabled || isPending}
          variant="destructive"
          className="cursor-pointer w-full disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={(e) => {
            e.stopPropagation();
            if (!disabled && !isPending) {
              setOpen(true);
            }
          }}
        >
          <IoMdAdd className="w-4 h-4" />
          <span className="text-sm font-medium">
            {isPending
              ? t("studio.modals.day_add.adding")
              : t("studio.modals.day_add.add_new_day")}
          </span>
        </Pecha.Button>
      </Pecha.AlertDialogTrigger>
      <Pecha.AlertDialogContent>
        <Pecha.AlertDialogHeader>
          <Pecha.AlertDialogTitle>
            {t("studio.modals.day_add.add_new_day")}
          </Pecha.AlertDialogTitle>
          <Pecha.AlertDialogDescription>
            {t("studio.modals.day_add.description")}
          </Pecha.AlertDialogDescription>
        </Pecha.AlertDialogHeader>
        <Pecha.AlertDialogFooter>
          <Pecha.AlertDialogCancel onClick={() => setOpen(false)}>
            {t("studio.common.cancel")}
          </Pecha.AlertDialogCancel>
          <Pecha.AlertDialogAction
            onClick={handleAdd}
            disabled={isPending}
            className="bg-[#AD1B21] dark:text-white hover:bg-[#AD1B21]/90"
          >
            {isPending
              ? t("studio.modals.day_add.adding")
              : t("studio.modals.day_add.add_day")}
          </Pecha.AlertDialogAction>
        </Pecha.AlertDialogFooter>
      </Pecha.AlertDialogContent>
    </Pecha.AlertDialog>
  );
};

export default DayAddDialog;
