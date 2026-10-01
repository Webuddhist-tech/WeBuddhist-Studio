import { describe, expect, it } from "vitest";
import { seekTarget } from "./seekTarget";

/** A plan over lines 0-3, with lines 1-2 a passage recited in two rounds. */
const steps = [
  { lineIndex: 0, round: 1 },
  { lineIndex: 1, round: 1 },
  { lineIndex: 2, round: 1 },
  { lineIndex: 1, round: 2 },
  { lineIndex: 2, round: 2 },
  { lineIndex: 3, round: 1 },
];

describe("seekTarget", () => {
  it("takes Next to the very next step", () => {
    expect(seekTarget(steps, 2, 1)).toBe(3);
  });

  it("takes Previous to the step before, not the same line a round earlier", () => {
    // On line 2 in round 2: Previous is line 1 in round 2, not in round 1.
    expect(seekTarget(steps, 4, 1)).toBe(3);
  });

  it("takes a tap on a line as near on either side to the one ahead", () => {
    // On line 2 in round 1, line 1 is a step back in round 1 and a step on in
    // round 2. Next and Previous never ask: they step through the plan itself.
    expect(seekTarget(steps, 2, 1)).toBe(3);
  });

  it("finds the round a Return names", () => {
    expect(seekTarget(steps, 0, 1, 2)).toBe(3);
    expect(seekTarget(steps, 4, 1, 1)).toBe(1);
  });

  it("prefers the step ahead when two are as near", () => {
    expect(seekTarget(steps, 2, 1)).toBe(3);
    expect(
      seekTarget(
        [
          { lineIndex: 5, round: 1 },
          { lineIndex: 0, round: 1 },
          { lineIndex: 5, round: 2 },
        ],
        1,
        5,
      ),
    ).toBe(2);
  });

  it("finds nothing for a line the plan does not hold", () => {
    expect(seekTarget(steps, 0, 7)).toBeNull();
    expect(seekTarget(steps, 0, 3, 2)).toBeNull();
  });
});
