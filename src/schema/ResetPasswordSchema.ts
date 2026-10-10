import { z } from "zod";

export const resetPasswordSchema = z
  .object({
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
