import { describe, expect, it } from "vitest";
import {
  RETURN_JUMPS,
  returnButtonForLine,
  returnPassages,
  type StudioReturnJump,
} from "./returnJumps";

describe("returnButtonForLine", () => {
  it("jumps from each praise ending back to that praise's start, in the edition on screen", () => {
    for (const jump of RETURN_JUMPS) {
      const lines = [
        { id: jump.to.en },
        { id: "unrelated" },
        { id: jump.after.en },
      ];
      expect(returnButtonForLine(jump.after.en, lines)).toEqual({
        key: jump.afterVerse,
        label: jump.labelKey,
        index: 0,
      });
      expect(
        returnButtonForLine(jump.after.bo, [
          { id: jump.to.bo },
          { id: jump.after.bo },
        ])?.index,
      ).toBe(0);
      expect(
        returnButtonForLine(jump.after.zh, [
          { id: jump.to.zh },
          { id: jump.after.zh },
        ])?.index,
      ).toBe(0);
    }
  });

  it("draws nothing when the target verse is not in the lines on screen", () => {
    const first = RETURN_JUMPS[0];
    expect(
      returnButtonForLine(first.after.bo, [{ id: first.after.bo }]),
    ).toBeNull();
    expect(
      returnButtonForLine("some-other-segment", [{ id: first.to.bo }]),
    ).toBeNull();
  });
});

describe("returns set in Studio", () => {
  const studio: StudioReturnJump[] = [
    {
      key: "praises_2",
      afterSegmentId: "end",
      toSegmentId: "start",
      times: 2,
      label: { en: "Back to the praises", bo: "བསྟོད་པར་ལོག" },
    },
  ];
  const lines = [{ id: "start" }, { id: "middle" }, { id: "end" }];

  it("puts Studio's button, label and count after its segment", () => {
    expect(returnButtonForLine("end", lines, studio)).toEqual({
      key: "praises_2",
      label: "Back to the praises",
      index: 0,
      times: 2,
    });
  });

  it("uses only Studio's returns when the edition has any", () => {
    const builtIn = RETURN_JUMPS[0];
    expect(
      returnButtonForLine(
        builtIn.after.en,
        [{ id: builtIn.to.en }, { id: builtIn.after.en }],
        studio,
      ),
    ).toBeNull();
  });

  it("keeps the built-in returns when Studio set none", () => {
    const builtIn = RETURN_JUMPS[0];
    expect(
      returnButtonForLine(
        builtIn.after.en,
        [{ id: builtIn.to.en }, { id: builtIn.after.en }],
        [],
      )?.key,
    ).toBe(builtIn.afterVerse);
  });

  it("makes the passage a Studio return repeats", () => {
    expect(returnPassages(lines, studio)).toEqual([
      { key: "praises_2", start: 0, end: 2 },
    ]);
  });
});
