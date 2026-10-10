import { useTranslate } from "@tolgee/react";
import {
  TEXT_REQUEST_STATUS_LABELS,
  type TextRequestStatus,
} from "./api/textRequestsApi";

const STATUS_STYLES: Record<TextRequestStatus, string> = {
  PENDING:
    "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  IN_PROGRESS:
    "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  COMPLETED:
    "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  REJECTED: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
};

export const TextRequestStatusBadge = ({
  status,
}: {
  status: TextRequestStatus;
}) => {
  const { t } = useTranslate();
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${STATUS_STYLES[status]}`}
    >
      {t(TEXT_REQUEST_STATUS_LABELS[status])}
    </span>
  );
};
