import axiosInstance from "@/config/axios-config";

export type TimerAudioType = "preset" | "user_uploaded";

export interface TimerAudio {
  id: string;
  /** Null for presets: they belong to the catalogue, not to a person. */
  user_id: string | null;
  type: TimerAudioType;
  name: string;
  audio_url: string | null;
  /** Optional — a preset may ship without a cover. */
  image_url: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface TimerAudiosResponse {
  audios: TimerAudio[];
  total: number;
  skip: number;
  limit: number;
}

export interface CreateTimerAudioPresetPayload {
  name: string;
  audioFile: File;
  imageFile?: File | null;
}

export interface UpdateTimerAudioPresetPayload {
  name?: string;
  audioFile?: File | null;
  imageFile?: File | null;
}

const getAuthHeaders = () => ({
  Authorization: `Bearer ${sessionStorage.getItem("accessToken")}`,
});

const CMS_BASE = "/api/v1/timers/audios/cms";

export const fetchTimerAudioPresets = async (
  page: number,
  limit: number,
): Promise<TimerAudiosResponse> => {
  const skip = (page - 1) * limit;
  const { data } = await axiosInstance.get<TimerAudiosResponse>(CMS_BASE, {
    headers: getAuthHeaders(),
    params: { skip, limit },
  });
  return data;
};

export const createTimerAudioPreset = async (
  payload: CreateTimerAudioPresetPayload,
): Promise<TimerAudio> => {
  const body = new FormData();
  body.append("name", payload.name);
  body.append("audio_file", payload.audioFile);
  if (payload.imageFile) body.append("image_file", payload.imageFile);

  const { data } = await axiosInstance.post<TimerAudio>(CMS_BASE, body, {
    headers: getAuthHeaders(),
  });
  return data;
};

export const updateTimerAudioPreset = async (
  id: string,
  payload: UpdateTimerAudioPresetPayload,
): Promise<TimerAudio> => {
  const body = new FormData();
  if (payload.name !== undefined) body.append("name", payload.name);
  if (payload.audioFile) body.append("audio_file", payload.audioFile);
  if (payload.imageFile) body.append("image_file", payload.imageFile);

  const { data } = await axiosInstance.put<TimerAudio>(
    `${CMS_BASE}/${id}`,
    body,
    { headers: getAuthHeaders() },
  );
  return data;
};

export const deleteTimerAudioPreset = async (id: string): Promise<void> => {
  await axiosInstance.delete(`${CMS_BASE}/${id}`, {
    headers: getAuthHeaders(),
  });
};
