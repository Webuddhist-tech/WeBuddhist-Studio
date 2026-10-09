import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { FiLoader, FiSettings } from "react-icons/fi";
import { Pecha } from "@/components/ui/shadimport";
import {
  DEFAULT_TASK_SETTINGS,
  fetchTaskDetails,
  updateTaskSettings,
  type TaskSettings,
} from "@/components/routes/task/api/taskApi";
import {
  fetchTextRelationsForSources,
  type RelatedText,
} from "@/components/routes/task/api/textRelationsApi";
import { getApiErrorMessage } from "@/lib/apiErrors";

/** Radix Select cannot hold an empty value, so "no text" needs a stand-in. */
const NO_TEXT = "__none__";

interface DayTask {
  id: string;
  title?: string | null;
  settings?: Partial<TaskSettings> | null;
}

interface TaskSettingsDialogProps {
  planId: string;
  taskId: string;
  settings?: Partial<TaskSettings> | null;
  /** The tasks of the same day, to say which one loses live. */
  dayTasks?: DayTask[];
}

interface PanelSettingProps {
  id: string;
  label: string;
  isOpen: boolean;
  textId: string | null;
  options: RelatedText[];
  isLoading: boolean;
  hasSource: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onTextChange: (textId: string | null) => void;
}

const PanelSetting = ({
  id,
  label,
  isOpen,
  textId,
  options,
  isLoading,
  hasSource,
  onOpenChange,
  onTextChange,
}: PanelSettingProps) => {
  // Keep a saved choice selectable even when the list no longer offers it.
  const choices =
    textId && !options.some((option) => option.id === textId)
      ? [{ id: textId, title: textId, language: null }, ...options]
      : options;

  return (
    <div className="space-y-2 rounded-md border border-input p-3">
      <label
        htmlFor={`${id}-open`}
        className="flex items-center gap-2 text-sm font-medium cursor-pointer"
      >
        <Pecha.Checkbox
          id={`${id}-open`}
          checked={isOpen}
          onCheckedChange={(checked) => onOpenChange(checked === true)}
        />
        Open {label.toLowerCase()} by default
      </label>

      <Pecha.Select
        value={textId ?? NO_TEXT}
        onValueChange={(value) =>
          onTextChange(value === NO_TEXT ? null : value)
        }
        disabled={!isOpen}
      >
        <Pecha.SelectTrigger aria-label={`${label} text`} className="w-full">
          <Pecha.SelectValue />
        </Pecha.SelectTrigger>
        <Pecha.SelectContent>
          <Pecha.SelectItem value={NO_TEXT}>
            None (show the list)
          </Pecha.SelectItem>
          {choices.map((option) => (
            <Pecha.SelectItem key={option.id} value={option.id}>
              {option.title}
              {option.language && (
                <span className="ml-1 text-xs text-muted-foreground">
                  ({option.language})
                </span>
              )}
            </Pecha.SelectItem>
          ))}
        </Pecha.SelectContent>
      </Pecha.Select>

      {isOpen && (
        <p className="text-xs text-muted-foreground">
          {isLoading ? (
            <span className="flex items-center gap-1">
              <FiLoader className="w-3 h-3 animate-spin" /> Loading{" "}
              {label.toLowerCase()} list…
            </span>
          ) : !hasSource ? (
            `This task has no text to read ${label.toLowerCase()} from. The reader will show the list.`
          ) : options.length === 0 ? (
            `No ${label.toLowerCase()} found for this task's text. The reader will show the list.`
          ) : textId ? (
            `The reader opens this ${label.toLowerCase()}.`
          ) : (
            `The reader shows the list without opening one.`
          )}
        </p>
      )}
    </div>
  );
};

