import axiosInstance from "@/config/axios-config";
import { enrichDashboardRows } from "./enrichDashboardRows";
import {
  normalizeStatus,
  parseDashboardLanguages,
  pickSeriesTitle,
  resolveDashboardItemImageUrl,
  type DashboardImageVariants,
  tolgeeLocaleToDashboardLanguage,
  type DashboardTableRow,
} from "./dashboardTable";
import { capitalizeFirstLetter } from "@/lib/textUtils";

/** Series rows omit `title` in JSON; titles live in `metadata`. */
export function displayDashboardItemTitle(
  item: DashboardApiItem,
  localeLanguage?: string,
): string {
  if (item.type === "plan") {
    const title = item.title?.trim() || "Untitled plan";
    return capitalizeFirstLetter(title);
  }
  const preferredLanguage = tolgeeLocaleToDashboardLanguage(localeLanguage);
  const fromMeta = pickSeriesTitle(
    undefined,
    item.metadata,
    preferredLanguage ?? undefined,
  );
  const title = fromMeta === "Untitled" ? "Untitled series" : fromMeta;
  return capitalizeFirstLetter(title);
}

function mapDashboardItemToTableRow(
  item: DashboardApiItem,
  localeLanguage?: string,
): DashboardTableRow {
  return {
    kind: item.type,
    id: String(item.id),
    title: displayDashboardItemTitle(item, localeLanguage),
    image_url: resolveDashboardItemImageUrl(item),
    languages: parseDashboardLanguages(item.languages),
    status: normalizeStatus(item.status),
    total_days: item.total_days ?? 0,
    enrolled: item.enrolled_count ?? 0,
    modifiedAt: item.updated_at ?? item.created_at ?? null,
    featured: !!item.featured,
    group_id: item.group_id ?? null,
    series_id: item.series_id ?? null,
    ...(item.type === "series" && {
      plans_count: item.plans_count ?? 0,
    }),
  };
}

export type DashboardTab = "all" | "plans" | "series";

export interface DashboardSeriesMetadataDTO {
  id: string;
  title: string;
  description?: string;
  language: string;
}

export interface DashboardApiItem {
  id: string;
  type: "plan" | "series";
  /** Plans only; omitted from JSON for series. */
  title?: string;
  metadata?: DashboardSeriesMetadataDTO[];
  author_id?: string | null;
  group_id?: string | null;
  series_id?: string | null;
  image_url?: string | null;
  plan_image_url?: string | null;
  image_key?: string | null;
  image?: string | DashboardImageVariants | null;
  status: string;
  featured: boolean;
  languages: string[];
  enrolled_count: number;
  plans_count?: number | null;
  total_days?: number | null;
  updated_at?: string | null;
  created_at: string;
}

export interface DashboardPagination {
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
}

export interface DashboardItemsResponse {
  items: DashboardApiItem[];
  pagination: DashboardPagination;
}

export interface FetchDashboardItemsParams {
  tab: DashboardTab;
  page: number;
  pageSize?: number;
  search?: string;
  status?: string;
  language?: string;
  featured?: boolean;
  group_id?: string;
  /** Also include series/plans the group is a SeriesPartner of, not just owned. */
  includePartnerGroups?: boolean;
  /** Tolgee UI locale used to pick localized series titles from metadata. */
  localeLanguage?: string;
}

export interface DashboardItemsResult {
  rows: DashboardTableRow[];
  pagination: DashboardPagination;
}

const DASHBOARD_ITEMS_PATH = "/api/v1/cms/dashboard/items";

export const DASHBOARD_PAGE_SIZE = 10;

export async function fetchDashboardItems(
  params: FetchDashboardItemsParams,
): Promise<DashboardItemsResult> {
  const pageSize = params.pageSize ?? DASHBOARD_PAGE_SIZE;

  const { data } = await axiosInstance.get<DashboardItemsResponse>(
    DASHBOARD_ITEMS_PATH,
    {
      params: {
        tab: params.tab,
        page: params.page,
        page_size: pageSize,
        ...(params.search?.trim() && { search: params.search.trim() }),
        ...(params.status && { status: params.status }),
        ...(params.language && { language: params.language }),
        ...(params.featured != null && { featured: params.featured }),
        ...(params.group_id && { group_id: params.group_id }),
        ...(params.includePartnerGroups && { include_partner_groups: true }),
      },
    },
  );
  const items = data?.items ?? [];
  const pagination = data?.pagination ?? {
    page: params.page,
    page_size: pageSize,
    total: items.length,
    total_pages: items.length > 0 ? 1 : 0,
  };

  const rows = await enrichDashboardRows(
    items.map((item) =>
      mapDashboardItemToTableRow(item, params.localeLanguage),
    ),
  );

  return {
    rows,
    pagination,
  };
}
