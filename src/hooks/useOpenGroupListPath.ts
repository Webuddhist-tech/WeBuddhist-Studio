import { useQuery } from "@tanstack/react-query";
import { matchPath } from "react-router-dom";
import { fetchGroup } from "@/components/routes/groups/api/groupsApi";
import { groupKindOf } from "@/components/routes/groups/lib/groupKind";
import { ROUTES } from "@/routes/paths";

/**
 * Temples and pages share the `/groups/:groupId` routes, so only the open group
 * knows which list it belongs to. Reuses GroupLayout's query, so it adds no
 * request. `listPath` stays undefined while that group is still loading.
 */
export function useOpenGroupListPath(pathname: string): {
  isGroupRoute: boolean;
  listPath: string | undefined;
} {
  const groupId = matchPath({ path: "/groups/:groupId/*" }, pathname)?.params
    .groupId;
  const isGroupRoute = Boolean(groupId) && pathname !== ROUTES.groupNew;

  const { data: listPath } = useQuery({
    queryKey: ["cms-group", groupId],
    queryFn: () => fetchGroup(groupId!),
    enabled: isGroupRoute,
    refetchOnWindowFocus: false,
    select: (group) => groupKindOf(group.group_type).listPath,
  });

  return { isGroupRoute, listPath: isGroupRoute ? listPath : undefined };
}
