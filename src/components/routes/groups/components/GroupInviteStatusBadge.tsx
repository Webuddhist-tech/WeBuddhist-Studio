import { useTranslate } from "@tolgee/react";
import type { AuthorGroupInviteStatus } from "../api/groupsApi";

const STATUS_STYLES: Record<AuthorGroupInviteStatus, string> = {
  PENDING: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  ACCEPTED: "bg-green-100 text-green-900 dark:bg-green-950 dark:text-green-200",
  REJECTED: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  REVOKED: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  EXPIRED: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200",
};

type GroupInviteStatusBadgeProps = {
  status: AuthorGroupInviteStatus;
};

const GroupInviteStatusBadge = ({ status }: GroupInviteStatusBadgeProps) => {
  const { t } = useTranslate();
  return (
    <span
      className={`inline-flex rounded px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[status]}`}
    >
      {t(`studio.groups.components.status.${status.toLowerCase()}`)}
    </span>
  );
};

export default GroupInviteStatusBadge;
