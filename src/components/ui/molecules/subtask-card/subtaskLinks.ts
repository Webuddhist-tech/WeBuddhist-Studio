import { isLinkedContentType } from "../linked-content/linkedContent";
import type { LinkedSubTask, SubTask } from "./SubTaskCard";

/** Narrows a subtask to one that links to other content rather than carrying it. */
export function isLinkedSubTask(subTask: SubTask): subTask is LinkedSubTask {
  return isLinkedContentType(subTask.content_type);
}
