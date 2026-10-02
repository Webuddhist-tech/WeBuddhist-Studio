import { searchPlans } from "@/components/routes/create-series/api/planSearchApi";
import type { PlanTagSummary } from "@/components/routes/tags/api/tagsApi";
import type { TagSummaryDTO } from "./groupsApi";
import {
  fetchGroups,
  pickGroupTitle,
  resolveGroupAvatarUrl,
} from "./groupsApi";
import { searchSeries } from "./seriesSearchApi";
import { fetchDashboardItems } from "@/components/routes/dashboard/dashboardApi";
import type { FkOption } from "../components/FkMultiSearchSelector";

type PickerSearchParams = {
  search?: string;
  skip?: number;
  limit?: number;
};

const mapSearchResult = <
  T extends { id: string; title: string; image_url?: string },
>(
  items: T[],
  skip: number,
  limit: number,
  total: number,
) => ({
  items: items.map((item) => ({
    id: item.id,
    title: item.title,
    image_url: item.image_url,
  })),
  skip,
  limit,
  total,
});

export const searchPlansForPicker = async (params: PickerSearchParams) => {
  const result = await searchPlans(params);
  return mapSearchResult(result.plans, result.skip, result.limit, result.total);
};

export const searchSeriesForPicker = async (params: PickerSearchParams) => {
  const result = await searchSeries(params);
  return mapSearchResult(
    result.series,
    result.skip,
    result.limit,
    result.total,
  );
};

export const makeLinkedContentSearchFn =
  (groupId: string) => async (params: PickerSearchParams) => {
    const limit = params.limit ?? 20;
    const skip = params.skip ?? 0;
    const page = Math.floor(skip / limit) + 1;

    const { rows, pagination } = await fetchDashboardItems({
      tab: "all",
      group_id: groupId,
      search: params.search,
      page,
      pageSize: limit,
      // The event editor should only offer content an author can actually
      // publish an event against: the group's own published plans/series,
      // plus published series the group is partnered with (and their plans).
      status: "PUBLISHED",
      includePartnerGroups: true,
    });

    return {
      items: rows.map(
        (row): FkOption => ({
          id: row.id,
          title: row.title,
          image_url: row.image_url ?? undefined,
          kind: row.kind,
        }),
      ),
      skip,
      limit,
      total: pagination.total,
    };
  };

export function mapGroupTagsToPlanTagSummaries(
  tags: TagSummaryDTO[],
): PlanTagSummary[] {
  return tags.map((tag) => ({
    id: tag.id,
    name: tag.name,
    image: tag.image ?? null,
    image_key: tag.image_key ?? null,
    description: tag.description ?? null,
    metadata: [],
  }));
}

export function mapIdsToFkOptions(
  ids: string[],
  titleById: Map<string, string>,
): FkOption[] {
  return ids.map((id) => ({ id, title: titleById.get(id) ?? id }));
}

export const makeGroupPartnerSearchFn =
  (excludeIds: string[]) => async (params: PickerSearchParams) => {
    const limit = params.limit ?? 20;
    const skip = params.skip ?? 0;
    const page = Math.floor(skip / limit) + 1;
    const exclude = new Set(excludeIds);

    const data = await fetchGroups({
      page,
      limit,
      search: params.search,
    });

    const fetched = data.groups ?? [];
    const items: FkOption[] = fetched
      .filter((group) => !exclude.has(group.id))
      .map((group) => ({
        id: group.id,
        title: pickGroupTitle(group.metadata),
        image_url: resolveGroupAvatarUrl(group) ?? undefined,
      }));

    const removed = fetched.length - items.length;
    return {
      items,
      skip: skip + removed,
      limit,
      total: Math.max(data.total - removed, skip + items.length),
    };
  };
