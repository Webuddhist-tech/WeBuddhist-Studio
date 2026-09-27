import { useState, useEffect, Activity } from "react";
import { Pecha } from "@/components/ui/shadimport";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { toast } from "sonner";
import { taskSchema } from "@/schema/TaskSchema";
import { TaskTitleField } from "../../../../ui/molecules/task-title-field/TaskTitleField";
import {
  createTask,
  uploadImageToS3,
  createSubTasks,
  updateSubTasks,
  fetchTaskDetails,
  updateTaskTitle,
  type SubTaskPayload,
  type SubTaskUpdatePayload,
} from "../../api/taskApi";
import { ContentTypeSelector } from "@/components/ui/molecules/content-sub/ContentTypeSelector";
import {
  isLinkedContentType,
  type LinkedContentOption,
} from "@/components/ui/molecules/linked-content/linkedContent";
import {
  SubTaskCard,
  type SubTask,
} from "@/components/ui/molecules/subtask-card/SubTaskCard";
import {
  buildSubTaskPayload,
  buildSubTaskUpdatePayload,
} from "@/components/ui/molecules/subtask-card/subtaskPayload";
import DaySelector from "@/components/ui/molecules/day-selector/DaySelector";
import {
  mapApiSubtaskTimestamps,
  validateSubTaskTimestamps,
} from "@/components/ui/molecules/subtask-card/subtaskTimestamps";
import { EditorTabSwitcher } from "./EditorTabSwitcher";
import { NotificationForm } from "./NotificationForm";

interface TaskFormProps {
  selectedDay: number;
  editingTask?: any;
  onCancel: (newlyCreatedTaskId?: string) => void;
  isEditable?: boolean;
}

type TaskFormData = z.infer<typeof taskSchema>;

