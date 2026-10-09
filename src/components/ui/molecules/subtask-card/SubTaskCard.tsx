import { useEffect, useRef, useState } from "react";
import Dropzone from "react-dropzone";
import { Pecha } from "@/components/ui/shadimport";
import { MarkdownEditor } from "@/components/ui/atoms/markdown-editor";
import { IoMdClose } from "react-icons/io";
import { FaMinus, FaTrash } from "react-icons/fa6";
import { FiLoader } from "react-icons/fi";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { toast } from "sonner";
import InlineImageUpload from "@/components/ui/molecules/form-upload/InlineImageUpload";
import {
  VideoContent,
  AudioContent,
  ContentIcon,
  SourceReferenceContent,
  LinkedContent,
} from "../content-sub/ContentComponents";
import {
  LINKED_CONTENT_LABELS,
  type LinkedContentType,
  type SubTaskReference,
} from "../linked-content/linkedContent";
import { getAudioDurationMs, getYouTubeDuration, formatMs } from "@/lib/utils";
import { AudioTrimmer } from "@/components/ui/molecules/audio-trimmer/AudioTrimmer";
import {
  deleteSubTaskAudio,
  deleteSubTaskTimestamp,
  generateDayAudio,
  uploadSubTaskAudio,
  waitForAudioJob,
} from "@/components/routes/task/api/taskApi";
import TtsGenerateControls from "@/components/ui/molecules/tts-generate-controls/TtsGenerateControls";
import { getPreset } from "@/components/routes/task/api/presetApi";

interface SubTaskTimestamps {
  start_ms?: number | null;
  end_ms?: number | null;
  audio_url?: string | null;
}

interface VideoSubTask extends SubTaskTimestamps {
  id?: string | null;
  content_type: "VIDEO";
  content: string;
  display_order?: number;
  duration?: string;
}

interface TextSubTask extends SubTaskTimestamps {
  id?: string | null;
  content_type: "TEXT";
  content: string;
  display_order?: number;
}

interface AudioSubTask extends SubTaskTimestamps {
  id?: string | null;
  content_type: "AUDIO";
  content: string;
  display_order?: number;
}

interface ImageSubTask extends SubTaskTimestamps {
  id?: string | null;
  content_type: "IMAGE";
  content: string | null;
  imagePreview: string | null;
  display_order?: number;
}

interface SourceSubTask extends SubTaskTimestamps {
  id?: string | null;
  content_type: "SOURCE_REFERENCE";
  content: string;
  display_order?: number;
  source_text_id?: string | null;
  pecha_segment_id?: string | null;
  segment_ids?: string[] | null;
  segment_numbers?: number[] | null;
  segment_refs?: (string | null)[] | null;
}
export interface LinkedSubTask extends SubTaskTimestamps {
  id?: string | null;
  content_type: LinkedContentType;
  content: string;
  display_order?: number;
  reference_id?: string | null;
  reference?: SubTaskReference | null;
}

export type SubTask =
  | VideoSubTask
  | TextSubTask
  | AudioSubTask
  | ImageSubTask
  | SourceSubTask
  | LinkedSubTask;

interface SubTaskCardProps {
  subTask: SubTask;
  index: number;
  onUpdate: (index: number, updates: Partial<SubTask>) => void;
  onRemove: (index: number) => void;
  onImageUpload: (index: number, file: File) => Promise<void> | void;
  onRemoveImage: (index: number) => void;
  dayAudioUrl?: string | null;
  dayAudioDurationMs?: number | null;
  planLanguage?: string;
  taskId?: string;
}

