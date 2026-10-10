import { Pecha } from "@/components/ui/shadimport";
import { useTranslate } from "@tolgee/react";
import type { Control } from "react-hook-form";

interface TaskTitleFieldProps {
  isEditMode: boolean;
  isTitleEditing: boolean;
  formValue: string;
  control: Control<any>;
  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  disabled?: boolean;
}

export const TaskTitleField = ({
  isEditMode,
  isTitleEditing,
  formValue,
  control,
  onEdit,
  onSave,
  onCancel,
  disabled = false,
}: TaskTitleFieldProps) => {
  const { t } = useTranslate();
  if (isEditMode && !isTitleEditing) {
    return (
      <>
        <div className="h-12  text-base flex bg-white dark:bg-[#161616] items-center px-3 border opacity-80 rounded-md flex-1">
          {formValue}
        </div>
        <Pecha.Button
          variant="outline"
          type="button"
          onClick={onEdit}
          disabled={disabled === true}
        >
          {t("studio.common.edit")}
        </Pecha.Button>
      </>
    );
  }

  if (isEditMode && isTitleEditing) {
    return (
      <>
        <Pecha.FormField
          control={control}
          name="title"
          render={({ field }) => (
            <Pecha.FormItem className="flex-1">
              <Pecha.FormControl>
                <Pecha.Input
                  type="text"
                  placeholder={t("studio.molecules.task_title.placeholder")}
                  className="h-12 text-base bg-white dark:bg-[#161616]"
                  disabled={disabled}
                  {...field}
                />
              </Pecha.FormControl>
              <Pecha.FormMessage />
            </Pecha.FormItem>
          )}
        />
        <div className="flex gap-2">
          <Pecha.Button variant="outline" type="button" onClick={onSave}>
            {t("studio.common.save")}
          </Pecha.Button>
          <Pecha.Button variant="outline" type="button" onClick={onCancel}>
            {t("studio.common.cancel")}
          </Pecha.Button>
        </div>
      </>
    );
  }

  return (
    <Pecha.FormField
      control={control}
      name="title"
      render={({ field }) => (
        <Pecha.FormItem className="flex-1">
          <Pecha.FormControl>
            <Pecha.Input
              type="text"
              placeholder={t("studio.molecules.task_title.placeholder")}
              className="h-12 text-base bg-white dark:bg-[#161616]"
              disabled={disabled}
              {...field}
            />
          </Pecha.FormControl>
          <Pecha.FormMessage />
        </Pecha.FormItem>
      )}
    />
  );
};
