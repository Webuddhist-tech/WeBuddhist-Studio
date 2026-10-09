import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  fetchAccessibleGroupsForDashboard,
  pickGroupTitle,
  type AuthorGroupListItem,
  type AuthorGroupMemberRole,
  type AuthorGroupType,
} from "@/components/routes/groups/api/groupsApi";
import type { UserInfo } from "@/hooks/useUserInfo";
import {
  canUseDashboardGroupFilter,
  usesStaffWideDashboardGroupList,
} from "@/lib/platformAccess";

export type DashboardGroupFilterOption = {
  id: string;
  title: string;
  /** Dropdown label (includes membership role for creators when known). */
  label: string;
};

function toFilterOptions(
  groups: AuthorGroupListItem[],
  showMemberRole: boolean,
): DashboardGroupFilterOption[] {
  return groups.map((group) => {
    const title = pickGroupTitle(group.metadata);
    const role = group.my_role;
    const label = showMemberRole && role ? `${title} (${role})` : title;
    return { id: group.id, title, label };
  });
}

function rolesMapFromGroups(
  groups: AuthorGroupListItem[],
): Map<string, AuthorGroupMemberRole | undefined> {
  const map = new Map<string, AuthorGroupMemberRole | undefined>();
  for (const group of groups) {
    if (group.my_role) map.set(group.id, group.my_role);
  }
  return map;
}

export function useDashboardGroupFilterOptions(
  userInfo?: UserInfo | null,
  /** Limit the filter options to one group type (roles still cover all groups). */
  groupType?: AuthorGroupType,
) {
  const platformRole = userInfo?.platform_role;
  const isStaffWideList = usesStaffWideDashboardGroupList(platformRole);
  const canLoad = canUseDashboardGroupFilter(userInfo);

  const query = useQuery({
    queryKey: ["dashboard-group-filter", platformRole, userInfo?.has_group],
    queryFn: () => fetchAccessibleGroupsForDashboard(userInfo),
    enabled: canLoad,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const options = useMemo(() => {
    const groups = query.data ?? [];
    const filtered = groupType
      ? groups.filter((group) => group.group_type === groupType)
      : groups;
    return toFilterOptions(filtered, !isStaffWideList);
  }, [query.data, isStaffWideList, groupType]);

  const rolesByGroupId = useMemo(
    () => rolesMapFromGroups(query.data ?? []),
    [query.data],
  );

  return {
    options,
    rolesByGroupId,
    isLoading: query.isLoading,
    isStaffWideList,
    showFilter: canLoad && (options.length > 0 || isStaffWideList),
    /** Creators: only group_ids returned from the membership list API. */
    allowedGroupIds: useMemo(
      () => new Set(options.map((g) => g.id)),
      [options],
    ),
  };
}
