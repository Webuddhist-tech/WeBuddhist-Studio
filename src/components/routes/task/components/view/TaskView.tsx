import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getPreset } from "../../api/presetApi";
import { fetchLanguageVersions } from "@/components/api/searchApi";
import { Pecha } from "@/components/ui/shadimport";
import { useState } from "react";
import { VersionSelectorModal } from "@/components/ui/molecules/version-selector/VersionSelectorModal";
import axiosInstance from "@/config/axios-config";
import {
  ContentIcon,
  VideoContent,
  AudioContent,
  ImageContent,
  TextContent,
  SourceReferenceContent,
  LinkedContent,
} from "../../../../ui/molecules/content-sub/ContentComponents";
import {
  LINKED_CONTENT_LABELS,
  isLinkedContentType,
  type LinkedContentType,
} from "@/components/ui/molecules/linked-content/linkedContent";
import { SortableList, SortableItem } from "@/components/ui/atoms/sortable";
import { PiDotsSixVertical } from "react-icons/pi";
import { useSubtaskReorder } from "../../hooks/useSubtaskReorder";
import { FaPen } from "react-icons/fa";
import { formatMs } from "@/lib/utils";
import { AudioSegmentPlayer } from "@/components/ui/molecules/audio-segment-player/AudioSegmentPlayer";

import { getAccessToken } from "@/lib/auth-storage";
type ContentType =
  | "TEXT"
  | "IMAGE"
  | "AUDIO"
  | "VIDEO"
  | "SOURCE_REFERENCE"
  | LinkedContentType;

interface TaskViewProps {
  taskId: string;
  onEditTask: (task: any) => void;
  isEditable?: boolean;
  dayAudioUrl?: string | null;
}

const fetchTaskDetails = async (task_id: string) => {
  const accessToken = getAccessToken();
  const { data } = await axiosInstance.get(`/api/v1/cms/tasks/${task_id}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return data;
};

const SubtaskContent = ({
  type,
  content,
  segmentNumbers,
  segmentRefs,
  reference,
  referenceId,
}: {
  type: ContentType;
  content: string;
  segmentNumbers?: number[] | null;
  segmentRefs?: (string | null)[] | null;
  reference?: any;
  referenceId?: string | null;
}) => {
  // Linked subtasks carry no inline content - the reference is the content.
  if (isLinkedContentType(type)) {
    return (
      <LinkedContent
        type={type}
        reference={reference}
        referenceId={referenceId}
      />
    );
  }

  if (!content) return null;

  switch (type) {
    case "VIDEO":
      return <VideoContent content={content} />;
    case "TEXT":
      return <TextContent content={content} />;
    case "AUDIO":
      return <AudioContent content={content} />;
    case "IMAGE":
      return <ImageContent content={content} />;
    case "SOURCE_REFERENCE":
      return (
        <SourceReferenceContent
          content={content}
          segmentNumbers={segmentNumbers}
          segmentRefs={segmentRefs}
        />
      );
  }
};

const SourceReferenceWithVersion = ({ subtask }: { subtask: any }) => {
  const { data: preset } = useQuery({
    queryKey: ["preset", subtask.id],
    queryFn: () => getPreset(subtask.id),
    enabled: !!subtask.id,
  });

  const { data: versionsData } = useQuery({
    queryKey: ["languageVersions", subtask.source_text_id, preset?.language],
    queryFn: () =>
      fetchLanguageVersions(subtask.source_text_id, preset!.language),
    enabled: !!preset && !!subtask.source_text_id && !!preset.language,
  });

  const versionTitle = versionsData?.available_versions?.find(
    (v: any) => v.id === preset?.version_id,
  )?.title;

  return (
    <div className="relative">
      <SourceReferenceContent
        content={subtask.content}
        segmentNumbers={subtask.segment_numbers}
        segmentRefs={subtask.segment_refs}
      />
      {preset && (
        <div className="relative mt-2 ml-4">
          {/* Connecting line */}
          <div className="absolute -top-2 left-0 w-px h-2 bg-blue-400 dark:bg-blue-500" />
          <div className="absolute top-0 left-0 w-3 h-px bg-blue-400 dark:bg-blue-500" />

          {/* Version info box */}
          <div className="ml-4 flex items-center gap-2 px-3 py-2 bg-blue-50 dark:bg-blue-900/20 rounded-md border border-blue-200 dark:border-blue-800">
            <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wide">
              {preset.language}
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400">•</span>
            <span
              className="text-sm text-gray-700 dark:text-gray-300 truncate max-w-[300px]"
              title={versionTitle || preset.version_id}
            >
              {versionTitle || preset.version_id.substring(0, 8) + "..."}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

const SubtaskCard = ({
  subtask,
  listeners,
  isEditable,
  dayAudioUrl,
}: {
  subtask: any;
  listeners?: any;
  isEditable?: boolean;
  dayAudioUrl?: string | null;
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: preset } = useQuery({
    queryKey: ["preset", subtask.id],
    queryFn: () => getPreset(subtask.id),
    enabled: !!subtask.id && subtask.content_type === "SOURCE_REFERENCE",
  });

  return (
    <>
      <div
        className={`border rounded-xl bg-[#ffffff] dark:bg-[#161616] border-gray-300 dark:border-input p-2 space-y-2`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex items-center border w-fit bg-[#F7F7F7] dark:bg-sidebar-secondary px-2 py-1 text-sm rounded-md border-dashed gap-2">
              <ContentIcon type={subtask.content_type} />{" "}
              {LINKED_CONTENT_LABELS[
                subtask.content_type as LinkedContentType
              ] ?? subtask.content_type}
            </div>
            {subtask.content_type === "SOURCE_REFERENCE" &&
              !preset &&
              subtask.source_text_id && (
                <Pecha.Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsModalOpen(true)}
                  className="text-xs"
                >
                  Add Version
                </Pecha.Button>
              )}
          </div>
          {listeners && isEditable && (
            <PiDotsSixVertical
              className="w-5 h-5 shrink-0 touch-none text-gray-400 dark:text-muted-foreground cursor-grab active:cursor-grabbing"
              {...listeners}
            />
          )}
        </div>
        {subtask.content_type === "SOURCE_REFERENCE" ? (
          <SourceReferenceWithVersion subtask={subtask} />
        ) : (
          <SubtaskContent
            type={subtask.content_type}
            content={subtask.content}
            reference={subtask.reference}
            referenceId={subtask.reference_id}
          />
        )}
        {subtask.audio_url ? (
          <div className="border-t border-dashed pt-2">
            <audio
              controls
              src={subtask.audio_url}
              className="w-full"
              preload="metadata"
            />
          </div>
        ) : (
          subtask.start_ms != null &&
          subtask.end_ms != null &&
          (dayAudioUrl ? (
            <AudioSegmentPlayer
              audioUrl={dayAudioUrl}
              startMs={subtask.start_ms}
              endMs={subtask.end_ms}
            />
          ) : (
            <p className="text-xs text-muted-foreground border-t border-dashed pt-2">
              Timeline: {formatMs(subtask.start_ms)} –{" "}
              {formatMs(subtask.end_ms)}
            </p>
          ))
        )}
      </div>

      {subtask.content_type === "SOURCE_REFERENCE" &&
        subtask.source_text_id && (
          <VersionSelectorModal
            isOpen={isModalOpen}
            onOpenChange={setIsModalOpen}
            textId={subtask.source_text_id}
            subtaskId={subtask.id}
            onSuccess={() => {
              setIsModalOpen(false);
              queryClient.invalidateQueries({
                queryKey: ["preset", subtask.id],
              });
            }}
          />
        )}
    </>
  );
};

