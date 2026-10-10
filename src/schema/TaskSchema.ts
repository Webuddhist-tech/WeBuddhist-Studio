import { z } from "zod";

export const taskSchema = z.object({
  title: z.string().min(1, "studio.validation.task_title_required"),
});
