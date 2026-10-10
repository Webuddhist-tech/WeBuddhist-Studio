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
    expect(slugErrors(result)).toEqual(["studio.validation.slug_required"]);
  });

  it("rejects a badly formed slug when one is given", () => {
    const result = groupCreateSchema.safeParse(
      formData({ group_type: "PAGE", slug: "Dharma Circle" }),
    );
    expect(slugErrors(result)).toEqual(["studio.validation.slug_pattern"]);
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
      "studio.validation.slug_required",
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

describe("group language text", () => {
  const languageErrors = (
    result: ReturnType<typeof groupCoreSchema.safeParse>,
  ) =>
    result.success
      ? []
      : result.error.issues
          .filter((issue) => issue.path[0] === "languages")
          .map((issue) => `${issue.path.slice(1).join(".")}: ${issue.message}`);

  const withLanguages = (languages: GroupCoreFormData["languages"]) =>
    groupCoreSchema.safeParse(
      formData({ slug: "dharma-circle_4821", languages }),
    );

  it("needs only a title", () => {
    expect(withLanguages({ EN: { title: "Dharma Circle" } }).success).toBe(
      true,
    );
  });

  it("accepts empty strings for everything but the title", () => {
    expect(
      withLanguages({
        EN: {
          title: "Dharma Circle",
          sub_title: "",
          description: "",
          description_long: "",
        },
      }).success,
    ).toBe(true);
  });

  it("still needs a title, even with the rest filled in", () => {
    expect(
      languageErrors(
        withLanguages({
          EN: { title: "", sub_title: "Sub", description: "Desc" },
        }),
      ),
    ).toEqual(["EN.title: studio.validation.title_required"]);
  });

  it("treats a title of spaces as missing", () => {
    expect(languageErrors(withLanguages({ EN: { title: "   " } }))).toEqual([
      "EN.title: studio.validation.title_required",
    ]);
  });

  it("needs a title in every language", () => {
    expect(
      languageErrors(
        withLanguages({
          EN: { title: "Dharma Circle" },
          BO: { title: "", description: "Something" },
        }),
      ),
    ).toEqual(["BO.title: studio.validation.title_required"]);
  });

  it("applies when creating and when editing", () => {
    const languages = { EN: { title: "Dharma Circle" } };
    expect(groupCreateSchema.safeParse(formData({ languages })).success).toBe(
      true,
    );
    expect(
      groupCoreSchema.safeParse(
        formData({ languages, slug: "dharma-circle_4821" }),
      ).success,
    ).toBe(true);
  });

  it("still caps a description at 200 characters", () => {
    expect(
      languageErrors(
        withLanguages({
          EN: { title: "Dharma Circle", description: "x".repeat(201) },
        }),
      ),
    ).toEqual(["EN.description: studio.validation.description_max_200"]);
    expect(
      withLanguages({
        EN: { title: "Dharma Circle", description: "x".repeat(200) },
      }).success,
    ).toBe(true);
  });
});
