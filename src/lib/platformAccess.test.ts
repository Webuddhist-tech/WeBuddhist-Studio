import { describe, expect, it } from "vitest";
import {
  AUTHOR_NOT_ACTIVE_DETAIL,
  canAccessAdminAuthors,
  canAccessContentCatalogues,
  canManageAmbientSounds,
  canWriteCms,
  isContentAdmin,
  isStaffRole,
  isSuperAdmin,
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

  describe("CONTENT_ADMIN", () => {
    it("is recognised from API strings", () => {
      expect(normalizePlatformRole("content_admin")).toBe("CONTENT_ADMIN");
      expect(isContentAdmin("CONTENT_ADMIN")).toBe(true);
      expect(isContentAdmin("CREATOR")).toBe(false);
    });

    it("is not platform staff, so it never sees every plan and space", () => {
      expect(isStaffRole("CONTENT_ADMIN")).toBe(false);
      expect(isSuperAdmin("CONTENT_ADMIN")).toBe(false);
    });

    it("opens the content catalogues and the ambient sounds", () => {
      expect(canAccessContentCatalogues("CONTENT_ADMIN")).toBe(true);
      expect(canAccessContentCatalogues("SUPER_ADMIN")).toBe(true);
      expect(canAccessContentCatalogues("REVIEWER")).toBe(true);
      expect(canAccessContentCatalogues("CREATOR")).toBe(false);
      expect(canManageAmbientSounds("CONTENT_ADMIN")).toBe(true);
      expect(canManageAmbientSounds("SUPER_ADMIN")).toBe(true);
      expect(canManageAmbientSounds("REVIEWER")).toBe(false);
      expect(canManageAmbientSounds("CREATOR")).toBe(false);
    });

    it("keeps out of user and moderation administration", () => {
      expect(canAccessAdminAuthors("CONTENT_ADMIN")).toBe(false);
    });

    it("keeps CMS actions on, like a creator", () => {
      expect(shouldShowCmsActionsColumn("CONTENT_ADMIN")).toBe(true);
      expect(canAccessPlanRoutes("CONTENT_ADMIN")).toBe(true);
      expect(
        canWriteCms({
          platform_role: "CONTENT_ADMIN",
          is_active: true,
          has_group: true,
        }),
      ).toBe(true);
      expect(
        canWriteCms({
          platform_role: "CONTENT_ADMIN",
          is_active: true,
          has_group: false,
        }),
      ).toBe(false);
    });

    it("may open the catalogues before joining a space, but nothing else", () => {
      const user = {
        is_active: true,
        has_group: false,
        platform_role: "CONTENT_ADMIN" as const,
      };
      for (const path of [
        "/verse-of-day",
        "/poems",
        "/poems/123",
        "/text-audio",
        "/tags",
        "/traditions",
        "/accumulator-presets",
        "/prayer-intentions",
        "/ambient-sounds",
      ]) {
        expect(needsGroupOnboardingRedirect(path, user)).toBe(false);
      }
      expect(needsGroupOnboardingRedirect("/dashboard", user)).toBe(true);
      expect(needsGroupOnboardingRedirect("/groups", user)).toBe(false);
    });

    it("sends a plain creator without a space away from the catalogues", () => {
      expect(
        needsGroupOnboardingRedirect("/poems", {
          is_active: true,
          has_group: false,
          platform_role: "CREATOR",
        }),
      ).toBe(true);
    });
  });
});
