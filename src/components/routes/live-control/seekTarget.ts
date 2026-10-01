/** A step of a running plan, as far as finding a line in it goes. */
export interface PlanLine {
  lineIndex: number;
  round: number;
}

/**
 * The step of a running plan a hand move to line `index` lands on: the nearest
 * one, counting from step `at` the room is on, that is that line - in `round`,
 * when the move names one. A move to the next line is the very next step; to
 * the line before, the step before it, never the same line a round later. Null
 * when the line is not in the plan at all, so the move needs a plan of its own.
 */
export const seekTarget = (
  steps: readonly PlanLine[],
  at: number,
  index: number,
  round?: number,
): number | null => {
  let best: number | null = null;
  steps.forEach((step, s) => {
    if (step.lineIndex !== index) return;
    if (round !== undefined && step.round !== round) return;
    if (best === null) {
      best = s;
      return;
    }
    const distance = Math.abs(s - at);
    const bestDistance = Math.abs(best - at);
    // Ahead wins a tie: the room is going forward.
    if (distance < bestDistance || (distance === bestDistance && s > at)) {
      best = s;
    }
  });
  return best;
};
