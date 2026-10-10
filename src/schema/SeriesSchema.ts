import { z } from "zod";
import type { LanguageCode } from "@/lib/languageCodes";

export type { LanguageCode };

export const languageBlockSchema = z.object({
  title: z.string().trim(),
  sub_title: z.string().trim(),
  description: z.string().trim(),
});

export const planItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  image_url: z.string().optional(),
});

export type SeriesPlan = z.infer<typeof planItemSchema>;

export const seriesSchema = z
  .object({
    languages: z.record(z.string(), languageBlockSchema),
    plans: z.record(z.string(), z.array(planItemSchema)),
    image_url: z
      .string()
      .trim()
      .min(1, "studio.validation.cover_image_required"),
  })
  .superRefine((data, ctx) => {
    const present = Object.keys(data.languages).filter(
      (code) => data.languages[code] != null,
    );
    if (present.length < 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "studio.validation.add_at_least_one_language",
        path: ["languages"],
      });
    }
  });

export type SeriesFormData = z.infer<typeof seriesSchema>;
