import { DropdownButton } from "@/components/ui/molecules/dropdown-button/DropdownButton";
import { DASHBOARD_TABLE_ICON_BTN } from "@/components/routes/dashboard/dashboardTable";
import type { AuthorGroupMemberRole } from "@/components/routes/groups/api/groupsApi";
import type { PlatformRole } from "@/lib/platformAccess";
import { canEditContent } from "@/lib/contentPermissions";
import { useTranslate } from "@tolgee/react";

type SeriesPlanRowActionsProps = {
  planId: string;
  planTitle: string;
  status: string;
  seriesId: string;
  sourceGroupId?: string | null;
  groupRole?: AuthorGroupMemberRole;
  platformRole?: PlatformRole;
  readOnly?: boolean;
  onRemoveFromSeries: () => void;
};

export function SeriesPlanRowActions({
  planId,
  planTitle,
  status,
  seriesId,
  sourceGroupId,
  groupRole,
  platformRole,
  readOnly = false,
  onRemoveFromSeries,
}: SeriesPlanRowActionsProps) {
  const { t } = useTranslate();
  const canRemove =
    !readOnly && canEditContent(groupRole, status, platformRole);

  const additionalMenuItems = canRemove
    ? [
        {
          label: t("studio.series.plans.remove_from_series"),
          onClick: onRemoveFromSeries,
        },
      ]
    : [];

  return (
    <DropdownButton
      id={planId}
      entityType="plan"
      currentStatus={status}
      triggerVariant="icon"
      triggerClassName={DASHBOARD_TABLE_ICON_BTN}
      invalidateSeriesId={seriesId}
      platformRole={platformRole}
      groupRole={groupRole}
      sourceGroupId={sourceGroupId}
      contentTitle={planTitle}
      readOnly={readOnly}
      additionalMenuItems={additionalMenuItems}
    />
  );
}
