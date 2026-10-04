import { describe, expect, it } from "vitest";
import {
  groupCoreSchema,
  groupCreateSchema,
  type GroupCoreFormData,
} from "./GroupSchema";

function formData(
  overrides: Partial<GroupCoreFormData> = {},
): GroupCoreFormData {
  return {
    slug: "",
    group_type: "COMMUNITY",
    is_public: true,
    languages: {
      EN: {
        title: "Dharma Circle",
        sub_title: "Weekly sitting",
        description: "We sit together every week.",
        description_long: "",
      },
    },
    avatar_key: "",
    banner_key: "",
    ...overrides,
  };
}

const slugErrors = (result: ReturnType<typeof groupCoreSchema.safeParse>) =>
  result.success
    ? []
    : result.error.issues
        .filter((issue) => issue.path[0] === "slug")
        .map((issue) => issue.message);

describe("groupCreateSchema", () => {
  it("lets a practice space be created without a slug", () => {
    expect(groupCreateSchema.safeParse(formData()).success).toBe(true);
  });

  it("still asks a page for a slug", () => {
    const result = groupCreateSchema.safeParse(
      formData({ group_type: "PAGE" }),
    );
    expect(slugErrors(result)).toEqual(["Slug is required"]);
  });

  it("rejects a badly formed slug when one is given", () => {
    const result = groupCreateSchema.safeParse(
      formData({ group_type: "PAGE", slug: "Dharma Circle" }),
    );
    expect(slugErrors(result)).toEqual([
      "Use lowercase letters, numbers, hyphens, and underscores only",
    ]);
  });
});

describe("groupCoreSchema (editing)", () => {
  it("accepts a generated slug", () => {
    expect(
      groupCoreSchema.safeParse(formData({ slug: "dharma-circle_4821" }))
        .success,
    ).toBe(true);
  });

  it("keeps the slug required for every group", () => {
    expect(slugErrors(groupCoreSchema.safeParse(formData()))).toEqual([
      "Slug is required",
    ]);
  });

  it.each(["-dharma", "dharma-", "dharma__circle", "dharma_", "DHARMA"])(
    "rejects %s",
    (slug) => {
      expect(
        slugErrors(groupCoreSchema.safeParse(formData({ slug }))),
      ).toHaveLength(1);
    },
  );
});
