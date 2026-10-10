import { useTranslate } from "@tolgee/react";
import type { GroupJoinRequestStatus } from "../api/groupJoinRequestsApi";

const STATUS_STYLES: Record<GroupJoinRequestStatus, string> = {
  PENDING:
    "border-amber-200 bg-amber-100 text-amber-900 dark:border-amber-800/60 dark:bg-amber-950 dark:text-amber-200",
  APPROVED:
    "border-green-200 bg-green-100 text-green-900 dark:border-green-800/60 dark:bg-green-950 dark:text-green-200",
  REJECTED:
    "border-gray-300 bg-gray-100 text-gray-700 dark:border-gray-600/60 dark:bg-gray-800 dark:text-gray-300",
};

type GroupJoinRequestStatusBadgeProps = {
  status: GroupJoinRequestStatus;
};

const GroupJoinRequestStatusBadge = ({
  status,
}: GroupJoinRequestStatusBadgeProps) => {
  const { t } = useTranslate();
  return (
    <span
      className={`inline-flex rounded border px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[status]}`}
    >
      {t(`studio.groups.components.status.${status.toLowerCase()}`)}
    </span>
  );
};

export default GroupJoinRequestStatusBadge;
