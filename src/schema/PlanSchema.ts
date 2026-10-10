import { z } from "zod";

export const planSchema = z.object({
  title: z.string().min(1, "studio.validation.plan_title_required"),
  description: z.string().min(1, "studio.validation.description_required"),
  total_days: z.string().min(1, "studio.validation.total_days_required"),
  difficulty_level: z.string().min(1, "studio.validation.difficulty_required"),
  image_url: z.string().min(1, "studio.validation.cover_image_required"),
  tags: z.array(z.string()),
  language: z.string().min(1, "studio.validation.language_required"),
  start_date: z.iso.datetime().nullable().optional(),
  series_id: z.string().nullable().optional(),
  group_id: z.string().uuid().optional(),
});
