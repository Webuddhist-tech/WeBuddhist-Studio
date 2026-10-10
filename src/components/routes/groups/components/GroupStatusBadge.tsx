import { useTranslate } from "@tolgee/react";
import type { AuthorGroupStatus } from "../api/groupsApi";

/** Mirrors the plan/series status chip palette. */
const STATUS_STYLES: Record<AuthorGroupStatus, string> = {
  PUBLISHED:
    "bg-green-100 text-[#4BBE51] dark:bg-green-900/40 dark:text-green-200",
  UNPUBLISHED: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200",
  DRAFT: "bg-[#E0EDFE] text-[#020C1D] dark:bg-blue-950/50 dark:text-white",
};

const STATUS_LABELS: Record<AuthorGroupStatus, string> = {
  PUBLISHED: "studio.common.published",
  UNPUBLISHED: "studio.groups.components.status.unpublished",
  DRAFT: "studio.common.draft",
};

type GroupStatusBadgeProps = {
  status?: AuthorGroupStatus;
  className?: string;
};

const GroupStatusBadge = ({ status, className }: GroupStatusBadgeProps) => {
  const { t } = useTranslate();
  if (!status) return null;
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[status]} ${className ?? ""}`}
    >
      {t(STATUS_LABELS[status])}
    </span>
  );
};

export default GroupStatusBadge;
