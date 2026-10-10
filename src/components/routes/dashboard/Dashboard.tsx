import { Pecha } from "@/components/ui/shadimport";
import { DashboardContentTable } from "@/components/routes/dashboard/DashboardContentTable";
import {
  fetchDashboardItems,
  type DashboardTab,
} from "@/components/routes/dashboard/dashboardApi";
import type { DashboardRowKind } from "@/components/routes/dashboard/dashboardTable";
import {
  buildDashboardSearchParams,
  dashboardUrlStateToFetchParams,
  mergeDashboardUrlState,
  parseDashboardSearchParams,
  type DashboardPlanStatus,
  type DashboardUrlState,
} from "@/components/routes/dashboard/dashboardUrlState";
import { IoMdSearch } from "react-icons/io";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  Activity,
  type ReactNode,
} from "react";
import { useDebounce } from "use-debounce";
import { useTolgee, useTranslate } from "@tolgee/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axiosInstance from "@/config/axios-config";
import { Link, useSearchParams } from "react-router-dom";
import { ROUTES } from "@/routes/paths";
import { Pagination } from "@/components/ui/molecules/pagination/Pagination";
import AuthButton from "@/components/ui/molecules/auth-button/AuthButton";
import { toast } from "sonner";
import { useUserInfo } from "@/hooks/useUserInfo";
import { useLanguages } from "@/hooks/useLanguages";
import { useDashboardGroupFilterOptions } from "@/hooks/useDashboardGroupFilterOptions";
import { useGroupRolesMap } from "@/hooks/useGroupRolesMap";
import { isReviewer } from "@/lib/platformAccess";

const SEARCH_DEBOUNCE_MS = 500;

const toggleFeatured = async ({
  id,
  kind,
  featured,
}: {
  id: string;
  kind: DashboardRowKind;
  featured: boolean;
}) => {
  if (kind === "series") {
    const { data } = await axiosInstance.put(`/api/v1/cms/series/${id}`, {
      featured: !featured,
    });
    return data;
  }
  const { data } = await axiosInstance.patch(
    `/api/v1/cms/plans/${id}/featured`,
  );
  return data;
};

