import { fetchTextLanguages, searchTitles } from "@/components/api/searchApi";
import type { TextLanguagesResponse } from "@/components/api/searchApi";
import type { FkOption } from "@/components/routes/groups/components/FkMultiSearchSelector";

type TitleSearchItem = {
  id: string;
  title?: string | null;
};

type TitleSearchResponse = {
  sources?: TitleSearchItem[];
  texts?: TitleSearchItem[];
  results?: TitleSearchItem[];
  total?: number;
};

function extractItems(
  data: TitleSearchResponse | TitleSearchItem[],
): TitleSearchItem[] {
  if (Array.isArray(data)) return data;
  return data.sources ?? data.texts ?? data.results ?? [];
}

/** Wrap title-search into EventLinkPicker / FkOption shape. */
export async function searchTextsForPicker(params: {
  search?: string;
  skip?: number;
  limit?: number;
}): Promise<{
  items: FkOption[];
  skip: number;
  limit: number;
  total: number;
}> {
  const skip = params.skip ?? 0;
  const limit = params.limit ?? 20;
  const title = params.search?.trim() ?? "";

  if (!title) {
    return { items: [], skip, limit, total: 0 };
  }

  const data = (await searchTitles({
    title,
    limit,
    offset: skip,
  })) as TitleSearchResponse | TitleSearchItem[];

  const items = extractItems(data)
    .filter((item) => item?.id)
    .map((item) => ({
      id: item.id,
      title: item.title?.trim() || item.id,
    }));

  const total =
    !Array.isArray(data) && typeof data.total === "number"
      ? data.total
      : skip + items.length + (items.length === limit ? 1 : 0);

  return { items, skip, limit, total };
}

/** Resolve an OpenPecha edition id to its text title.
 *
 * Preset `text_id`s are edition ids, so the CMS only ever gets the id back
 * from the API. `/texts/{edition_id}/languages` takes an edition id and
 * carries the text's title, which is the cheapest name lookup available. */
export async function fetchTextTitleByEditionId(
  editionId: string,
): Promise<string | null> {
  const data = (await fetchTextLanguages(editionId)) as
    | Partial<TextLanguagesResponse>
    | null
    | undefined;
  return data?.title?.trim() || null;
}
