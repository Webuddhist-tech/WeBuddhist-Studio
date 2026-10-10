import { tolgee } from "@/i18n/tolgee";

/**
 * Return buttons copied from the in-person controller's content.json.
 * Each one sits after a verse and jumps back to an earlier verse, so a repeated
 * praise can be recited again. Next still moves forward past the button.
 *
 * The live controller knows library segment ids, not the verse ids in that
 * file, so each link is stored as the segment ids of those two verses.
 * Replace this list when the page loads that file itself.
 */
export interface ReturnJump {
  /** Verse the button sits after, and where it jumps, as content.json names them. */
  afterVerse: string;
  toVerse: string;
  /** Translation key of the button's label. */
  labelKey: string;
  /** Segment the button sits after, one id per edition. */
  after: { bo: string; en: string; zh: string };
  /** Segment the button jumps to, in the same editions. */
  to: { bo: string; en: string; zh: string };
}

export const RETURN_JUMPS: ReturnJump[] = [
  {
    afterVerse: "1-85",
    toVerse: "1-62",
    labelKey: "studio.live_control.return_jumps.praises_1",
    after: {
      bo: "kYNR7EmC5apQWrkYl5fiO",
      en: "t3ULIQb5rGeFqz9BfTEFH",
      zh: "ayWXQNVq3a05Ctf7qit5B",
    },
    to: {
      bo: "BsajlElFFNFLoHcUjICwB",
      en: "7ZUhtzzhuMNa4ckonhKJT",
      zh: "TRVvRQFsYwzNv4J1lbrLz",
    },
  },
  {
    afterVerse: "1-119",
    toVerse: "1-96",
    labelKey: "studio.live_control.return_jumps.praises_2",
    after: {
      bo: "IWMKZtgFHWDxOLQrov7Iq",
      en: "09eTJ7tOaskY6N73FnNue",
      zh: "U1hY4EPI97DXtlyfIeF7d",
    },
    to: {
      bo: "cdgek8Op2tOd3YplRyUzV",
      en: "PcMEDt1P5Pxgsm1pbgQYL",
      zh: "t5Z7aXztcYWN4j2pBxbiI",
    },
  },
  {
    afterVerse: "1-153",
    toVerse: "1-130",
    labelKey: "studio.live_control.return_jumps.praises_3",
    after: {
      bo: "jq5mnNM9I8k1uBslB25lI",
      en: "T32HdbznAFDilAgOrn5mL",
      zh: "Ilyseo3EMyYsLL0gvVFiB",
    },
    to: {
      bo: "1C6Gb3Bn2NCpa4dXMsKLd",
      en: "xIwSZkN4TeOc6nWSnA0Am",
      zh: "5Udi0JLl4yYQxeVH65Nkg",
    },
  },
  {
    afterVerse: "1-213",
    toVerse: "1-5",
    labelKey: "studio.live_control.return_jumps.refuge",
    after: {
      bo: "iODCra3NRL3bIZB62XvDg",
      en: "KHjMWIJKWClLkqTYRCsSE",
      zh: "blRIbFfMOQ2IKPy56CkEP",
    },
    to: {
      bo: "Le0mIXpkE1yTBlAIoaQVD",
      en: "zkcnazCwFTwzK5hA7NYgi",
      zh: "e2jopluI3nsxktZMAxufL",
    },
  },
];

/**
 * A return set in Studio for one edition: the button after one segment, back to
 * another, taken `times` times in a puja. `key` is shared by every language
 * edition of the text, so its count follows it across them.
 */
export interface StudioReturnJump {
  key: string;
  afterSegmentId: string;
  toSegmentId: string;
  times: number;
  label: Record<string, string>;
}

interface JumpTarget {
  key: string;
  label: () => string;
  targetSegmentId: string;
  times?: number;
}

const builtInByAfterSegment = new Map<string, JumpTarget>();
for (const jump of RETURN_JUMPS) {
  for (const language of ["bo", "en", "zh"] as const) {
    builtInByAfterSegment.set(jump.after[language], {
      key: jump.afterVerse,
      label: () => tolgee.t(jump.labelKey),
      targetSegmentId: jump.to[language],
    });
  }
}

/** A Studio label in the page's language, else English, else any. */
const studioLabel = (label: Record<string, string>) => {
  const language = tolgee.getLanguage() ?? "en";
  return (
    label[language] || label.en || Object.values(label).find(Boolean) || ""
  );
};

/**
 * Returns by the segment they sit after. An edition with returns set in Studio
 * uses only those; one with none keeps the built-in list.
 */
const jumpsByAfterSegment = (studio?: StudioReturnJump[]) => {
  if (!studio || studio.length === 0) return builtInByAfterSegment;
  const map = new Map<string, JumpTarget>();
  for (const jump of studio) {
    map.set(jump.afterSegmentId, {
      key: jump.key,
      label: () => studioLabel(jump.label),
      targetSegmentId: jump.toSegmentId,
      times: jump.times,
    });
  }
  return map;
};

/**
 * The repeated passages among these lines: from the verse a return button goes
 * back to, through the verse it sits after. Each is recited once per round, so
 * the round a line is in is the round of the passage holding it. `key` names the
 * passage as its return button does.
 */
export const returnPassages = (
  lines: { id: string }[],
  studio?: StudioReturnJump[],
): { key: string; start: number; end: number }[] => {
  const indexOf = new Map<string, number>();
  lines.forEach((line, index) => {
    if (!indexOf.has(line.id)) indexOf.set(line.id, index);
  });
  const passages: { key: string; start: number; end: number }[] = [];
  jumpsByAfterSegment(studio).forEach((jump, afterSegmentId) => {
    const start = indexOf.get(jump.targetSegmentId);
    const end = indexOf.get(afterSegmentId);
    if (
      start !== undefined &&
      end !== undefined &&
      start <= end &&
      !passages.some((passage) => passage.key === jump.key)
    ) {
      passages.push({ key: jump.key, start, end });
    }
  });
  return passages;
};

/**
 * The passage a line is recited in: the tightest one holding it, since the
 * Refuge return spans the praises, each of which repeats on its own.
 */
export const passageAt = (
  passages: { key: string; start: number; end: number }[],
  index: number,
) =>
  passages
    .filter((passage) => passage.start <= index && index <= passage.end)
    .sort((a, b) => a.end - a.start - (b.end - b.start))[0];

/**
 * The return button under this line, if this segment is one the operator can
 * jump back from and the target verse is among the lines on screen. `key` names
 * the button the same in every edition, so its count follows it across them.
 * `times` is how many returns Studio set for it, when it set one.
 */
export const returnButtonForLine = (
  segmentId: string,
  lines: { id: string }[],
  studio?: StudioReturnJump[],
): { key: string; label: string; index: number; times?: number } | null => {
  const jump = jumpsByAfterSegment(studio).get(segmentId);
  if (!jump) return null;
  const index = lines.findIndex((line) => line.id === jump.targetSegmentId);
  if (index < 0) return null;
  return { key: jump.key, label: jump.label(), index, times: jump.times };
};