const VideoSubtask = ({
  subTask,
  index,
  onUpdate,
}: {
  subTask: VideoSubTask;
  index: number;
  onUpdate: (index: number, updates: Partial<SubTask>) => void;
}) => {
  const handleUrlChange = async (url: string) => {
    onUpdate(index, { content: url, duration: "" });

    // Fetch duration if it's a valid YouTube URL
    if (url && (url.includes("youtube.com") || url.includes("youtu.be"))) {
      try {
        const duration = await getYouTubeDuration(url);
        onUpdate(index, { content: url, duration });
      } catch (error) {
        console.error("Failed to fetch duration:", error);
        onUpdate(index, { content: url, duration: "" });
      }
    }
  };

  return (
    <>
      <Pecha.Input
        type="url"
        placeholder="Enter YouTube URL"
        className="h-12 text-base bg-[#FAFAFA] dark:bg-sidebar-secondary "
        value={subTask.content}
        onChange={(e) => handleUrlChange(e.target.value)}
      />

      <VideoContent content={subTask.content} />
    </>
  );
};

const TextSubtask = ({
  subTask,
  index,
  onUpdate,
}: {
  subTask: TextSubTask;
  index: number;
  onUpdate: (index: number, updates: Partial<SubTask>) => void;
}) => (
  <MarkdownEditor
    value={subTask.content}
    onChange={(value) => onUpdate(index, { content: value })}
    placeholder="Enter your text content"
    className="bg-[#FAFAFA] dark:bg-sidebar-secondary"
    textareaClassName="min-h-64 bg-[#FAFAFA] dark:bg-sidebar-secondary"
  />
);

const AudioSubtask = ({
  subTask,
  index,
  onUpdate,
}: {
  subTask: AudioSubTask;
  index: number;
  onUpdate: (index: number, updates: Partial<SubTask>) => void;
}) => (
  <>
    <Pecha.Input
      type="url"
      placeholder="Enter Spotify or SoundCloud URL"
      className="h-12 text-base bg-[#FAFAFA] dark:bg-sidebar-secondary "
      value={subTask.content}
      onChange={(e) => onUpdate(index, { content: e.target.value })}
    />
    {subTask.content && <AudioContent content={subTask.content} />}
  </>
);

const ImageSubtask = ({
  subTask,
  index,
  onImageUpload,
  onRemoveImage,
}: {
  subTask: ImageSubTask;
  index: number;
  onImageUpload: (index: number, file: File) => void;
  onRemoveImage: (index: number) => void;
}) => (
  <>
    {!subTask.imagePreview && (
      <InlineImageUpload onUpload={(file) => onImageUpload(index, file)} />
    )}
    {subTask.imagePreview && (
      <div className="mt-4 flex w-full justify-center bg-[#FAFAFA] dark:bg-sidebar-secondary ">
        <div className="relative">
          <img
            src={subTask.imagePreview}
            alt="Final uploaded image"
            className="w-full h-48 object-cover rounded-lg border"
          />
          <Pecha.Button
            variant="default"
            className="absolute top-2 right-2"
            type="button"
            onClick={() => onRemoveImage(index)}
            data-testid="remove-image-button"
          >
            <FaMinus className="w-4 h-4" />
          </Pecha.Button>
        </div>
      </div>
    )}
  </>
);

