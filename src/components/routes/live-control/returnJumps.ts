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

const byAfterSegment = new Map<
  string,
  { key: string; labelKey: string; targetSegmentId: string }
>();
for (const jump of RETURN_JUMPS) {
  for (const language of ["bo", "en", "zh"] as const) {
    byAfterSegment.set(jump.after[language], {
      key: jump.afterVerse,
      labelKey: jump.labelKey,
      targetSegmentId: jump.to[language],
    });
  }
}

/**
 * The repeated passages among these lines: from the verse a return button goes
 * back to, through the verse it sits after. Each is recited once per round, so
 * the round a line is in is the round of the passage holding it. `key` names the
 * passage as its return button does.
 */
export const returnPassages = (
  lines: { id: string }[],
): { key: string; start: number; end: number }[] => {
  const indexOf = new Map<string, number>();
  lines.forEach((line, index) => {
    if (!indexOf.has(line.id)) indexOf.set(line.id, index);
  });
  const find = (ids: Record<string, string>) =>
    Object.values(ids)
      .map((id) => indexOf.get(id))
      .find((index) => index !== undefined);
  return RETURN_JUMPS.flatMap((jump) => {
    const start = find(jump.to);
    const end = find(jump.after);
    return start !== undefined && end !== undefined && start <= end
      ? [{ key: jump.afterVerse, start, end }]
      : [];
  });
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
 */
export const returnButtonForLine = (
  segmentId: string,
  lines: { id: string }[],
): { key: string; label: string; index: number } | null => {
  const jump = byAfterSegment.get(segmentId);
  if (!jump) return null;
  const index = lines.findIndex((line) => line.id === jump.targetSegmentId);
  if (index < 0) return null;
  return { key: jump.key, label: tolgee.t(jump.labelKey), index };
};
