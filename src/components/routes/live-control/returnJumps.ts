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
  label: string;
  /** Segment the button sits after, one id per edition. */
  after: { bo: string; en: string; zh: string };
  /** Segment the button jumps to, in the same editions. */
  to: { bo: string; en: string; zh: string };
}

export const RETURN_JUMPS: ReturnJump[] = [
  {
    afterVerse: "1-85",
    toVerse: "1-62",
    label: "↺ Return to start · 1st Praises to the 21 Tārās",
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
    label: "↺ Return to start · 2nd Praises to the 21 Tārās",
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
    label: "↺ Return to start · 3rd Praises to the 21 Tārās",
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
    label: "↺ Return to Refuge & Bodhichitta · མདུན་གྱི་ནམ་མཁར་…",
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
  { key: string; label: string; targetSegmentId: string }
>();
for (const jump of RETURN_JUMPS) {
  for (const language of ["bo", "en", "zh"] as const) {
    byAfterSegment.set(jump.after[language], {
      key: jump.afterVerse,
      label: jump.label,
      targetSegmentId: jump.to[language],
    });
  }
}

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
  return { key: jump.key, label: jump.label, index };
};
