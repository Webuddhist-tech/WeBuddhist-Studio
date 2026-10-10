import { z } from "zod";

export const signupSchema = z
  .object({
    email: z
      .string()
      .min(1, "studio.validation.email_required")
      .refine((email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email), {
        message: "studio.validation.email_invalid",
      }),
    first_name: z
      .string()
      .min(1, "studio.validation.first_name_required")
      .min(2, "studio.validation.first_name_min_2"),
    last_name: z
      .string()
      .min(1, "studio.validation.last_name_required")
      .min(2, "studio.validation.last_name_min_2"),
    password: z
      .string()
      .min(1, "studio.validation.password_required")
      .min(6, "studio.validation.password_min_6"),
    confirmPassword: z
      .string()
      .min(1, "studio.validation.confirm_password_required"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "studio.validation.passwords_do_not_match",
    path: ["confirmPassword"],
  });
