import axios from "axios";
import axiosInstance from "@/config/axios-config";
import {
  DEFAULT_MONLAM_VOICE,
  planLanguageToTtsApiLanguage,
} from "@/lib/ttsConstants";

import { getAuthHeaders } from "@/lib/auth-storage";
import { tolgee } from "@/i18n/tolgee";
interface CreateTaskPayload {
  plan_id: string;
  day_id: string;
  title: string;
  estimated_time: number;
}

export const createTask = async (taskData: CreateTaskPayload) => {
  const { data } = await axiosInstance.post(
    `/api/v1/cms/tasks`,
    { ...taskData },
    {
      headers: getAuthHeaders(),
    },
  );
  return data;
};

export const uploadImageToS3 = async (file: File, plan_id: string) => {
  const formData = new FormData();
  formData.append("file", file);
  const { data } = await axiosInstance.post(
    `/api/v1/cms/media/upload`,
    formData,
    {
      params: {
        ...(plan_id && { plan_id: plan_id }),
      },
    },
  );
  return data;
};

export interface SubTaskPayload {
  content: string | null;
  content_type: string;
  display_order: number;
  duration?: string;
  source_text_id?: string | null;
  pecha_segment_id?: string | null;
  segment_ids?: string[] | null;
  segment_numbers?: number[] | null;
  /** Set for linked content types (GROUP_ACCUMULATION, GROUP_COLLECTION, EVENT, POST). */
  reference_id?: string | null;
  start_ms?: number | null;
  end_ms?: number | null;
}

export const createSubTasks = async (
  task_id: string,
  subTasksData: SubTaskPayload[],
) => {
  const { data } = await axiosInstance.post(
    `/api/v1/cms/sub-tasks`,
    {
      task_id: task_id,
      sub_tasks: subTasksData,
    },
    {
      headers: getAuthHeaders(),
    },
  );
  return data;
};

export interface SubTaskUpdatePayload extends SubTaskPayload {
  id: string | null;
}

export const updateSubTasks = async (
  task_id: string,
  subTasksData: SubTaskUpdatePayload[],
) => {
  await axiosInstance.put(
    `/api/v1/cms/sub-tasks`,
    {
      task_id: task_id,
      sub_tasks: subTasksData,
    },
    {
      headers: getAuthHeaders(),
    },
  );
};

export const fetchTaskDetails = async (task_id: string) => {
  const { data } = await axiosInstance.get(`/api/v1/cms/tasks/${task_id}`, {
    headers: getAuthHeaders(),
  });
  return data;
};

export const updateTaskTitle = async (task_id: string, title: string) => {
  const { data } = await axiosInstance.put(
    `/api/v1/cms/tasks/${task_id}`,
    { title },
    {
      headers: getAuthHeaders(),
    },
  );
  return data;
};

export const ChangeTaskDay = async (task_id: string, target_day_id: string) => {
  const { data } = await axiosInstance.patch(
    `/api/v1/cms/tasks/${task_id}`,
    {
      target_day_id,
    },
    {
      headers: getAuthHeaders(),
    },
  );
  return data;
};

export const reorderTasks = async (
  day_id: string,
  tasks: Array<{ id: string; display_order: number }>,
) => {
  const { data } = await axiosInstance.put(
    `/api/v1/cms/tasks/${day_id}/order`,
    {
      tasks,
    },
    {
      headers: getAuthHeaders(),
    },
  );
  return data;
};

/**
 * How the reader opens a task by default. A panel can be open with no text
 * id: the reader then shows the list of commentaries/translations without
 * opening one. The ids are OpenPecha text ids. Only one task per day is live.
 */
export interface TaskSettings {
  is_commentary_open: boolean;
  commentary_text_id: string | null;
  is_translation_open: boolean;
  translation_text_id: string | null;
  is_live: boolean;
}

export const DEFAULT_TASK_SETTINGS: TaskSettings = {
  is_commentary_open: false,
  commentary_text_id: null,
  is_translation_open: false,
  translation_text_id: null,
  is_live: false,
};

export const updateTaskSettings = async (
  task_id: string,
  settings: TaskSettings,
) => {
  const { data } = await axiosInstance.put<TaskSettings>(
    `/api/v1/cms/tasks/${task_id}/settings`,
    settings,
    {
      headers: getAuthHeaders(),
    },
  );
  return data;
};

export interface GenerateDayAudioOptions {
  language: string;
  type?: string;
  voice_name?: string;
}

export type AudioJobStatus = "pending" | "processing" | "completed" | "failed";

export interface AudioJobAcceptedResponse {
  job_id: string;
  status: AudioJobStatus;
}

export interface AudioJobStatusResponse {
  job_id: string;
  status: AudioJobStatus;
  day_id?: string | null;
  sub_task_id?: string | null;
  language: string;
  type: string;
  voice_name: string;
  audio_url?: string | null;
  audio_duration_ms?: number | null;
  s3_key?: string | null;
  error_message?: string | null;
  created_at: string;
  updated_at: string;
  started_at?: string | null;
  completed_at?: string | null;
}

export interface SubTaskAudioUploadResponse {
  sub_task_id: string;
  task_id: string;
  audio_key: string;
  audio_url: string;
  duration_ms: number | null;
  message: string;
}

