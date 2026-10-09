import { describe, expect, it } from "vitest";
import { buildGroupMetadata } from "./groupsApi";

describe("buildGroupMetadata", () => {
  it("sends only a title, with the rest as null", () => {
    expect(buildGroupMetadata({ EN: { title: "Dharma Circle" } })).toEqual([
      {
        language: "EN",
        title: "Dharma Circle",
        sub_title: null,
        description: null,
        description_long: null,
      },
    ]);
  });

  it("turns empty and blank text into null", () => {
    expect(
      buildGroupMetadata({
        EN: {
          title: "Dharma Circle",
          sub_title: "",
          description: "   ",
          description_long: "\n",
        },
      }),
    ).toEqual([
      {
        language: "EN",
        title: "Dharma Circle",
        sub_title: null,
        description: null,
        description_long: null,
      },
    ]);
  });

  it("trims the text that is there", () => {
    expect(
      buildGroupMetadata({
        EN: {
          title: "  Dharma Circle ",
          sub_title: " Weekly ",
          description: " We sit. ",
          description_long: "  More  ",
        },
      }),
    ).toEqual([
      {
        language: "EN",
        title: "Dharma Circle",
        sub_title: "Weekly",
        description: "We sit.",
        description_long: "More",
      },
    ]);
  });

  it("builds every language the same way, in order", () => {
    const metadata = buildGroupMetadata({
      BO: { title: "Chos Tshogs" },
      EN: { title: "Dharma Circle", description: "We sit." },
    });
    expect(metadata.map((m) => m.language)).toEqual(["EN", "BO"]);
    expect(metadata[0].description).toBe("We sit.");
    expect(metadata[1].description).toBeNull();
  });
});