function DashboardListPlaceholder({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex w-full max-w-md flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 bg-white/80 px-8 py-16 text-center dark:border-[#313132] dark:bg-[#1d1d1f]/80">
      <p className="text-base font-medium text-foreground">{title}</p>
      {description ? (
        <p className="mt-2 text-sm text-muted-foreground">{description}</p>
      ) : null}
      {children ? (
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {children}
        </div>
      ) : null}
    </div>
  );
}

const Dashboard = () => {
  const { t } = useTranslate();
  const { data: userInfo } = useUserInfo();
  const { languageOptions } = useLanguages();
  const tolgee = useTolgee(["language"]);
  const localeLanguage = tolgee.getLanguage();
  const [searchParams, setSearchParams] = useSearchParams();

  const urlState = useMemo(
    () => parseDashboardSearchParams(searchParams),
    [searchParams],
  );

  const [searchDraft, setSearchDraft] = useState(urlState.search ?? "");
  const [debouncedSearchDraft] = useDebounce(searchDraft, SEARCH_DEBOUNCE_MS);

  useEffect(() => {
    setSearchDraft(urlState.search ?? "");
  }, [urlState.search]);

  const replaceUrlState = useCallback(
    (patch: Partial<DashboardUrlState>) => {
      const next = mergeDashboardUrlState(urlState, patch);
      setSearchParams(buildDashboardSearchParams(next), { replace: true });
    },
    [urlState, setSearchParams],
  );

  const resetPageFilters = useMemo(() => ({ page: 1 as const }), []);

  useEffect(() => {
    const trimmed = debouncedSearchDraft.trim();
    const committed = urlState.search ?? "";
    if (trimmed === committed) return;
    replaceUrlState({
      search: trimmed || null,
      ...resetPageFilters,
    });
  }, [
    debouncedSearchDraft,
    urlState.search,
    replaceUrlState,
    resetPageFilters,
  ]);

  const {
    options: groupFilterOptions,
    rolesByGroupId,
    isLoading: isGroupFilterLoading,
    showFilter: showGroupFilter,
    isStaffWideList: isStaffWideGroupList,
    allowedGroupIds,
  } = useDashboardGroupFilterOptions(userInfo, "COMMUNITY");

  const fetchParams = useMemo(
    () => ({
      ...dashboardUrlStateToFetchParams(urlState),
      localeLanguage,
    }),
    [urlState, localeLanguage],
  );

  const {
    data: dashboardData,
    status,
    isFetching,
    error,
    isError,
  } = useQuery({
    queryKey: ["dashboard-items", fetchParams],
    queryFn: () => fetchDashboardItems(fetchParams),
    refetchOnWindowFocus: false,
    retry: false,
  });

  const totalPages = dashboardData?.pagination.total_pages ?? 1;

  useEffect(() => {
    if (status !== "success") return;
    if (urlState.page > totalPages && totalPages > 0) {
      replaceUrlState({ page: totalPages });
    }
  }, [status, urlState.page, totalPages, replaceUrlState]);

  const queryClient = useQueryClient();
  const featuredMutation = useMutation({
    mutationFn: toggleFeatured,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dashboard-items"] });
    },
    onError: (err: unknown) => {
      const message =
        (err as { response?: { data?: { detail?: { message?: string } } } })
          ?.response?.data?.detail?.message ??
        t("studio.dashboard.featured_update_failed");
      toast.error(message);
    },
  });

  const handleFeatured = (
    id: string,
    kind: DashboardRowKind,
    featured: boolean,
  ) => {
    featuredMutation.mutate({ id, kind, featured });
  };

  const setTab = (next: DashboardTab) => {
    replaceUrlState({ tab: next, ...resetPageFilters });
  };

  const rows = dashboardData?.rows ?? [];

  const groupIdsMissingRole = useMemo(
    () =>
      rows
        .map((r) => r.group_id)
        .filter((id): id is string => Boolean(id) && !rolesByGroupId.has(id!)),
    [rows, rolesByGroupId],
  );

  const fallbackRolesByGroupId = useGroupRolesMap(
    groupIdsMissingRole,
    userInfo
      ? {
          id: userInfo.id,
          email: userInfo.email,
          platform_role: userInfo.platform_role,
        }
      : undefined,
  );

  const mergedGroupRolesByGroupId = useMemo(() => {
    if (fallbackRolesByGroupId.size === 0) return rolesByGroupId;
    const merged = new Map(rolesByGroupId);
    fallbackRolesByGroupId.forEach((role, id) => {
      if (role && !merged.has(id)) merged.set(id, role);
    });
    return merged;
  }, [rolesByGroupId, fallbackRolesByGroupId]);

  useEffect(() => {
    if (isStaffWideGroupList) return;
    if (!urlState.groupId || isGroupFilterLoading) return;
    if (!allowedGroupIds.has(urlState.groupId)) {
      replaceUrlState({ groupId: null, ...resetPageFilters });
    }
  }, [
    urlState.groupId,
    allowedGroupIds,
    isGroupFilterLoading,
    isStaffWideGroupList,
    replaceUrlState,
    resetPageFilters,
  ]);

  const platformReadOnly = isReviewer(userInfo?.platform_role);
  const hasRows = rows.length > 0;
  const isLoadingTable = status === "pending" || isFetching;
  const showEmpty = status === "success" && !hasRows;

  const chipClass = (active: boolean) =>
    `rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
      active
        ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
        : "border border-gray-200 bg-white text-gray-800 hover:bg-gray-50 dark:border-[#313132] dark:bg-transparent dark:text-gray-200 dark:hover:bg-[#2a2a2a]"
    }`;

  const emptyTitle =
    urlState.tab === "plans"
      ? t("studio.dashboard.no_plan_found")
      : urlState.tab === "series"
        ? t("studio.dashboard.no_series_found")
        : t("studio.dashboard.nothing_to_show");

  const emptyDescription =
    urlState.tab === "plans"
      ? t("studio.dashboard.empty_plans_description")
      : urlState.tab === "series"
        ? t("studio.dashboard.empty_series_description")
        : t("studio.dashboard.empty_all_description");

  const groupFilterValue = urlState.groupId ?? "all";

  const filterBar = (
    <div className="flex w-full flex-wrap items-end gap-4 px-4 pb-2 pt-3">
      {showGroupFilter ? (
        <div className="flex min-w-[200px] flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">
            {t("studio.dashboard.filter.spaces")}
          </span>
          <Pecha.Select
            value={groupFilterValue}
            onValueChange={(v) => {
              replaceUrlState({
                groupId: v === "all" ? null : v,
                ...resetPageFilters,
              });
            }}
            disabled={isGroupFilterLoading}
          >
            <Pecha.SelectTrigger className="h-9 w-[220px] bg-white dark:bg-input/30">
              <Pecha.SelectValue
                placeholder={
                  isGroupFilterLoading
                    ? t("studio.dashboard.filter.loading_spaces")
                    : t("studio.dashboard.filter.all_spaces")
                }
              />
            </Pecha.SelectTrigger>
            <Pecha.SelectContent>
              <Pecha.SelectItem value="all">
                {t("studio.dashboard.filter.all_spaces")}
              </Pecha.SelectItem>
              {groupFilterOptions.map((group) => (
                <Pecha.SelectItem key={group.id} value={group.id}>
                  {group.label}
                </Pecha.SelectItem>
              ))}
            </Pecha.SelectContent>
          </Pecha.Select>
        </div>
      ) : null}

      <div className="flex min-w-[160px] flex-col gap-1">
        <span className="text-xs font-medium text-muted-foreground">
          {t("studio.common.language")}
        </span>
        <Pecha.Select
          value={urlState.language || "all"}
          onValueChange={(v) => {
            replaceUrlState({
              language: v === "all" ? null : v,
              ...resetPageFilters,
            });
          }}
        >
          <Pecha.SelectTrigger className="h-9 w-[180px] bg-white dark:bg-input/30">
            <Pecha.SelectValue placeholder={t("studio.common.language")} />
          </Pecha.SelectTrigger>
          <Pecha.SelectContent>
            <Pecha.SelectItem value="all">
              {t("studio.dashboard.filter.all_languages")}
            </Pecha.SelectItem>
            {languageOptions.map((lang) => (
              <Pecha.SelectItem key={lang.value} value={lang.value}>
                {lang.label}
              </Pecha.SelectItem>
            ))}
          </Pecha.SelectContent>
        </Pecha.Select>
      </div>
      <div className="flex min-w-[160px] flex-col gap-1">
        <span className="text-xs font-medium text-muted-foreground">
          {t("studio.common.status")}
        </span>
        <Pecha.Select
          value={urlState.status || "all"}
          onValueChange={(v) => {
            replaceUrlState({
              status: v === "all" ? null : (v as DashboardPlanStatus),
              ...resetPageFilters,
            });
          }}
        >
          <Pecha.SelectTrigger className="h-9 w-[200px] bg-white dark:bg-input/30">
            <Pecha.SelectValue placeholder={t("studio.common.status")} />
          </Pecha.SelectTrigger>
          <Pecha.SelectContent>
            <Pecha.SelectItem value="all">
              {t("studio.dashboard.filter.all_statuses")}
            </Pecha.SelectItem>
            <Pecha.SelectItem value="DRAFT">
              {t("studio.common.draft")}
            </Pecha.SelectItem>
            <Pecha.SelectItem value="PUBLISHED">
              {t("studio.common.published")}
            </Pecha.SelectItem>
            <Pecha.SelectItem value="UNPUBLISHED">
              {t("studio.dashboard.status.unpublished")}
            </Pecha.SelectItem>
            <Pecha.SelectItem value="ARCHIVED">
              {t("studio.dashboard.status.archived")}
            </Pecha.SelectItem>
          </Pecha.SelectContent>
        </Pecha.Select>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col border h-[calc(100vh-40px)] overflow-auto bg-[#F5F5F5] dark:bg-[#181818] my-4 rounded-l-2xl font-dynamic max-md:my-0 max-md:h-full max-md:rounded-none max-md:border-0">
      <div className="mb-4 px-4 pt-10 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="border w-fit px-2 bg-white dark:bg-input/30 rounded-md border-gray-200 dark:border-[#313132] flex items-center">
            <IoMdSearch className="w-4 h-4 shrink-0" />
            <Pecha.Input
              placeholder={t("common.placeholder.search")}
              className="rounded-md border-none dark:bg-transparent px-4 shadow-none py-2"
              value={searchDraft}
              onChange={(e) => setSearchDraft(e.target.value)}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 pl-1">
            <button
              type="button"
              className={chipClass(urlState.tab === "all")}
              onClick={() => setTab("all")}
            >
              {t("studio.common.all")}
            </button>
            <button
              type="button"
              className={chipClass(urlState.tab === "plans")}
              onClick={() => setTab("plans")}
            >
              {t("studio.dashboard.tab.plans")}
            </button>
            <button
              type="button"
              className={chipClass(urlState.tab === "series")}
              onClick={() => setTab("series")}
            >
              {t("studio.dashboard.tab.series")}
            </button>
          </div>
        </div>
        <AuthButton />
      </div>
      <div className="border-b w-full border-dashed border-gray-300 dark:border-input" />
      {filterBar}

      <div className="flex flex-1 flex-col items-center px-4 pb-6 pt-2">
        {isError && error && (
          <DashboardListPlaceholder
            title={t("studio.dashboard.load_failed")}
            description={String(error.message)}
          />
        )}

        {showEmpty && (
          <DashboardListPlaceholder
            title={emptyTitle}
            description={
              emptyDescription ??
              t("studio.dashboard.empty_default_description")
            }
          >
            <Link to={ROUTES.groups}>
              <Pecha.Button variant="outline" size="sm">
                {t("studio.dashboard.go_to_groups")}
              </Pecha.Button>
            </Link>
          </DashboardListPlaceholder>
        )}
        {!isError && !showEmpty && (
          <div className="w-full overflow-x-auto">
            <DashboardContentTable
              rows={rows}
              isLoading={isLoadingTable}
              t={t}
              handleFeatured={platformReadOnly ? () => {} : handleFeatured}
              platformRole={userInfo?.platform_role}
              groupRolesByGroupId={mergedGroupRolesByGroupId}
              userInfo={userInfo}
            />
          </div>
        )}
      </div>

      <Activity mode={hasRows ? "visible" : "hidden"}>
        <Pagination
          currentPage={urlState.page}
          totalPages={totalPages}
          onPageChange={(nextPage) => replaceUrlState({ page: nextPage })}
        />
      </Activity>
    </div>
  );
};

export default Dashboard;
