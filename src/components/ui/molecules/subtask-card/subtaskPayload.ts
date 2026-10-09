import type {
  SubTaskPayload,
  SubTaskUpdatePayload,
} from "@/components/routes/task/api/taskApi";
import type { SubTask } from "./SubTaskCard";
import { isLinkedSubTask } from "./subtaskLinks";
import { buildSubTaskTimestampFields } from "./subtaskTimestamps";

/**
 * The fields every subtask sends, whichever content type it is. Kept in one
 * place so the create and update paths cannot drift - notably `reference_id`,
 * which only linked content types carry.
 */
function buildCommonFields(subTask: SubTask, index: number) {
  return {
    content: subTask.content,
    content_type: subTask.content_type,
    display_order: index + 1,
    ...(subTask.content_type === "VIDEO" &&
      subTask.duration && { duration: subTask.duration }),
    ...(subTask.content_type === "SOURCE_REFERENCE" && {
      source_text_id: subTask.source_text_id || null,
      pecha_segment_id: subTask.pecha_segment_id || null,
      segment_ids: subTask.segment_ids || null,
      segment_numbers: subTask.segment_numbers || null,
    }),
    ...(isLinkedSubTask(subTask) && {
      reference_id: subTask.reference_id || null,
    }),
  };
}

export function buildSubTaskPayload(
  subTask: SubTask,
  index: number,
): SubTaskPayload {
  return {
    ...buildCommonFields(subTask, index),
    ...buildSubTaskTimestampFields(subTask, false),
  };
}

export function buildSubTaskUpdatePayload(
  subTask: SubTask,
  index: number,
): SubTaskUpdatePayload {
  return {
    id: subTask.id || null,
    ...buildCommonFields(subTask, index),
    ...buildSubTaskTimestampFields(subTask, true),
  };
}
