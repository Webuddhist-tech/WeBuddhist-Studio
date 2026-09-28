import { describe, expect, it } from "vitest";
import { RETURN_JUMPS, returnButtonForLine } from "./returnJumps";

describe("returnButtonForLine", () => {
  it("jumps from each praise ending back to that praise's start, in the edition on screen", () => {
    for (const jump of RETURN_JUMPS) {
      const lines = [
        { id: jump.to.en },
        { id: "unrelated" },
        { id: jump.after.en },
      ];
      expect(returnButtonForLine(jump.after.en, lines)).toEqual({
        label: jump.label,
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
