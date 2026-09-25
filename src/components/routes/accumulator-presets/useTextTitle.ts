import { useQuery } from "@tanstack/react-query";
import { fetchTextTitleByEditionId } from "./api/textPickerApi";

/** Resolves a preset's `text_id` (an OpenPecha edition id) to the text's
 * title. Cached per edition id, so the table and the edit dialog share one
 * lookup. Returns null while loading or when the id cannot be resolved. */
export const useTextTitle = (textId: string | null | undefined) => {
  const { data } = useQuery({
    queryKey: ["preset-text-title", textId],
    queryFn: () => fetchTextTitleByEditionId(textId as string),
    enabled: !!textId,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
  return data ?? null;
};
