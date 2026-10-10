/**
 * The order the operator has dragged an edition's sections into, kept per
 * browser and per edition - each edition is its own library text, with its own
 * section ids. Only the sidebar is drawn in this order: which section is being
 * recited, and where each one ends, still go by the lines.
 */
export const sectionOrderStorageKey = (editionId: string) =>
  `live-control-section-order:${editionId}`;

/** The stored order, as section ids; empty when the edition was never reordered. */
export const readSectionOrder = (editionId: string): string[] => {
  if (!editionId) return [];
  try {
    const parsed: unknown = JSON.parse(
      localStorage.getItem(sectionOrderStorageKey(editionId)) ?? "[]",
    );
    return Array.isArray(parsed)
      ? parsed.filter((id): id is string => typeof id === "string")
      : [];
  } catch {
    return [];
  }
};

/** An empty order clears the edition's entry, putting the outline back. */
export const storeSectionOrder = (editionId: string, order: string[]) => {
  if (!editionId) return;
  try {
    const key = sectionOrderStorageKey(editionId);
    if (order.length === 0) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(order));
  } catch {
    // Blocked site data: the order holds for this session only.
  }
};

/**
 * The sections in the stored order. A section the order does not name - one the
 * library added since - keeps its place in the outline, after the section it
 * follows there; ids no longer in the outline are passed over.
 */
export const applySectionOrder = <T extends { id: string }>(
  sections: T[],
  order: string[],
): T[] => {
  if (order.length === 0) return sections;
  const byId = new Map(sections.map((section) => [section.id, section]));
  const placed = new Set<string>();
  const result: T[] = [];
  order.forEach((id) => {
    const section = byId.get(id);
    if (!section || placed.has(id)) return;
    placed.add(id);
    result.push(section);
  });
  sections.forEach((section, index) => {
    if (placed.has(section.id)) return;
    const before = sections
      .slice(0, index)
      .reverse()
      .find((earlier) => placed.has(earlier.id));
    const at = before ? result.indexOf(before) + 1 : 0;
    result.splice(at, 0, section);
    placed.add(section.id);
  });
  return result;
};
