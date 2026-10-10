import { useTranslate } from "@tolgee/react";
import { Pecha } from "@/components/ui/shadimport";
import PoemForm from "./PoemForm";
import type { PoemItem } from "./api/poemApi";

interface PoemFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingItem: PoemItem | null;
  onSuccess: () => void;
}

const PoemFormDialog = ({
  open,
  onOpenChange,
  editingItem,
  onSuccess,
}: PoemFormDialogProps) => {
  const { t } = useTranslate();
  const mode = editingItem ? "edit" : "create";

  const handleCancel = () => {
    onOpenChange(false);
  };

  return (
    <Pecha.Dialog open={open} onOpenChange={onOpenChange}>
      <Pecha.DialogContent className="flex max-h-[min(90dvh,90vh)] w-[calc(100%-2rem)] max-w-[1100px] flex-col gap-0 overflow-hidden p-0 sm:w-full">
        <Pecha.DialogHeader className="shrink-0 border-b px-6 py-4">
          <Pecha.DialogTitle>
            {mode === "edit"
              ? t("studio.poems.form.edit_title")
              : t("studio.poems.form.create_title")}
          </Pecha.DialogTitle>
        </Pecha.DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          <PoemForm
            mode={mode}
            initialData={editingItem || undefined}
            onSuccess={onSuccess}
            onCancel={handleCancel}
          />
        </div>
      </Pecha.DialogContent>
    </Pecha.Dialog>
  );
};

export default PoemFormDialog;
