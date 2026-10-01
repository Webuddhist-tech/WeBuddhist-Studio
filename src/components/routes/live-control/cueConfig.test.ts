import { beforeEach, describe, expect, it } from "vitest";
import {
  CUE_DEFAULTS,
  CUE_STORAGE_KEY,
  cueAt,
  normalizeCue,
  readStoredCue,
  storeCue,
} from "./cueConfig";

describe("cueConfig", () => {
  beforeEach(() => localStorage.clear());

  it("cues by hand and under autoplay on their own offsets", () => {
    const cue = {
      ...CUE_DEFAULTS,
      nextClickOffsetMs: 1500,
      autoplayOffsetMs: 500,
    };
    expect(cueAt(10_000, cue, false)).toBe(8500);
    expect(cueAt(10_000, cue, true)).toBe(9500);
    // A line shorter than the offset is cued from its start.
    expect(cueAt(1000, cue, false)).toBe(0);
  });

  it("holds settings to their bounds, and falls back on nonsense", () => {
    expect(
      normalizeCue({
        nextClickOffsetMs: -1,
        autoplayOffsetMs: Number.NaN,
      }),
    ).toEqual({
      nextClickOffsetMs: 0,
      autoplayOffsetMs: CUE_DEFAULTS.autoplayOffsetMs,
    });
  });

  it("reads back what was stored, and the defaults when nothing was", () => {
    expect(readStoredCue()).toEqual(CUE_DEFAULTS);
    storeCue({ ...CUE_DEFAULTS, nextClickOffsetMs: 2000 });
    expect(readStoredCue().nextClickOffsetMs).toBe(2000);
    localStorage.setItem(CUE_STORAGE_KEY, "not json");
    expect(readStoredCue()).toEqual(CUE_DEFAULTS);
  });
});
