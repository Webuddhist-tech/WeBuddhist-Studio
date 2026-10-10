import { describe, expect, it } from "vitest";
import { keyFromLabel, lineLabel } from "./editionHelpers";

describe("keyFromLabel", () => {
  it("makes a key every language edition can share", () => {
    expect(keyFromLabel("↺ Return to start · 1st Praises", [])).toBe(
      "return_to_start_1st_praises",
    );
  });

  it("never reuses a key already taken", () => {
    expect(keyFromLabel("Refuge", ["refuge", "refuge_2"])).toBe("refuge_3");
  });

  it("falls back to a plain key for a label with no latin letters", () => {
    expect(keyFromLabel("སྐྱབས་འགྲོ", [])).toBe("return");
  });
});

describe("lineLabel", () => {
  const lines = [
    { id: "a", content: "first line" },
    { id: "b", content: `second   ${"word ".repeat(20)}` },
  ];

  it("names a segment by its line number and opening words", () => {
    expect(lineLabel(lines, "a", "Pick", "Line")).toBe("Line 1 · first line");
    expect(lineLabel(lines, "b", "Pick", "Line")).toMatch(
      /^Line 2 · second word .*…$/,
    );
  });

  it("shows an id that is not in this edition for what it is", () => {
    expect(lineLabel(lines, "zz", "Pick segment", "Line")).toBe(
      "Pick segment (zz)",
    );
    expect(lineLabel(lines, "", "Pick segment", "Line")).toBe("Pick segment");
  });
});
