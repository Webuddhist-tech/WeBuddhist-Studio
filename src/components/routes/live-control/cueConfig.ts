/**
 * The operator's own settings for moving the room by hand. These are the
 * defaults; the operator can change each from the page, and their choice is
 * kept per browser.
 */
export interface CueSettings {
  /** Whether a move by hand sends how long the line it leaves was held. The
   * backend stores or updates a line's play time only from that figure, so
   * with this off the stored times are left as they are. */
  recordPlayTimes: boolean;
}

export const CUE_DEFAULTS: CueSettings = {
  recordPlayTimes: true,
};

export const CUE_STORAGE_KEY = "live-control-cue";

/** A setting that is not of its kind falls back to its default; settings no
 * longer kept, stored by an earlier page, are dropped. */
export const normalizeCue = (raw: Partial<CueSettings>): CueSettings => ({
  recordPlayTimes:
    typeof raw.recordPlayTimes === "boolean"
      ? raw.recordPlayTimes
      : CUE_DEFAULTS.recordPlayTimes,
});

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