const TaskSettingsDialog = ({
  planId,
  taskId,
  settings,
  dayTasks = [],
}: TaskSettingsDialogProps) => {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<TaskSettings>({
    ...DEFAULT_TASK_SETTINGS,
    ...settings,
  });
  const queryClient = useQueryClient();

  // Start every opening from what is saved, not from an abandoned edit.
  useEffect(() => {
    if (open) setDraft({ ...DEFAULT_TASK_SETTINGS, ...settings });
  }, [open, settings]);

  const { data: taskDetails, isLoading: isTaskLoading } = useQuery({
    queryKey: ["taskDetails", taskId],
    queryFn: () => fetchTaskDetails(taskId),
    enabled: open,
  });

  const sourceTextIds = useMemo<string[]>(
    () =>
      [
        ...new Set<string>(
          (taskDetails?.subtasks ?? [])
            .map((subtask: { source_text_id?: string | null }) =>
              subtask.source_text_id?.trim(),
            )
            .filter(Boolean),
        ),
      ].sort(),
    [taskDetails],
  );

  const { data: relations, isLoading: isRelationsLoading } = useQuery({
    queryKey: ["textRelations", sourceTextIds],
    queryFn: () => fetchTextRelationsForSources(sourceTextIds),
    enabled: open && sourceTextIds.length > 0,
    staleTime: 5 * 60 * 1000,
  });

  const isListLoading =
    isTaskLoading || (sourceTextIds.length > 0 && isRelationsLoading);

  const otherLiveTask = dayTasks.find(
    (task) => task.id !== taskId && task.settings?.is_live,
  );

  const saveMutation = useMutation({
    mutationFn: () => updateTaskSettings(taskId, draft),
    onSuccess: () => {
      toast.success("Task settings saved");
      queryClient.invalidateQueries({ queryKey: ["planDetails", planId] });
      queryClient.invalidateQueries({ queryKey: ["taskDetails", taskId] });
      setOpen(false);
    },
    onError: (error: unknown) => {
      toast.error("Failed to save task settings", {
        description: getApiErrorMessage(error),
      });
    },
  });

  const update = (patch: Partial<TaskSettings>) =>
    setDraft((current) => ({ ...current, ...patch }));

  return (
    <>
      <span
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        className="flex items-center gap-2 cursor-pointer w-full"
      >
        <FiSettings className="w-4 h-4" /> Settings
      </span>

      <Pecha.Dialog open={open} onOpenChange={setOpen}>
        <Pecha.DialogContent className="sm:max-w-lg">
          <Pecha.DialogHeader>
            <Pecha.DialogTitle>Task settings</Pecha.DialogTitle>
          </Pecha.DialogHeader>

          <div className="space-y-3">
            <PanelSetting
              id={`task-${taskId}-commentary`}
              label="Commentary"
              isOpen={draft.is_commentary_open}
              textId={draft.commentary_text_id}
              options={relations?.commentaries ?? []}
              isLoading={isListLoading}
              hasSource={sourceTextIds.length > 0}
              onOpenChange={(isOpen) => update({ is_commentary_open: isOpen })}
              onTextChange={(textId) => update({ commentary_text_id: textId })}
            />
            <PanelSetting
              id={`task-${taskId}-translation`}
              label="Translation"
              isOpen={draft.is_translation_open}
              textId={draft.translation_text_id}
              options={relations?.translations ?? []}
              isLoading={isListLoading}
              hasSource={sourceTextIds.length > 0}
              onOpenChange={(isOpen) => update({ is_translation_open: isOpen })}
              onTextChange={(textId) => update({ translation_text_id: textId })}
            />

            <div className="space-y-1 rounded-md border border-input p-3">
              <label
                htmlFor={`task-${taskId}-live`}
                className="flex items-center gap-2 text-sm font-medium cursor-pointer"
              >
                <Pecha.Checkbox
                  id={`task-${taskId}-live`}
                  checked={draft.is_live}
                  onCheckedChange={(checked) =>
                    update({ is_live: checked === true })
                  }
                />
                Live
              </label>
              <p className="text-xs text-muted-foreground">
                {draft.is_live && otherLiveTask
                  ? `This will turn off live for "${otherLiveTask.title || "another task"}" on this day.`
                  : "Only one task per day can be live."}
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Pecha.Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={saveMutation.isPending}
            >
              Cancel
            </Pecha.Button>
            <Pecha.Button
              type="button"
              className="bg-[#A51C21] hover:bg-[#A51C21]/90"
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending && (
                <FiLoader className="w-4 h-4 animate-spin" />
              )}
              Save
            </Pecha.Button>
          </div>
        </Pecha.DialogContent>
      </Pecha.Dialog>
    </>
  );
};

export default TaskSettingsDialog;
