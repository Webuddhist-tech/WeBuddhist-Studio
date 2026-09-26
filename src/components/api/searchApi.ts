import axiosInstance from "@/config/axios-config";

type SearchCommon = {
  query: string;
  limit?: number;
  skip?: number;
};

type SearchTitle = {
  title: string;
  limit?: number;
  offset?: number;
};

type SearchTextDetails = {
  textId: string;
  contentId?: string;
  segmentId?: string;
  direction?: "next" | "previous";
  size?: number;
  start?: number;
  end?: number;
};
export const searchSources = async ({
  query,
  limit = 10,
  skip = 0,
}: SearchCommon) => {
  const { data } = await axiosInstance.get(`/api/v1/search/multilingual`, {
    params: {
      query,
      search_type: "exact",
      limit,
      skip,
    },
  });
  return data;
};

export const searchTitles = async ({
  title,
  limit = 20,
  offset = 0,
}: SearchTitle) => {
  const { data } = await axiosInstance.get(`/api/v1/texts/title-search`, {
    params: {
      title,
      limit,
      offset,
    },
  });
  return data;
};

export const fetchTextDetails = async ({
  textId,
  contentId,
  segmentId,
  direction = "next",
  size = 20,
  start,
  end,
}: SearchTextDetails) => {
  const { data } = await axiosInstance.post(`/api/v1/texts/${textId}/details`, {
    ...(contentId && { content_id: contentId }),
    ...(segmentId && { segment_id: segmentId }),
    ...(start != null && { start }),
    ...(end != null && { end }),
    direction,
    size,
  });
  return data;
};

type SearchSegments = {
  content: string;
};

export type SegmentSearchResult = {
  id: string;
  pecha_segment_id?: string;
  text_id: string;
  content: string;
  type: string;
};

export type SegmentSearchResponse = {
  segments: SegmentSearchResult[];
};

export const searchSegments = async ({
  content,
}: SearchSegments): Promise<SegmentSearchResponse> => {
  const { data } = await axiosInstance.post(`/api/v1/segments/search`, {
    content,
  });
  return data;
};

export type AvailableLanguage = {
  language: string;
  language_code: string;
  version_count: number;
};

/** Response of `/texts/{edition_id}/languages`: the text's title plus the
 * languages it has versions in. */
export type TextLanguagesResponse = {
  text_id: string;
  title: string;
  available_languages: AvailableLanguage[];
};

export const fetchTextLanguages = async (
  textId: string,
): Promise<TextLanguagesResponse> => {
  const { data } = await axiosInstance.get<TextLanguagesResponse>(
    `/api/v1/texts/${textId}/languages`,
  );
  return data;
};

export const fetchLanguageVersions = async (
  textId: string,
  language: string,
) => {
  const { data } = await axiosInstance.get(
    `/api/v1/texts/${textId}/languages/${language}/versions`,
  );
  return data;
};

export type { SearchCommon };
