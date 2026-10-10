import { beforeEach, describe, expect, it } from "vitest";
import {
  CUE_DEFAULTS,
  CUE_STORAGE_KEY,
  normalizeCue,
  readStoredCue,
  storeCue,
} from "./cueConfig";

describe("cueConfig", () => {
  beforeEach(() => localStorage.clear());

  it("falls back on nonsense, and drops settings no longer kept", () => {
    expect(
      normalizeCue({
        recordPlayTimes: "yes" as unknown as boolean,
        nextClickOffsetMs: 1500,
      } as Partial<typeof CUE_DEFAULTS>),
    ).toEqual({ recordPlayTimes: true });
    expect(normalizeCue({ recordPlayTimes: false }).recordPlayTimes).toBe(
      false,
    );
  });

  it("reads back what was stored, and the defaults when nothing was", () => {
    expect(readStoredCue()).toEqual(CUE_DEFAULTS);
    storeCue({ recordPlayTimes: false });
    expect(readStoredCue().recordPlayTimes).toBe(false);
    localStorage.setItem(CUE_STORAGE_KEY, "not json");
    expect(readStoredCue()).toEqual(CUE_DEFAULTS);
  });
});
