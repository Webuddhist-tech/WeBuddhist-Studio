import { useQuery } from "@tanstack/react-query";
import { fetchTextTitleByEditionId } from "./api/textPickerApi";

/** Resolves one edition id to a title for the preset form, when the list
 * response did not already include one. Returns null while loading or when
 * the id cannot be resolved. The presets table does not use this — titles
 * come back on the list itself. */
export const useTextTitle = (textId: string | null | undefined) => {
  const { data } = useQuery({
    queryKey: ["preset-text-title", textId],
    queryFn: () => fetchTextTitleByEditionId(textId as string),
    enabled: !!textId,
    staleTime: 30 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    retry: false,
  });
  return data ?? null;
};
