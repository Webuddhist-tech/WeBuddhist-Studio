import {
  AUTHOR_NOT_ACTIVE_DETAIL,
  isAuthorNotActiveDetail,
} from "@/lib/platformAccess";
import { tolgee } from "@/i18n/tolgee";

export function getApiErrorDetail(error: unknown): string | undefined {
  const err = error as { response?: { data?: { detail?: unknown } } };
  const detail = err?.response?.data?.detail;
  if (typeof detail === "string") return detail;
  if (
    detail &&
    typeof detail === "object" &&
    "message" in detail &&
    typeof (detail as { message: string }).message === "string"
  ) {
    return (detail as { message: string }).message;
  }
  return undefined;
}

/**
 * True for failures that do not indicate the request itself was rejected:
 * network errors/timeouts (no HTTP response), HTTP 408/429, and 5xx server
 * errors. These are safe to retry with the same payload.
 */
export function isTransientApiError(error: unknown): boolean {
  const err = error as { response?: { status?: number } } | null;
  if (!err || typeof err !== "object") return true;
  if (!err.response) return true;
  const status = err.response.status;
  return (
    typeof status === "number" &&
    (status === 408 || status === 429 || status >= 500)
  );
}

/** Backend detail -> translation key of the message shown to the user. */
const FRIENDLY_MESSAGES: Record<string, string> = {
  [AUTHOR_NOT_ACTIVE_DETAIL]: "studio.errors.author_not_active",
  CONTENT_PUBLISHED_READ_ONLY: "studio.errors.content_published_read_only",
  STATUS_CHANGE_FORBIDDEN: "studio.errors.status_change_forbidden",
  NO_GROUP_MEMBERSHIP: "studio.errors.no_group_membership",
  "Target group must differ from the current group":
    "studio.errors.transfer_same_group",
  "Target group not found": "studio.errors.transfer_group_not_found",
  "A pending transfer request already exists for this content":
    "studio.errors.transfer_already_pending",
  "Plan is attached to a series; transfer the series or detach the plan first":
    "studio.errors.transfer_plan_in_series",
};

export function getApiErrorMessage(
  error: unknown,
  fallback = tolgee.t("studio.errors.generic"),
): string {
  const detail = getApiErrorDetail(error);
  if (detail) {
    if (FRIENDLY_MESSAGES[detail]) return tolgee.t(FRIENDLY_MESSAGES[detail]);
    if (isAuthorNotActiveDetail(detail))
      return tolgee.t("studio.errors.author_not_active");
    return detail;
  }
  const err = error as { response?: { data?: { detail?: unknown } } };
  const rawDetail = err?.response?.data?.detail;
  if (Array.isArray(rawDetail) && rawDetail[0]?.msg) return rawDetail[0].msg;
  return fallback;
}
