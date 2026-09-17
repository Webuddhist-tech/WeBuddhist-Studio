import type { UserInfo } from "@/hooks/useUserInfo";

export type PlatformRole = "CREATOR" | "REVIEWER" | "SUPER_ADMIN";

export const AUTHOR_NOT_ACTIVE_DETAIL = "Author not active";

function normalizeRoleArg(
  role?: PlatformRole | string | null,
): string | undefined {
  const raw = role?.toString().trim().toUpperCase();
  return raw || undefined;
}

/** Maps API platform_role strings to a canonical role (defaults to CREATOR). */
export function normalizePlatformRole(role?: string | null): PlatformRole {
  const raw = normalizeRoleArg(role);
  if (raw === "SUPER_ADMIN" || raw === "REVIEWER" || raw === "CREATOR") {
    return raw;
  }
  return "CREATOR";
}

export function isSuperAdmin(role?: PlatformRole | string): boolean {
  return normalizeRoleArg(role) === "SUPER_ADMIN";
}

export function isReviewer(role?: PlatformRole | string): boolean {
  return normalizeRoleArg(role) === "REVIEWER";
}

/** Platform staff (SUPER_ADMIN, REVIEWER), as opposed to a plain CREATOR account. */
export function isStaffRole(role?: PlatformRole | string): boolean {
  return isSuperAdmin(role) || isReviewer(role);
}

/** Row menus (dashboard, series plans, tags, group members, etc.). */
export function shouldShowCmsActionsColumn(
  role?: PlatformRole | string,
): boolean {
  return !isReviewer(role);
}

/** Plan detail, edit, and create routes are not available to platform reviewers. */
export function canAccessPlanRoutes(role?: PlatformRole | string): boolean {
  return !isReviewer(role);
}

export function canWriteCms(
  user?: Pick<UserInfo, "platform_role" | "is_active" | "has_group"> | null,
): boolean {
  if (!user?.is_active) return false;
  if (isSuperAdmin(user.platform_role)) return true;
  if (isReviewer(user.platform_role)) return false;
  return Boolean(user.has_group);
}

export function isAuthorNotActiveDetail(detail: unknown): boolean {
  if (typeof detail !== "string") return false;
  return detail.trim().toLowerCase() === AUTHOR_NOT_ACTIVE_DETAIL.toLowerCase();
}

export function isAuthorNotActiveError(error: unknown): boolean {
  const err = error as { response?: { data?: { detail?: unknown } } };
  return isAuthorNotActiveDetail(err?.response?.data?.detail);
}

/** Routes allowed when a CREATOR has no group yet. */
export const NO_GROUP_ALLOWED_PREFIXES = [
  "/groups",
  "/profile",
  "/admin/authors",
  "/admin/china-restrictions",
  "/admin/chat-reports",
] as const;

export function isPathAllowedWithoutGroup(pathname: string): boolean {
  return NO_GROUP_ALLOWED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function needsVerifyEmailRedirect(
  user?: Pick<UserInfo, "is_verified"> | null,
): boolean {
  return user != null && user.is_verified === false;
}

export function needsInactiveLogout(
  user?: Pick<UserInfo, "is_active"> | null,
): boolean {
  return user != null && user.is_active === false;
}

export function needsGroupOnboardingRedirect(
  pathname: string,
  user?: Pick<UserInfo, "is_active" | "has_group" | "platform_role"> | null,
): boolean {
  if (!user?.is_active) return false;
  if (isSuperAdmin(user.platform_role) || isReviewer(user.platform_role)) {
    return false;
  }
  if (user.has_group !== false) return false;
  return !isPathAllowedWithoutGroup(pathname);
}

/** Admin authors + auth routes for platform staff. */
export function canAccessAdminAuthors(role?: PlatformRole | string): boolean {
  return isSuperAdmin(role) || isReviewer(role);
}

/** The ambient sound catalogue is the one background-sound catalogue: curated
 * in Studio, chosen per timer in the app. CRUD is Super Admin only (shared,
 * sitewide media/S3 writes). */
export function canManageAmbientSounds(role?: PlatformRole | string): boolean {
  return isSuperAdmin(role);
}

/** Whether dashboard group filter should load (staff-wide vs membership list). */
export function canUseDashboardGroupFilter(
  user?: Pick<UserInfo, "platform_role" | "has_group"> | null,
): boolean {
  if (!user) return false;
  if (isSuperAdmin(user.platform_role) || isReviewer(user.platform_role)) {
    return true;
  }
  return user.has_group !== false;
}

export function usesStaffWideDashboardGroupList(
  role?: PlatformRole | string,
): boolean {
  return isSuperAdmin(role) || isReviewer(role);
}
