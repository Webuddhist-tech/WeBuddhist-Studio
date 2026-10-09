import { describe, expect, it } from "vitest";
import {
  traditionCodeForSave,
  traditionCodeUpdate,
  traditionLabel,
  traditionPickerOptions,
} from "./groupTradition";

const options = [
  { code: "pali", name: "Pāli scriptures" },
  { code: "tibetan", name: "Sanskrit & Tibetan scriptures" },
];

describe("traditionPickerOptions", () => {
  it("is the list as it is when the group has no tradition", () => {
    expect(traditionPickerOptions(options, null)).toBe(options);
  });

  it("is the list as it is when it already has the group's tradition", () => {
    const current = { id: "t1", code: "tibetan", name: "Tibetan" };
    expect(traditionPickerOptions(options, current)).toBe(options);
  });

  it("keeps a saved tradition the list lacks, so it never shows blank", () => {
    const current = { id: "t9", code: "zen", name: "Zen" };
    expect(traditionPickerOptions([], current)).toEqual([
      { code: "zen", name: "Zen" },
    ]);
  });
});

describe("traditionLabel", () => {
  it("falls back to the code when the tradition has no name", () => {
    expect(traditionLabel({ id: "t1", code: "pali", name: null })).toBe("pali");
    expect(traditionLabel({ id: "t1", code: "pali", name: "  " })).toBe("pali");
  });
});

describe("traditionCodeForSave", () => {
  it("sends the chosen code", () => {
    expect(traditionCodeForSave("tibetan")).toBe("tibetan");
  });

  it("sends null for no tradition, which clears it", () => {
    expect(traditionCodeForSave("")).toBeNull();
    expect(traditionCodeForSave(undefined)).toBeNull();
  });
});

describe("traditionCodeUpdate", () => {
  it("leaves the tradition out when the owner didn't change it", () => {
    expect(traditionCodeUpdate("tibetan", "tibetan")).toEqual({});
  });

  it("leaves it out when the group loaded without one, so a save can't clear it", () => {
    expect(traditionCodeUpdate("", "")).toEqual({});
    expect(traditionCodeUpdate(undefined, "")).toEqual({});
  });

  it("sends a newly chosen code", () => {
    expect(traditionCodeUpdate("pali", "tibetan")).toEqual({
      tradition_code: "pali",
    });
    expect(traditionCodeUpdate("pali", "")).toEqual({ tradition_code: "pali" });
  });

  it("sends null when the owner clears it", () => {
    expect(traditionCodeUpdate("", "tibetan")).toEqual({
      tradition_code: null,
    });
  });
});
