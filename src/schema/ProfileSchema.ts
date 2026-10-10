import { z } from "zod";

export const profileSchema = z.object({
  firstname: z
    .string()
    .min(1, "studio.validation.first_name_required")
    .min(2, "studio.validation.first_name_min_2"),
  lastname: z
    .string()
    .min(1, "studio.validation.last_name_required")
    .min(2, "studio.validation.last_name_min_2"),
  bio: z.string().optional(),
  image_url: z.string().optional(),
});

export const socialProfileSchema = z.object({
  account: z.string().min(1, "studio.validation.social_platform_required"),
  url: z
    .string()
    .url("studio.validation.url_invalid_please")
    .min(1, "studio.validation.url_required"),
});

export type ProfileFormData = z.infer<typeof profileSchema>;
export type SocialProfileData = z.infer<typeof socialProfileSchema>;