export const uploadSubTaskAudio = async (
  sub_task_id: string,
  file: File,
  duration_ms?: number,
) => {
  const formData = new FormData();
  formData.append("file", file);
  if (duration_ms != null) {
    formData.append("duration_ms", String(duration_ms));
  }
  const { data } = await axiosInstance.post<SubTaskAudioUploadResponse>(
    `/api/v1/cms/media/upload/subtask-audio`,
    formData,
    {
      params: { sub_task_id },
      headers: getAuthHeaders(),
    },
  );
  return data;
};

export const deleteSubTaskAudio = async (sub_task_id: string) => {
  await axiosInstance.delete(`/api/v1/cms/sub-tasks/${sub_task_id}/audio`, {
    headers: getAuthHeaders(),
  });
};

export const deleteSubTaskTimestamp = async (sub_task_id: string) => {
  await axiosInstance.delete(`/api/v1/cms/sub-tasks/${sub_task_id}/timestamp`, {
    headers: getAuthHeaders(),
  });
};

export const generateDayAudio = async (
  params: { day_id: string } | { sub_task_id: string },
  options: GenerateDayAudioOptions,
): Promise<AudioJobAcceptedResponse> => {
  const language = planLanguageToTtsApiLanguage(options.language);
  const body: Record<string, string> = { ...params, language };

  if (language !== "bo" && options.type) {
    body.type = options.type;
  }
  if (language === "bo") {
    body.voice_name = options.voice_name ?? DEFAULT_MONLAM_VOICE;
  }

  const { data } = await axiosInstance.post<AudioJobAcceptedResponse>(
    `/api/v1/cms/plans/audio/generate`,
    body,
    { headers: getAuthHeaders() },
  );
  return data;
};

const AUDIO_JOB_POLL_INTERVAL_MS = 2500;
const AUDIO_JOB_POLL_TIMEOUT_MS = 15 * 60 * 1000;
const AUDIO_JOB_STATUS_REQUEST_TIMEOUT_MS = 30_000;

export const fetchAudioJobStatus = async (
  jobId: string,
  options?: { signal?: AbortSignal },
): Promise<AudioJobStatusResponse> => {
  const { data } = await axiosInstance.get<AudioJobStatusResponse>(
    `/api/v1/cms/plans/audio/jobs/${jobId}`,
    {
      headers: getAuthHeaders(),
      signal: options?.signal,
      timeout: AUDIO_JOB_STATUS_REQUEST_TIMEOUT_MS,
    },
  );
  return data;
};

const abortError = () =>
  new DOMException("Audio job polling aborted", "AbortError");

const pollTimeoutError = () =>
  new Error(tolgee.t("studio.task.audio.generation_timeout"));

const isAbortError = (error: unknown): boolean => {
  if (!error || typeof error !== "object") {
    return false;
  }
  const err = error as { name?: string; code?: string };
  if (err.name === "AbortError" || err.name === "CanceledError") {
    return true;
  }
  if (err.code === "ERR_CANCELED") {
    return true;
  }
  return axios.isCancel(error);
};

const delay = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortError());
      return;
    }

    const timeoutId = window.setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);

    const onAbort = () => {
      window.clearTimeout(timeoutId);
      reject(abortError());
    };

    signal?.addEventListener("abort", onAbort, { once: true });
  });

export const waitForAudioJob = async (
  jobId: string,
  options?: { signal?: AbortSignal },
): Promise<AudioJobStatusResponse> => {
  if (options?.signal?.aborted) {
    throw abortError();
  }

  const startedAt = Date.now();
  const controller = new AbortController();
  let timedOut = false;

  const onExternalAbort = () => controller.abort();
  options?.signal?.addEventListener("abort", onExternalAbort);

  const overallTimeoutId = window.setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, AUDIO_JOB_POLL_TIMEOUT_MS);

  try {
    while (true) {
      if (controller.signal.aborted) {
        throw timedOut ? pollTimeoutError() : abortError();
      }

      try {
        const status = await fetchAudioJobStatus(jobId, {
          signal: controller.signal,
        });
        if (status.status === "completed" || status.status === "failed") {
          return status;
        }
      } catch (error) {
        if (timedOut) {
          throw pollTimeoutError();
        }
        if (isAbortError(error) || options?.signal?.aborted) {
          throw abortError();
        }
        // Stalled/timed-out status request: retry until the overall poll budget ends.
        if (
          axios.isAxiosError(error) &&
          error.code === "ECONNABORTED" &&
          Date.now() - startedAt < AUDIO_JOB_POLL_TIMEOUT_MS
        ) {
          await delay(AUDIO_JOB_POLL_INTERVAL_MS, controller.signal);
          continue;
        }
        throw error;
      }

      if (Date.now() - startedAt >= AUDIO_JOB_POLL_TIMEOUT_MS) {
        throw pollTimeoutError();
      }

      await delay(AUDIO_JOB_POLL_INTERVAL_MS, controller.signal);
    }
  } catch (error) {
    if (timedOut) {
      throw pollTimeoutError();
    }
    if (isAbortError(error)) {
      throw abortError();
    }
    throw error;
  } finally {
    window.clearTimeout(overallTimeoutId);
    options?.signal?.removeEventListener("abort", onExternalAbort);
  }
};

export const reorderSubtasks = async (
  task_id: string,
  subtasks: Array<{ id: string; display_order: number }>,
) => {
  const { data } = await axiosInstance.put(
    `/api/v1/cms/sub-tasks/${task_id}/order`,
    {
      subtasks: subtasks,
    },
    {
      headers: getAuthHeaders(),
    },
  );
  return data;
};
