/**
 * When the live line's time bar tells the operator to move on, in ms before
 * the line's time runs out. The bar is white, with the last `nextClickOffsetMs`
 * of it red and the last `autoplayOffsetMs` yellow. These are the defaults;
 * the operator can change each from the page, and their choice is kept per
 * browser.
 */
export interface CueSettings {
  /** How long before a line's time runs out the operator is cued to press
   * Next by hand - room for the tap, and the room to catch up. Drawn red. */
  nextClickOffsetMs: number;
  /** How long before autoplay moves the room on the operator is cued that it
   * is about to - a heads-up, it does not change when autoplay moves. Drawn
   * yellow. */
  autoplayOffsetMs: number;
  /** Whether a move by hand sends how long the line it leaves was held. The
   * backend stores or updates a line's play time only from that figure, so
   * with this off the stored times are left as they are. */
  recordPlayTimes: boolean;
}

export const CUE_DEFAULTS: CueSettings = {
  nextClickOffsetMs: 1500,
  autoplayOffsetMs: 1000,
  recordPlayTimes: true,
};

/** The bounds the page holds each setting to. */
export const CUE_OFFSET_MAX_MS = 30_000;

export const CUE_STORAGE_KEY = "live-control-cue";

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

/** A setting outside its bounds is held to them; one that is not a number
 * falls back to its default. */
export const normalizeCue = (raw: Partial<CueSettings>): CueSettings => {
  const pick = (value: unknown, fallback: number, min: number, max: number) =>
    typeof value === "number" && Number.isFinite(value)
      ? clamp(value, min, max)
      : fallback;
  return {
    nextClickOffsetMs: pick(
      raw.nextClickOffsetMs,
      CUE_DEFAULTS.nextClickOffsetMs,
      0,
      CUE_OFFSET_MAX_MS,
    ),
    autoplayOffsetMs: pick(
      raw.autoplayOffsetMs,
      CUE_DEFAULTS.autoplayOffsetMs,
      0,
      CUE_OFFSET_MAX_MS,
    ),
    recordPlayTimes:
      typeof raw.recordPlayTimes === "boolean"
        ? raw.recordPlayTimes
        : CUE_DEFAULTS.recordPlayTimes,
  };
};

export const readStoredCue = (): CueSettings => {
  try {
    const parsed: unknown = JSON.parse(
      localStorage.getItem(CUE_STORAGE_KEY) ?? "{}",
    );
    return normalizeCue(
      parsed && typeof parsed === "object" ? (parsed as CueSettings) : {},
    );
  } catch {
    return CUE_DEFAULTS;
  }
};

export const storeCue = (cue: CueSettings) => {
  try {
    localStorage.setItem(CUE_STORAGE_KEY, JSON.stringify(cue));
  } catch {
    // Blocked site data: the cue holds for this session only.
  }
};

/** How far into a line of `duration` ms the operator is cued, on this mode's
 * offset. Never before the line starts. */
export const cueAt = (duration: number, cue: CueSettings, autoplay: boolean) =>
  Math.max(
    0,
    duration - (autoplay ? cue.autoplayOffsetMs : cue.nextClickOffsetMs),
  );
