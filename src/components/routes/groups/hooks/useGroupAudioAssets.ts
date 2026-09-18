import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getApiErrorMessage } from "@/lib/apiErrors";
import {
  AUDIO_TOO_LARGE_MESSAGE,
  fetchGroupAssets,
  readAudioDurationMs,
  uploadGroupAsset,
  validateAudioFile,
  type GroupAssetDTO,
} from "../api/groupAssetsApi";

export const GROUP_ASSETS_PAGE_SIZE = 10;

type UseGroupAudioAssetsParams = {
  groupId: string | undefined;
  search?: string;
  page?: number;
  pageSize?: number;
  enabled?: boolean;
  /** Called with the new asset once an upload lands. */
  onUploaded?: (asset: GroupAssetDTO) => void;
};

/**
 * The group's audio library: the picker's source, and the Assets page's.
 * Uploading links nothing, so it invalidates `cms-group-assets` only — the
 * chant collection cache is deliberately left alone.
 */
export const useGroupAudioAssets = ({
  groupId,
  search = "",
  page = 1,
  pageSize = GROUP_ASSETS_PAGE_SIZE,
  enabled = true,
  onUploaded,
}: UseGroupAudioAssetsParams) => {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const query = useQuery({
    queryKey: ["cms-group-assets", groupId, "AUDIO", search, page],
    queryFn: () =>
      fetchGroupAssets(groupId!, {
        assetType: "AUDIO",
        search,
        skip: (page - 1) * pageSize,
        limit: pageSize,
      }),
    enabled: Boolean(groupId) && enabled,
    refetchOnWindowFocus: false,
  });

  const invalidateAssets = useCallback(() => {
    queryClient.invalidateQueries({
      queryKey: ["cms-group-assets", groupId],
    });
  }, [queryClient, groupId]);

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const durationMs = await readAudioDurationMs(file);
      return uploadGroupAsset(groupId!, file, { durationMs });
    },
    onSuccess: (asset) => {
      toast.success("Audio added to the library");
      invalidateAssets();
      onUploaded?.(asset);
    },
    onError: (err) => {
      const status = (err as { response?: { status?: number } })?.response
        ?.status;
      if (status === 413) {
        toast.error("Failed to upload audio", {
          description: AUDIO_TOO_LARGE_MESSAGE,
        });
        return;
      }
      toast.error("Failed to upload audio", {
        description: getApiErrorMessage(err),
      });
    },
  });

  const { mutate: runUpload } = uploadMutation;

  const uploadAsset = useCallback(
    (file: File) => {
      const validationError = validateAudioFile(file);
      if (validationError) {
        toast.error("Failed to upload audio", {
          description: validationError,
        });
        return;
      }
      runUpload(file);
    },
    [runUpload],
  );

  const resetFileInput = useCallback(() => {
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  return {
    assets: query.data?.assets ?? [],
    total: query.data?.total ?? 0,
    pageSize,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    isUploading: uploadMutation.isPending,
    uploadAsset,
    fileInputRef,
    resetFileInput,
    invalidateAssets,
  };
};

/** Debounces a search box so typing does not fire a request per keystroke. */
export const useDebouncedValue = <T>(value: T, delayMs = 300): T => {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
};