const SourceSubtask = ({ subTask }: { subTask: SourceSubTask }) => {
  const { data: preset } = useQuery({
    queryKey: ["preset", subTask.id],
    queryFn: () => getPreset(subTask.id!),
    enabled: !!subTask.id,
  });

  return (
    <div className="relative">
      <SourceReferenceContent
        content={subTask.content}
        segmentNumbers={subTask.segment_numbers}
        segmentRefs={subTask.segment_refs}
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
              className="text-sm text-gray-700 dark:text-gray-300 truncate max-w-[200px]"
              title={preset.version_id}
            >
              {preset.version_id.substring(0, 8)}...
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

const SubtaskAudioControls = ({
  subTaskId,
  taskId,
  planLanguage = "",
  audioUrl,
}: {
  subTaskId: string;
  taskId?: string;
  planLanguage?: string;
  audioUrl?: string | null;
}) => {
  const queryClient = useQueryClient();
  const { planId } = useParams<{ planId: string }>();
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [localAudioUrl, setLocalAudioUrl] = useState(audioUrl ?? null);
  const pollAbortRef = useRef<AbortController | null>(null);

  const abortPolling = () => {
    pollAbortRef.current?.abort();
    pollAbortRef.current = null;
  };

  useEffect(() => {
    setLocalAudioUrl(audioUrl ?? null);
    setPendingFile(null);
  }, [audioUrl, subTaskId]);

  useEffect(() => abortPolling, []);

  const revalidateSubtask = async (nextAudioUrl?: string | null) => {
    if (nextAudioUrl !== undefined) {
      setLocalAudioUrl(nextAudioUrl);
    } else if (taskId) {
      await queryClient.refetchQueries({ queryKey: ["taskDetails", taskId] });
      const details = queryClient.getQueryData<{
        subtasks?: Array<{ id: string; audio_url?: string | null }>;
      }>(["taskDetails", taskId]);
      const subtask = details?.subtasks?.find((item) => item.id === subTaskId);
      setLocalAudioUrl(subtask?.audio_url ?? null);
    }
    if (taskId) {
      queryClient.invalidateQueries({ queryKey: ["taskDetails", taskId] });
    }
    if (planId) {
      queryClient.invalidateQueries({ queryKey: ["planDetails", planId] });
    }
  };

  const generateMutation = useMutation({
    mutationFn: async (options: { type?: string; voice_name?: string }) => {
      abortPolling();
      const controller = new AbortController();
      pollAbortRef.current = controller;

      const accepted = await generateDayAudio(
        { sub_task_id: subTaskId },
        { language: planLanguage, ...options },
      );
      toast.success("Audio generation started", {
        description: "Your audio will be ready soon.",
      });
      return waitForAudioJob(accepted.job_id, { signal: controller.signal });
    },
    onSuccess: async (job) => {
      if (job.status === "failed") {
        toast.error("Failed to generate audio", {
          description: job.error_message || "Something went wrong",
        });
        return;
      }
      toast.success("Audio generated successfully!");
      // Refresh from content tables (sub_tasks.audio_url), not job log result
      await revalidateSubtask();
    },
    onError: (error: Error) => {
      if (error.name === "AbortError") {
        return;
      }
      toast.error("Failed to generate audio", {
        description: error.message,
      });
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const duration_ms = await getAudioDurationMs(file);
      return uploadSubTaskAudio(subTaskId, file, duration_ms);
    },
    onSuccess: async (data) => {
      setPendingFile(null);
      toast.success("Subtask audio uploaded");
      await revalidateSubtask(data.audio_url);
    },
    onError: (error: Error) => {
      toast.error("Failed to upload subtask audio", {
        description: error.message,
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteSubTaskAudio(subTaskId),
    onSuccess: async () => {
      setPendingFile(null);
      toast.success("Subtask audio removed");
      await revalidateSubtask(null);
    },
    onError: (error: Error) => {
      toast.error("Failed to remove subtask audio", {
        description: error.message,
      });
    },
  });

  const isBusy =
    generateMutation.isPending ||
    uploadMutation.isPending ||
    deleteMutation.isPending;

  return (
    <div className="space-y-3 pt-2 border-t border-dashed border-gray-200 dark:border-input">
      <p className="text-sm font-medium">Subtask audio</p>

      {localAudioUrl && (
        <div className="flex items-center gap-2 min-w-0">
          <audio
            controls
            src={localAudioUrl}
            className="h-9 min-w-0 flex-1"
            preload="metadata"
          />
          <Pecha.Button
            type="button"
            variant="outline"
            size="icon"
            className="shrink-0 h-9 w-9"
            disabled={isBusy}
            title="Remove audio"
            onClick={() => deleteMutation.mutate()}
          >
            {deleteMutation.isPending ? (
              <FiLoader className="w-4 h-4 animate-spin" />
            ) : (
              <FaTrash className="w-4 h-4" />
            )}
          </Pecha.Button>
        </div>
      )}

      <TtsGenerateControls
        planLanguage={planLanguage}
        defaultAudioType="INSTRUCTION"
        size="sm"
        isPending={generateMutation.isPending}
        disabled={isBusy}
        onGenerate={(options) => generateMutation.mutate(options)}
      />

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-[#ffffff] dark:bg-[#161616] px-2 text-muted-foreground">
            or upload
          </span>
        </div>
      </div>

      <Dropzone
        accept={{ "audio/*": [".mp3", ".m4a", ".wav", ".aac", ".ogg"] }}
        multiple={false}
        disabled={isBusy}
        onDrop={(files) => {
          if (files[0]) setPendingFile(files[0]);
        }}
      >
        {({ getRootProps, getInputProps }) => (
          <div
            {...getRootProps()}
            className="border border-dashed rounded-lg py-2 px-3 text-center text-sm cursor-pointer hover:border-gray-400 dark:hover:border-gray-500 bg-[#FAFAFA] dark:bg-sidebar-secondary"
          >
            <input {...getInputProps()} />
            {pendingFile
              ? `Selected: ${pendingFile.name}`
              : localAudioUrl
                ? "Drop or click to replace subtask audio (MP3, etc.)"
                : "Drop or click to upload subtask audio"}
          </div>
        )}
      </Dropzone>

      {pendingFile && (
        <div className="flex gap-2">
          <Pecha.Button
            type="button"
            variant="default"
            className="bg-[#A51C21] hover:bg-[#A51C21]/90 flex-1"
            disabled={isBusy}
            onClick={() => uploadMutation.mutate(pendingFile)}
          >
            {uploadMutation.isPending && (
              <FiLoader className="w-4 h-4 animate-spin mr-1" />
            )}
            {uploadMutation.isPending ? "Uploading..." : "Upload audio"}
          </Pecha.Button>
          <Pecha.Button
            type="button"
            variant="outline"
            disabled={isBusy}
            onClick={() => setPendingFile(null)}
          >
            Cancel
          </Pecha.Button>
        </div>
      )}
    </div>
  );
};

const SubtaskTimestampSection = ({
  subTask,
  index,
  onUpdate,
  dayAudioUrl,
  dayAudioDurationMs,
  taskId,
}: {
  subTask: SubTask;
  index: number;
  onUpdate: (index: number, updates: Partial<SubTask>) => void;
  dayAudioUrl?: string | null;
  dayAudioDurationMs?: number | null;
  taskId?: string;
}) => {
  const queryClient = useQueryClient();
  const { planId } = useParams<{ planId: string }>();
  const hasPersistedTimestamps =
    subTask.start_ms != null && subTask.end_ms != null;
  const hasDayAudio =
    !!dayAudioUrl && dayAudioDurationMs != null && dayAudioDurationMs > 0;

  const deleteMutation = useMutation({
    mutationFn: () => deleteSubTaskTimestamp(subTask.id as string),
    onSuccess: async () => {
      toast.success("Timestamps removed");
      onUpdate(index, { start_ms: null, end_ms: null });
      if (taskId) {
        queryClient.invalidateQueries({ queryKey: ["taskDetails", taskId] });
      }
      if (planId) {
        queryClient.invalidateQueries({ queryKey: ["planDetails", planId] });
      }
    },
    onError: (error: Error) => {
      toast.error("Failed to remove timestamps", {
        description: error.message,
      });
    },
  });

  const handleClearTimestamps = async () => {
    if (subTask.id && hasPersistedTimestamps) {
      await deleteMutation.mutateAsync();
      return;
    }
    onUpdate(index, { start_ms: null, end_ms: null });
  };

  return (
    <div className="space-y-2 pt-2 border-t border-dashed border-gray-200 dark:border-input">
      <p className="text-sm font-medium">Timeline (day audio)</p>
      {hasDayAudio ? (
        <AudioTrimmer
          audioUrl={dayAudioUrl}
          maxDurationMs={dayAudioDurationMs}
          startMs={subTask.start_ms ?? null}
          endMs={subTask.end_ms ?? null}
          onChange={(start_ms, end_ms) => onUpdate(index, { start_ms, end_ms })}
          onClear={handleClearTimestamps}
          disabled={deleteMutation.isPending}
        />
      ) : (
        <div className="space-y-2 rounded-md border border-dashed border-gray-300 dark:border-input bg-[#FAFAFA] dark:bg-sidebar-secondary p-3">
          <p className="text-sm text-muted-foreground">
            {formatMs(subTask.start_ms as number)} –{" "}
            {formatMs(subTask.end_ms as number)}
          </p>
          <p className="text-xs text-muted-foreground">
            Day audio is not available. You can remove these timestamps.
          </p>
          <Pecha.Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={deleteMutation.isPending}
            onClick={handleClearTimestamps}
          >
            {deleteMutation.isPending ? (
              <FiLoader className="w-3 h-3 mr-1 animate-spin" />
            ) : null}
            Clear timestamps
          </Pecha.Button>
        </div>
      )}
    </div>
  );
};

export const SubTaskCard = ({
  subTask,
  index,
  onUpdate,
  onRemove,
  onImageUpload,
  onRemoveImage,
  dayAudioUrl,
  dayAudioDurationMs,
  planLanguage,
  taskId,
}: SubTaskCardProps) => {
  const hasDayAudio =
    !!dayAudioUrl && dayAudioDurationMs != null && dayAudioDurationMs > 0;
  const hasTimestamps = subTask.start_ms != null && subTask.end_ms != null;
  const showTimestampSection = hasDayAudio || hasTimestamps;

  const renderContent = () => {
    switch (subTask.content_type) {
      case "VIDEO":
        return (
          <VideoSubtask subTask={subTask} index={index} onUpdate={onUpdate} />
        );
      case "TEXT":
        return (
          <TextSubtask subTask={subTask} index={index} onUpdate={onUpdate} />
        );
      case "AUDIO":
        return (
          <AudioSubtask subTask={subTask} index={index} onUpdate={onUpdate} />
        );
      case "IMAGE":
        return (
          <ImageSubtask
            subTask={subTask}
            index={index}
            onImageUpload={onImageUpload}
            onRemoveImage={onRemoveImage}
          />
        );
      case "SOURCE_REFERENCE":
        return <SourceSubtask subTask={subTask} />;
      case "GROUP_ACCUMULATION":
      case "GROUP_COLLECTION":
      case "EVENT":
      case "POST":
        return (
          <LinkedContent
            type={subTask.content_type}
            reference={subTask.reference}
            referenceId={subTask.reference_id}
          />
        );
    }
  };

  return (
    <div
      key={index}
      className={`border border-gray-300 bg-[#ffffff] dark:bg-[#161616] dark:border-input rounded-sm p-2 space-y-4`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center bg-[#F7F7F7] border dark:bg-sidebar-secondary  px-2 py-1 text-sm rounded-md border-dashed gap-2">
          <ContentIcon type={subTask.content_type} />
          {LINKED_CONTENT_LABELS[subTask.content_type as LinkedContentType] ??
            subTask.content_type}
        </div>
        <Pecha.Button
          variant="outline"
          type="button"
          onClick={() => onRemove(index)}
        >
          <IoMdClose className="w-4 h-4" />
        </Pecha.Button>
      </div>
      {renderContent()}
      {subTask.id &&
        (subTask.content_type === "TEXT" ||
          subTask.content_type === "SOURCE_REFERENCE") && (
          <SubtaskAudioControls
            subTaskId={subTask.id}
            taskId={taskId}
            planLanguage={planLanguage}
            audioUrl={subTask.audio_url}
          />
        )}
      {showTimestampSection && (
        <SubtaskTimestampSection
          subTask={subTask}
          index={index}
          onUpdate={onUpdate}
          dayAudioUrl={dayAudioUrl}
          dayAudioDurationMs={dayAudioDurationMs}
          taskId={taskId}
        />
      )}
    </div>
  );
};