const TaskView = ({
  taskId,
  onEditTask,
  isEditable,
  dayAudioUrl,
}: TaskViewProps) => {
  const { data: taskDetails, isLoading } = useQuery({
    queryKey: ["taskDetails", taskId],
    queryFn: () => fetchTaskDetails(taskId),
    enabled: !!taskId,
  });

  const { handleSubtaskReorder, getDisplaySubtasks } = useSubtaskReorder(
    taskDetails,
    taskId,
  );

  const displaySubtasks = getDisplaySubtasks();

  return (
    <div className="w-full my-4 h-[calc(100vh-40px)] bg-[#F5F5F5] border-dashed dark:bg-[#181818]  rounded-l-2xl border overflow-y-auto max-md:my-0 max-md:h-full max-md:rounded-none max-md:border-0">
      <div className=" space-y-4  overflow-y-auto">
        <div className="flex p-4 items-center justify-between w-3/4 max-md:w-full">
          <h2 className="text-xl font-semibold">Task</h2>
          {isEditable && (
            <Pecha.Button
              variant="outline"
              type="button"
              onClick={() => onEditTask(taskDetails)}
            >
              <FaPen className="h-4 w-4" />
              Edit
            </Pecha.Button>
          )}
        </div>
        <div className="p-4">
          <div className="h-12 p-4 bg-white dark:bg-input/30 rounded-md lg:w-2/3 w-full text-base flex items-center border max-md:h-auto max-md:min-h-12 max-md:py-3">
            {isLoading ? (
              <Pecha.Skeleton className="h-6  w-1/2 rounded" />
            ) : (
              taskDetails?.title
            )}
          </div>
        </div>
        <div className="border-b w-full border-dashed border-gray-300 dark:border-input" />
        <div className="space-y-4 w-full lg:w-2/3 p-4 ">
          {taskDetails?.subtasks.length > 0 && (
            <h2 className="text-xl font-semibold">Subtask</h2>
          )}
          {isLoading ? (
            <>
              <Pecha.Skeleton className="h-32 w-full rounded" />
              <Pecha.Skeleton className="h-32 w-full rounded" />
            </>
          ) : (
            <SortableList
              items={displaySubtasks.map((subtask: any) => ({
                id: subtask.id,
                display_order: subtask.display_order,
              }))}
              onReorder={(activeId: any, overId: any) => {
                handleSubtaskReorder(activeId, overId);
              }}
              disabled={!isEditable}
            >
              {displaySubtasks.map((subtask: any) => (
                <SortableItem key={subtask.id} id={subtask.id}>
                  {({ listeners }: any) => (
                    <SubtaskCard
                      subtask={subtask}
                      listeners={listeners}
                      isEditable={isEditable}
                      dayAudioUrl={dayAudioUrl}
                    />
                  )}
                </SortableItem>
              ))}
            </SortableList>
          )}
        </div>
      </div>
    </div>
  );
};

export default TaskView;
