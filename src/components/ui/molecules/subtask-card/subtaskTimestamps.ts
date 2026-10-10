import type { SubTask } from "./SubTaskCard";
import { formatMs } from "@/lib/utils";
import { tolgee } from "@/i18n/tolgee";

export function buildSubTaskTimestampFields(
  subTask: SubTask,
  isUpdate: boolean,
): { start_ms?: number | null; end_ms?: number | null } {
  const { start_ms, end_ms } = subTask;
  if (start_ms != null && end_ms != null) {
    return { start_ms, end_ms };
  }
  if (isUpdate && start_ms === null && end_ms === null) {
    return { start_ms: null, end_ms: null };
  }
  return {};
}

export function validateSubTaskTimestamps(
  subTasks: SubTask[],
  maxDurationMs?: number | null,
): string | null {
  for (let i = 0; i < subTasks.length; i++) {
    const st = subTasks[i];
    const hasStart = st.start_ms != null;
    const hasEnd = st.end_ms != null;
    if (hasStart !== hasEnd) {
      return tolgee.t("studio.subtask.timestamps.need_both", { number: i + 1 });
    }
    if (
      hasStart &&
      hasEnd &&
      (st.start_ms as number) >= (st.end_ms as number)
    ) {
      return tolgee.t("studio.subtask.timestamps.start_before_end", {
        number: i + 1,
      });
    }
    if (
      hasStart &&
      hasEnd &&
      maxDurationMs != null &&
      (st.end_ms as number) > maxDurationMs
    ) {
      return tolgee.t("studio.subtask.timestamps.end_exceeds_audio", {
        number: i + 1,
        duration: formatMs(maxDurationMs),
      });
    }
  }
  return null;
}

export function mapApiSubtaskTimestamps(data: {
  start_ms?: number | null;
  end_ms?: number | null;
}) {
  const hasStart = data.start_ms != null;
  const hasEnd = data.end_ms != null;
  if (!hasStart && !hasEnd) return {};
  return {
    start_ms: data.start_ms ?? null,
    end_ms: data.end_ms ?? null,
  };
}
