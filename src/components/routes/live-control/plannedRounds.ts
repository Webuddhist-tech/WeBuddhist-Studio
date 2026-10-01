/** How many times a passage is recited. The first time through is round 1. */
export const FIRST_ROUND = 1;
/** The most rounds a passage can be set to. One more than the old return cap. */
export const MAX_PLANNED_ROUNDS = 21;

/** Rounds the operator planned for this event, kept in this browser. */
export const plannedRoundsStorageKey = (eventId: string | undefined) =>
  `live-control-planned-rounds:${eventId ?? ""}`;

/** How many times each return was to be taken, from before rounds were stored.
 * A passage recited twice was saved as one return. */
const plannedReturnsStorageKey = (eventId: string | undefined) =>
  `live-control-planned-returns:${eventId ?? ""}`;

const parseCounts = (raw: string | null): Record<string, number> | null => {
  if (raw === null) return null;
  const parsed: unknown = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return {};
  }
  return Object.fromEntries(
    Object.entries(parsed).filter(
      (entry): entry is [string, number] =>
        Number.isInteger(entry[1]) && entry[1] >= 1,
    ),
  );
};

const roundsFromReturns = (returns: Record<string, number>) =>
  Object.fromEntries(
    Object.entries(returns).map(([key, count]) => [
      key,
      Math.min(MAX_PLANNED_ROUNDS, count + FIRST_ROUND),
    ]),
  );

/**
 * A return count saved before rounds existed is the same plan: two times
 * through was stored as one return. Written once, under the rounds key, and
 * the old key is removed so a later clear is not read as a plan again.
 * Skipped when rounds are already saved, including an empty plan.
 */
export const carryPlannedReturns = (eventId: string | undefined) => {
  const roundsKey = plannedRoundsStorageKey(eventId);
  const returnsKey = plannedReturnsStorageKey(eventId);
  try {
    if (localStorage.getItem(roundsKey) !== null) return;
    const raw = localStorage.getItem(returnsKey);
    if (raw === null) return;
    const returns = parseCounts(raw) ?? {};
    localStorage.setItem(roundsKey, JSON.stringify(roundsFromReturns(returns)));
    localStorage.removeItem(returnsKey);
  } catch {
    // Blocked site data: the new counts start at one round.
  }
};

/**
 * Rounds planned for this event. When only the older return counts are saved,
 * each is read as one more round. Nothing is written here: the controller
 * carries them over when it opens.
 */
export const readEventPlannedRounds = (
  eventId: string | undefined,
): Record<string, number> => {
  try {
    const roundsKey = plannedRoundsStorageKey(eventId);
    if (localStorage.getItem(roundsKey) !== null) {
      return parseCounts(localStorage.getItem(roundsKey)) ?? {};
    }
    const returns = parseCounts(
      localStorage.getItem(plannedReturnsStorageKey(eventId)),
    );
    return returns ? roundsFromReturns(returns) : {};
  } catch {
    return {};
  }
};
