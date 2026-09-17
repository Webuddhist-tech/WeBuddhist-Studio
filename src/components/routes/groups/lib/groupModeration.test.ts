import { describe, expect, it } from "vitest";
import { canModerateGroupUsers } from "./groupPermissions";

describe("canModerateGroupUsers", () => {
  it("allows the group owner and admins", () => {
    expect(canModerateGroupUsers("OWNER")).toBe(true);
    expect(canModerateGroupUsers("ADMIN")).toBe(true);
  });

  it("denies authors and viewers", () => {
    expect(canModerateGroupUsers("AUTHOR")).toBe(false);
    expect(canModerateGroupUsers("VIEWER")).toBe(false);
  });

  it("denies someone with no role in the group", () => {
    expect(canModerateGroupUsers(undefined)).toBe(false);
  });
});
