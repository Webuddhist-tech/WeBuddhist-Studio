import { describe, expect, it } from "vitest";
import {
  AUTHOR_NOT_ACTIVE_DETAIL,
  canWriteCms,
  isAuthorNotActiveDetail,
  isPathAllowedWithoutGroup,
  needsGroupOnboardingRedirect,
  canAccessPlanRoutes,
  normalizePlatformRole,
  shouldShowCmsActionsColumn,
} from "./platformAccess";

describe("platformAccess", () => {
  it("normalizes platform roles from API strings", () => {
    expect(normalizePlatformRole("reviewer")).toBe("REVIEWER");
    expect(normalizePlatformRole("SUPER_ADMIN")).toBe("SUPER_ADMIN");
    expect(normalizePlatformRole(undefined)).toBe("CREATOR");
    expect(normalizePlatformRole("unknown")).toBe("CREATOR");
  });

  it("hides CMS actions column for reviewers", () => {
    expect(shouldShowCmsActionsColumn("REVIEWER")).toBe(false);
    expect(shouldShowCmsActionsColumn("reviewer")).toBe(false);
    expect(shouldShowCmsActionsColumn("CREATOR")).toBe(true);
  });

  it("blocks plan routes for reviewers", () => {
    expect(canAccessPlanRoutes("REVIEWER")).toBe(false);
    expect(canAccessPlanRoutes("CREATOR")).toBe(true);
  });

  it("detects author not active detail", () => {
    expect(isAuthorNotActiveDetail(AUTHOR_NOT_ACTIVE_DETAIL)).toBe(true);
    expect(isAuthorNotActiveDetail("other")).toBe(false);
  });

  it("canWriteCms respects role and group", () => {
    expect(
      canWriteCms({
        platform_role: "SUPER_ADMIN",
        is_active: true,
        has_group: false,
      }),
    ).toBe(true);
    expect(
      canWriteCms({
        platform_role: "REVIEWER",
        is_active: true,
        has_group: true,
      }),
    ).toBe(false);
    expect(
      canWriteCms({
        platform_role: "CREATOR",
        is_active: true,
        has_group: true,
      }),
    ).toBe(true);
    expect(
      canWriteCms({
        platform_role: "CREATOR",
        is_active: false,
        has_group: true,
      }),
    ).toBe(false);
  });

  it("gates routes without group for creators only", () => {
    expect(isPathAllowedWithoutGroup("/groups")).toBe(true);
    expect(isPathAllowedWithoutGroup("/groups/abc")).toBe(true);
    expect(isPathAllowedWithoutGroup("/pages")).toBe(true);
    expect(isPathAllowedWithoutGroup("/pages/new")).toBe(true);
    expect(isPathAllowedWithoutGroup("/admin/authors")).toBe(true);
    expect(isPathAllowedWithoutGroup("/dashboard")).toBe(false);
    expect(
      needsGroupOnboardingRedirect("/dashboard", {
        is_active: true,
        has_group: false,
        platform_role: "CREATOR",
      }),
    ).toBe(true);
    expect(
      needsGroupOnboardingRedirect("/groups", {
        is_active: true,
        has_group: false,
        platform_role: "CREATOR",
      }),
    ).toBe(false);
    expect(
      needsGroupOnboardingRedirect("/dashboard", {
        is_active: true,
        has_group: false,
        platform_role: "SUPER_ADMIN",
      }),
    ).toBe(false);
    expect(
      needsGroupOnboardingRedirect("/tags", {
        is_active: true,
        has_group: false,
        platform_role: "REVIEWER",
      }),
    ).toBe(false);
  });
});
