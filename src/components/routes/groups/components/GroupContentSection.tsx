import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { IoMdAdd } from "react-icons/io";
import { Button } from "@/components/ui/atoms/button";
import { fetchGroupContentRows } from "../api/groupContentApi";
import { DashboardContentTable } from "@/components/routes/dashboard/DashboardContentTable";
import { useTranslate } from "@tolgee/react";
import { ROUTES } from "@/routes/paths";
import { isReviewer } from "@/lib/platformAccess";
import type { UserInfo } from "@/hooks/useUserInfo";
import type { AuthorGroupMemberRole } from "../api/groupsApi";
import { GroupDetailCard } from "./GroupSection";

type GroupContentSectionProps = {
  groupId: string;
  userInfo?: UserInfo | null;
  groupRole?: AuthorGroupMemberRole;
  readOnlyPlatform?: boolean;
};

const GroupContentSection = ({
  groupId,
  userInfo,
  groupRole,
  readOnlyPlatform = false,
}: GroupContentSectionProps) => {
  const { t } = useTranslate();
  const platformReadOnly =
    readOnlyPlatform || isReviewer(userInfo?.platform_role);
  const canCreate =
    !platformReadOnly && groupRole != null && groupRole !== "VIEWER";

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["dashboard-items", "group", groupId],
    queryFn: () => fetchGroupContentRows(groupId, { pageSize: 100 }),
    refetchOnWindowFocus: false,
  });

  const rows = data ?? [];

  return (
    <GroupDetailCard title={t("studio.groups.components.content.title")}>
      {canCreate ? (
        <div className="mb-4 flex flex-wrap gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link to={ROUTES.groupPlanNew(groupId)}>
              <IoMdAdd className="h-4 w-4" />{" "}
              {t("studio.groups.components.content.add_plan")}
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link to={ROUTES.groupSeriesNew(groupId)}>
              <IoMdAdd className="h-4 w-4" />{" "}
              {t("studio.groups.components.content.add_series")}
            </Link>
          </Button>
        </div>
      ) : null}

      {isError ? (
        <p className="text-sm text-destructive">{String(error)}</p>
      ) : rows.length === 0 && !isLoading ? (
        <p className="text-sm text-muted-foreground">
          {t("studio.groups.components.content.empty")}
          {canCreate
            ? ` ${t("studio.groups.components.content.empty_hint")}`
            : null}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <DashboardContentTable
            rows={rows}
            t={t}
            handleFeatured={() => {}}
            platformRole={userInfo?.platform_role}
            groupRolesByGroupId={new Map([[groupId, groupRole]])}
            userInfo={userInfo}
          />
        </div>
      )}
    </GroupDetailCard>
  );
};

export default GroupContentSection;