const TaskForm = ({
  selectedDay,
  editingTask,
  onCancel,
  isEditable = true,
}: TaskFormProps) => {
  const { planId } = useParams<{ planId: string }>();
  const queryClient = useQueryClient();
  const form = useForm({
    resolver: zodResolver(taskSchema),
    mode: "onTouched",
    defaultValues: {
      title: "",
    },
  });
  const [subTasks, setSubTasks] = useState<SubTask[]>([]);
  const [isTitleEditing, setIsTitleEditing] = useState(false);
  const formValues = form.watch();
  const isEditMode = Boolean(editingTask);
  const [imageUploadError, setImageUploadError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"task" | "notification">("task");

  const currentPlan = queryClient.getQueryData<any>(["planDetails", planId]);
  const currentDayData = currentPlan?.days?.find(
    (day: any) => day.day_number === selectedDay,
  );

  const { data: taskDetails } = useQuery({
    queryKey: ["taskDetails", editingTask?.id],
    queryFn: () => fetchTaskDetails(editingTask.id),
    enabled: !!editingTask?.id,
  });

  const createTaskMutation = useMutation({
    mutationFn: async ({
      taskData,
      subTasksData,
    }: {
      taskData: any;
      subTasksData: SubTask[];
    }) => {
      const taskResponse = await createTask(taskData);

      if (subTasksData.length > 0) {
        const subTasksPayload: SubTaskPayload[] =
          subTasksData.map(buildSubTaskPayload);
        await createSubTasks(taskResponse.id, subTasksPayload);
      }
      return taskResponse;
    },
    onSuccess: (taskResponse) => {
      toast.success("Task created successfully!", {
        description: "Your task has been added to the day.",
      });
      clearFormData(taskResponse.id);
      queryClient.refetchQueries({ queryKey: ["planDetails", planId] });
    },
    onError: (error: Error) => {
      toast.error("Failed to create task", {
        description: error?.message || "Something went wrong",
      });
    },
  });

  const updateTaskMutation = useMutation({
    mutationFn: async () => {
      const subTasksPayload: SubTaskUpdatePayload[] = subTasks.map(
        buildSubTaskUpdatePayload,
      );
      await updateSubTasks(editingTask.id, subTasksPayload);
    },
    onSuccess: () => {
      toast.success("Task updated successfully!");
      queryClient.invalidateQueries({ queryKey: ["planDetails", planId] });
      queryClient.invalidateQueries({
        queryKey: ["taskDetails", editingTask?.id],
      });
      clearFormData(editingTask?.id);
    },
    onError: (error: any) => {
      toast.error("Failed to update task", {
        description: error?.message || "Something went wrong",
      });
    },
  });

  const updateTitleMutation = useMutation({
    mutationFn: async (title: string) => {
      await updateTaskTitle(editingTask.id, title);
    },
    onSuccess: () => {
      toast.success("Title updated successfully!");
      setIsTitleEditing(false);
      queryClient.invalidateQueries({ queryKey: ["planDetails", planId] });
      queryClient.invalidateQueries({
        queryKey: ["taskDetails", editingTask?.id],
      });
    },
    onError: (error: any) => {
      toast.error("Failed to update title", {
        description: error?.message || "Something went wrong",
      });
    },
  });

  useEffect(() => {
    if (selectedDay && !isEditMode) {
      // Reset form when day changes (only in create mode, not edit mode)
      setSubTasks([]);
      form.reset();
    }
  }, [selectedDay, isEditMode, form]);

  useEffect(() => {
    if (editingTask && taskDetails) {
      form.setValue("title", editingTask.title);
      const sorted = [...taskDetails.subtasks].sort(
        (a: { display_order: number }, b: { display_order: number }) =>
          a.display_order - b.display_order,
      );
      const timestamps = (data: {
        start_ms?: number | null;
        end_ms?: number | null;
        audio_url?: string | null;
      }) => ({
        ...mapApiSubtaskTimestamps(data),
        audio_url: data.audio_url ?? null,
      });

      const subTasksData: SubTask[] = sorted.map((data: any) => {
        switch (data.content_type) {
          case "VIDEO":
            return {
              id: data.id,
              content_type: "VIDEO" as const,
              content: data.content,
              duration: data.duration,
              ...timestamps(data),
            };
          case "TEXT":
            return {
              id: data.id,
              content_type: "TEXT" as const,
              content: data.content,
              ...timestamps(data),
            };
          case "AUDIO":
            return {
              id: data.id,
              content_type: "AUDIO" as const,
              content: data.content,
              ...timestamps(data),
            };
          case "IMAGE":
            return {
              id: data.id,
              content_type: "IMAGE" as const,
              imagePreview: data.content,
              content: data.image_url,
              ...timestamps(data),
            };
          case "SOURCE_REFERENCE":
            return {
              id: data.id,
              content_type: "SOURCE_REFERENCE" as const,
              content: data.content,
              source_text_id: data.source_text_id || null,
              pecha_segment_id: data.pecha_segment_id || null,
              segment_ids: data.segment_ids || null,
              segment_numbers: data.segment_numbers || null,
              segment_refs: data.segment_refs || null,
              ...timestamps(data),
            };
          default:
            if (isLinkedContentType(data.content_type)) {
              return {
                id: data.id,
                content_type: data.content_type,
                content: data.content ?? "",
                reference_id: data.reference_id ?? null,
                reference: data.reference ?? null,
                ...timestamps(data),
              };
            }
            return {
              id: data.id,
              content_type: "TEXT" as const,
              content: data.content,
              ...timestamps(data),
            };
        }
      });
      setSubTasks(subTasksData);
    }
  }, [editingTask?.id, selectedDay, taskDetails?.id]);

  interface SourceData {
    content: string;
    pecha_segment_id: string;
    text_id: string;
    segment_ids: string[];
    segment_numbers?: number[];
  }

  const handleAddSubTask = (
    content_type: any,
    sourceData?: SourceData,
    linkedContent?: LinkedContentOption,
  ) => {
    let newSubTask: SubTask;

    if (isLinkedContentType(content_type)) {
      if (!linkedContent) return;
      setSubTasks([
        ...subTasks,
        {
          id: null,
          content_type,
          content: "",
          reference_id: linkedContent.id,
          reference: {
            id: linkedContent.id,
            content_type,
            title: linkedContent.title,
            subtitle: linkedContent.subtitle,
            image_url: linkedContent.imageUrl,
          },
        },
      ]);
      return;
    }

    switch (content_type) {
      case "VIDEO":
        newSubTask = {
          id: null,
          content_type: "VIDEO",
          content: "",
          duration: "",
        };
        break;
      case "TEXT":
        newSubTask = {
          id: null,
          content_type: "TEXT",
          content: "",
        };
        break;
      case "AUDIO":
        newSubTask = {
          id: null,
          content_type: "AUDIO",
          content: "",
        };
        break;
      case "IMAGE":
        newSubTask = {
          id: null,
          content_type: "IMAGE",
          imagePreview: null,
          content: null,
        };
        break;
      case "SOURCE_REFERENCE":
        newSubTask = {
          id: null,
          content_type: "SOURCE_REFERENCE",
          content: sourceData?.content || "",
          source_text_id: sourceData?.text_id || null,
          pecha_segment_id: sourceData?.pecha_segment_id || null,
          segment_ids: sourceData?.segment_ids || null,
          segment_numbers: sourceData?.segment_numbers || null,
        };
        break;
    }

    setSubTasks([...subTasks, newSubTask!]);
  };

  const updateSubTask = (index: number, updates: any) => {
    setSubTasks((prev) =>
      prev.map((task, i) => {
        if (i !== index) return task;
        return { ...task, ...updates } as SubTask;
      }),
    );
  };

  const removeSubTask = (index: number) => {
    setSubTasks((prev) => prev.filter((_, i) => i !== index));
    setImageUploadError(null);
  };

  const handleSubTaskImageUpload = async (index: number, file: File) => {
    const fileSizeMB = file.size / (1024 * 1024);
    if (fileSizeMB > 1) {
      setImageUploadError(
        "File size exceeds 1MB limit. Please select a smaller image.",
      );
      return;
    }
    try {
      const { image, key } = await uploadImageToS3(file, planId || "");
      updateSubTask(index, {
        imagePreview: image.original,
        content: key,
      });
      toast.success("Image uploaded successfully!");
    } catch {
      toast.error("Failed to upload image");
    }
  };

  const handleRemoveSubTaskImage = (index: number) => {
    updateSubTask(index, { imagePreview: null, content: null });
  };

  const handleSaveTitle = async () => {
    const currentTitle = form.getValues("title");
    if (!currentTitle || currentTitle.trim() === "") {
      toast.error("Title cannot be empty");
      return;
    }
    updateTitleMutation.mutate(currentTitle);
  };

  const clearFormData = (newlyCreatedTaskId?: string) => {
    setSubTasks([]);
    form.reset();
    onCancel(newlyCreatedTaskId);
  };

  const onSubmit = async (data: TaskFormData) => {
    // A task hangs off a day. Without one there is nothing to save against, so
    // say so instead of letting the request go out with an undefined day.
    if (!isEditMode && !currentDayData?.id) {
      toast.error("Create a day first", {
        description: "Add a day to this plan before adding a task.",
      });
      return;
    }

    const timestampError = validateSubTaskTimestamps(
      subTasks,
      currentDayData?.audio_duration_ms,
    );
    if (timestampError) {
      toast.error(timestampError);
      return;
    }

    const taskData: any = {
      plan_id: planId!,
      day_id: currentDayData?.id,
      title: data.title,
      estimated_time: 30,
    };
    if (isEditMode) {
      updateTaskMutation.mutate();
    } else {
      createTaskMutation.mutate({ taskData, subTasksData: subTasks });
    }
  };

  return (
    <div className="w-full my-4 h-[calc(100vh-40px)] bg-[#F5F5F5] dark:bg-[#181818] rounded-l-2xl border border-dashed overflow-hidden flex flex-col">
      <EditorTabSwitcher activeTab={activeTab} onTabChange={setActiveTab} />

      {activeTab === "notification" ? (
        <NotificationForm
          dayId={currentDayData?.id || ""}
          planId={planId || ""}
          planCoverImage={currentPlan?.cover_image}
          isEditable={isEditable}
        />
      ) : (
        <div className="overflow-y-auto flex-1">
          <h2 className="text-xl font-semibold p-4">
            {isEditMode ? "Edit Task" : "Add Task"}
          </h2>

          <Pecha.Form {...form}>
            <form className="space-y-6" onSubmit={form.handleSubmit(onSubmit)}>
              <div className="flex w-full p-4 lg:w-2/3 justify-between items-center gap-4">
                <TaskTitleField
                  isEditMode={isEditMode}
                  isTitleEditing={isTitleEditing}
                  formValue={formValues.title}
                  control={form.control}
                  onEdit={() => isEditable && setIsTitleEditing(true)}
                  onSave={handleSaveTitle}
                  onCancel={() => setIsTitleEditing(false)}
                  disabled={!isEditable}
                />
                {isEditMode && (
                  <DaySelector
                    selectedDay={selectedDay}
                    taskId={editingTask?.id}
                  />
                )}
              </div>

              <div className="border-b w-full border-dashed border-gray-300 dark:border-input" />
              <div className=" px-4 flex items-center">
                <h2 className="text-xl font-semibold">Add Subtask</h2>
              </div>

              {subTasks.length > 0 && (
                <div className="space-y-4 p-4 w-full lg:w-2/3">
                  {subTasks.map((subTask, index) => (
                    <SubTaskCard
                      key={index}
                      subTask={subTask}
                      index={index}
                      onUpdate={updateSubTask}
                      onRemove={removeSubTask}
                      onImageUpload={handleSubTaskImageUpload}
                      onRemoveImage={handleRemoveSubTaskImage}
                      dayAudioUrl={currentDayData?.audio_url}
                      dayAudioDurationMs={currentDayData?.audio_duration_ms}
                      planLanguage={currentPlan?.language}
                      taskId={editingTask?.id}
                    />
                  ))}
                </div>
              )}
              {imageUploadError && (
                <div className="text-red-500 text-sm ml-4">
                  {imageUploadError}
                </div>
              )}
              {isEditable && (
                <ContentTypeSelector
                  onSelectType={handleAddSubTask}
                  groupId={currentPlan?.group_id}
                />
              )}

              <div className="p-4 flex gap-3">
                <Activity mode={isEditMode ? "visible" : "hidden"}>
                  <Pecha.Button
                    variant="outline"
                    type="button"
                    onClick={() => clearFormData()}
                  >
                    Cancel
                  </Pecha.Button>
                </Activity>

                <Pecha.Button
                  variant="destructive"
                  className="cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  type="submit"
                  disabled={
                    !isEditable ||
                    createTaskMutation.isPending ||
                    updateTaskMutation.isPending ||
                    subTasks.length === 0 ||
                    (!isEditMode && !currentDayData?.id)
                  }
                >
                  {createTaskMutation.isPending || updateTaskMutation.isPending
                    ? isEditMode
                      ? "Updating..."
                      : "Creating..."
                    : isEditMode
                      ? "Update"
                      : "Submit"}
                </Pecha.Button>
              </div>
            </form>
          </Pecha.Form>
        </div>
      )}
    </div>
  );
};

export default TaskForm;
