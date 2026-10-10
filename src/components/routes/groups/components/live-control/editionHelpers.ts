export interface EditionLine {
  id: string;
  content: string;
}

/** Return labels are written in each of these. */
export const RETURN_LABEL_LANGUAGES = ["en", "bo", "zh"];

/** "Line 85 · the opening words…" - how a segment is named on the page. */
export const lineLabel = (
  lines: EditionLine[],
  segmentId: string,
  unknown: string,
  lineWord: string,
) => {
  const index = lines.findIndex((line) => line.id === segmentId);
  if (index < 0) return segmentId ? `${unknown} (${segmentId})` : unknown;
  const text = lines[index].content.replace(/\s+/g, " ").trim();
  return `${lineWord} ${index + 1} · ${text.length > 48 ? `${text.slice(0, 48)}…` : text}`;
};

/** A key every language edition can share: lower-case words from the label. */
export const keyFromLabel = (label: string, taken: string[]) => {
  const base =
    label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 40) || "return";
  let key = base;
  for (let n = 2; taken.includes(key); n += 1) key = `${base}_${n}`;
  return key;
};
