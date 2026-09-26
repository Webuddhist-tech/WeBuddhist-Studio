import { useQuery } from "@tanstack/react-query";
import { fetchTextTitleByEditionId } from "./api/textPickerApi";

/** Resolves a preset's `text_id` (an OpenPecha edition id) to the text's
 * title. Returns null while loading or when the id cannot be resolved.
 *
 * There is no bulk id -> title endpoint, so a list page costs one lookup per
 * distinct linked text. The cache key is the edition id alone, so repeated
 * ids on a page share one request, and titles are held long enough that
 * paging, reopening the edit dialog and returning to the list are all free. */
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
