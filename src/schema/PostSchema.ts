import { z } from "zod";

export const POST_STATUSES = ["PUBLISHED", "HIDDEN"] as const;
export type PostStatus = (typeof POST_STATUSES)[number];

export const POST_LINK_TYPES = [
  {
    value: "EXTERNAL",
    label: "External",
    labelKey: "studio.ui.options.post_link_type.external",
  },
  {
    value: "YOUTUBE",
    label: "YouTube",
    labelKey: "studio.ui.options.post_link_type.youtube",
  },
  {
    value: "WEBSITE",
    label: "Website",
    labelKey: "studio.ui.options.post_link_type.website",
  },
] as const;

export const POST_MEDIA_TYPES = ["IMAGE", "VIDEO", "AUDIO"] as const;
export type PostMediaType = (typeof POST_MEDIA_TYPES)[number];

export const MAX_POST_MEDIA_ITEMS = 10;

export const postLinkRowSchema = z.object({
  type: z
    .string()
    .trim()
    .min(1, "studio.validation.type_required")
    .max(50, "studio.validation.type_max_50"),
  url: z
    .string()
    .trim()
    .min(1, "studio.validation.url_required")
    .max(2000, "studio.validation.url_max_2000")
    .refine(
      (value) => value.toLowerCase().startsWith("https://"),
      "studio.validation.url_https_prefix",
    ),
  label: z.string().trim().max(255, "studio.validation.label_max_255"),
});

export type PostLinkRow = z.infer<typeof postLinkRowSchema>;

export const postMediaRowSchema = z.object({
  media_type: z.enum(POST_MEDIA_TYPES),
  media_key: z.string().trim(),
  preview_url: z.string().trim(),
  width: z.number().int().positive().nullable().optional(),
  height: z.number().int().positive().nullable().optional(),
  duration_ms: z.number().int().nonnegative().nullable().optional(),
  /** Existing media from the API has a preview URL but no key we can resubmit. */
  is_existing: z.boolean(),
});

export type PostMediaRow = z.infer<typeof postMediaRowSchema>;

export const postSchema = z
  .object({
    caption: z.string().trim().max(5000, "studio.validation.caption_too_long"),
    status: z.enum(POST_STATUSES),
    media: z.array(postMediaRowSchema).max(MAX_POST_MEDIA_ITEMS),
    links: z.array(postLinkRowSchema),
    /** True when the user replaced or cleared media on edit. */
    media_dirty: z.boolean(),
  })
  .superRefine((data, ctx) => {
    const hasCaption = Boolean(data.caption.trim());
    const hasLinks = data.links.length > 0;
    const mediaCount = data.media_dirty
      ? data.media.filter((m) => m.media_key.trim()).length
      : data.media.length;

    if (!hasCaption && !hasLinks && mediaCount === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "studio.validation.post_content_required",
        path: ["caption"],
      });
    }

    if (data.media_dirty) {
      data.media.forEach((row, index) => {
        if (!row.media_key.trim()) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "studio.validation.upload_incomplete",
            path: ["media", index, "media_key"],
          });
        }
      });
    }
  });

export type PostFormData = z.infer<typeof postSchema>;

export const emptyPostLinkRow = (): PostLinkRow => ({
  type: "EXTERNAL",
  url: "",
  label: "",
});

export const defaultPostFormValues = (): PostFormData => ({
  caption: "",
  status: "PUBLISHED",
  media: [],
  links: [],
  media_dirty: false,
});
