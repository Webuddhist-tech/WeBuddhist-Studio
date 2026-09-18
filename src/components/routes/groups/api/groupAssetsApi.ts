import axiosInstance from "@/config/axios-config";

export type GroupAssetType = "AUDIO" | "IMAGE" | "VIDEO";

/**
 * A file in a group's library. Most fields are optional server-side:
 * `asset_url` is null when presigning fails, and the rest are only set when
 * the upload supplied them.
 */
export interface GroupAssetDTO {
  id: string;
  group_id: string;
  asset_type: GroupAssetType;
  title: string;
  file_name: string;
  asset_url?: string | null;
  mime_type?: string | null;
  file_size_bytes?: number | null;
  duration_ms?: number | null;
  created_at: string;
}

export interface GroupAssetsResponse {
  assets: GroupAssetDTO[];
  skip: number;
  limit: number;
  total: number;
}

/** One collection item still linking an asset, named in a 409 on delete. */
export interface GroupAssetUsageDTO {
  collection_id: string;
  collection_name: string;
  item_id: string;
  /** Best-effort on the server; null when title resolution failed. */
  text_title?: string | null;
}

const BASE_URL = "/api/v1/cms/author/groups";

const assetsUrl = (groupId: string) => `${BASE_URL}/${groupId}/assets`;

export const fetchGroupAssets = async (
  groupId: string,
  params: {
    assetType?: GroupAssetType;
    search?: string;
    skip?: number;
    limit?: number;
  } = {},
): Promise<GroupAssetsResponse> => {
  const { data } = await axiosInstance.get<GroupAssetsResponse>(
    assetsUrl(groupId),
    {
      params: {
        asset_type: params.assetType,
        search: params.search?.trim() || undefined,
        skip: params.skip ?? 0,
        limit: params.limit ?? 20,
      },
    },
  );
  return data;
};

/**
 * Adds a file to the group's library. Links it to nothing — chant items are
 * linked separately via `setChantItemAudio`.
 */
export const uploadGroupAsset = async (
  groupId: string,
  file: File,
  options: {
    assetType?: GroupAssetType;
    title?: string;
    durationMs?: number | null;
  } = {},
): Promise<GroupAssetDTO> => {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("asset_type", options.assetType ?? "AUDIO");
  if (options.title?.trim()) formData.append("title", options.title.trim());
  // The server stores duration verbatim and never derives it.
  if (options.durationMs != null) {
    formData.append("duration_ms", String(Math.round(options.durationMs)));
  }

  const { data } = await axiosInstance.post<GroupAssetDTO>(
    assetsUrl(groupId),
    formData,
  );
  return data;
};

export const renameGroupAsset = async (
  groupId: string,
  assetId: string,
  title: string,
): Promise<GroupAssetDTO> => {
  const { data } = await axiosInstance.patch<GroupAssetDTO>(
    `${assetsUrl(groupId)}/${assetId}`,
    { title },
  );
  return data;
};

/**
 * Deletes an asset from the library. The server answers 409 with the items
 * still linking it; pass `force` to drop those links and delete anyway.
 */
export const deleteGroupAsset = async (
  groupId: string,
  assetId: string,
  force = false,
): Promise<void> => {
  await axiosInstance.delete(`${assetsUrl(groupId)}/${assetId}`, {
    params: force ? { force: true } : undefined,
  });
};

export interface GroupAssetDeleteConflict {
  message: string;
  usages: GroupAssetUsageDTO[];
}

/**
 * Unpacks the 409 raised by `deleteGroupAsset`. FastAPI nests the raised
 * detail under its own `detail` key, so the payload is
 * `{ detail: { detail, usages } }` — not `{ detail, usages }`.
 * Returns null for any other failure.
 */
export const getAssetDeleteConflict = (
  error: unknown,
): GroupAssetDeleteConflict | null => {
  const err = error as {
    response?: { status?: number; data?: { detail?: unknown } };
  };
  if (err?.response?.status !== 409) return null;

  const detail = err.response?.data?.detail;
  if (!detail || typeof detail !== "object") {
    return { message: "This audio is still in use.", usages: [] };
  }

  const { detail: message, usages } = detail as {
    detail?: unknown;
    usages?: unknown;
  };
  return {
    message:
      typeof message === "string" ? message : "This audio is still in use.",
    usages: Array.isArray(usages) ? (usages as GroupAssetUsageDTO[]) : [],
  };
};

const AUDIO_EXTENSIONS = ["mp3", "m4a", "wav", "aac", "ogg"] as const;

export const AUDIO_ACCEPT = AUDIO_EXTENSIONS.map((ext) => `.${ext}`).join(",");
export const MAX_ASSET_SIZE_BYTES = 50 * 1024 * 1024;
export const MAX_AUDIO_PER_ITEM = 10;

export const FORMAT_HINT = "MP3, M4A, WAV, AAC or OGG · max 50 MB";

/** Dark, compact tooltip; the shared atom is light-on-light. */
export const TOOLTIP_CLASS =
  "border-0 bg-foreground px-2 py-1 text-xs text-background";

export const INVALID_AUDIO_FORMAT_MESSAGE =
  "Invalid audio format. Allowed: MP3, M4A, WAV, AAC, OGG";
export const AUDIO_TOO_LARGE_MESSAGE = "File exceeds the maximum size of 50 MB";

export const isSupportedAudioFile = (file: File): boolean => {
  const ext = file.name.split(".").pop()?.toLowerCase();
  return Boolean(ext) && AUDIO_EXTENSIONS.includes(ext as never);
};

/** Client-side mirror of the server's checks, so doomed uploads fail fast. */
export const validateAudioFile = (file: File): string | null => {
  if (!isSupportedAudioFile(file)) return INVALID_AUDIO_FORMAT_MESSAGE;
  if (file.size > MAX_ASSET_SIZE_BYTES) return AUDIO_TOO_LARGE_MESSAGE;
  return null;
};

export const formatFileSize = (bytes: number | null | undefined): string => {
  if (bytes == null || !Number.isFinite(bytes) || bytes <= 0) return "—";
  const mb = bytes / (1024 * 1024);
  if (mb >= 1) return `${mb.toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
};

export const formatDuration = (
  durationMs: number | null | undefined,
): string => {
  if (durationMs == null || !Number.isFinite(durationMs) || durationMs <= 0) {
    return "—";
  }
  const totalSeconds = Math.round(durationMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
};

/**
 * Reads a local file's duration for `duration_ms`. Resolves undefined rather
 * than rejecting — a missing duration must never block the upload.
 */
export const readAudioDurationMs = (file: File): Promise<number | undefined> =>
  new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(file);
    const audio = new Audio();
    let settled = false;

    const done = (value: number | undefined) => {
      if (settled) return;
      settled = true;
      URL.revokeObjectURL(objectUrl);
      resolve(value);
    };

    audio.addEventListener("loadedmetadata", () => {
      const seconds = audio.duration;
      done(
        Number.isFinite(seconds) && seconds > 0
          ? Math.round(seconds * 1000)
          : undefined,
      );
    });
    audio.addEventListener("error", () => done(undefined));
    // Metadata can stall on an unusual container; don't hold the upload.
    setTimeout(() => done(undefined), 5000);
    audio.src = objectUrl;
  });
