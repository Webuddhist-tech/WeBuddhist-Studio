import { Button } from "@/components/ui/atoms/button";
import { Input } from "@/components/ui/atoms/input";
import { Label } from "@/components/ui/atoms/label";
import ContainerLayout from "@/components/ui/atoms/studio-card";
import { Link } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import axiosInstance from "@/config/axios-config";
import { useState } from "react";
import { useTranslate } from "@tolgee/react";
import { forgotPasswordSchema } from "@/schema/ForgotPasswordSchema";
import { z } from "zod";

const ForgotPassword = () => {
  const { t } = useTranslate();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const forgotPasswordMutation = useMutation({
    mutationFn: async (emailData: { email: string }) => {
      const response = await axiosInstance.post(
        `/api/v1/cms/auth/request-reset-password`,
        emailData,
      );
      return response.data;
    },
    onSuccess: () => {
      setSuccess(t("studio.auth.forgot_password.email_sent"));
    },
    onError: (error: any) => {
      setError(error.message);
    },
  });
  const handleForgotPassword = (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    const email = formData.get("email") as string;
    try {
      const validatedEmail = forgotPasswordSchema.parse({ email });
      setError("");
      forgotPasswordMutation.mutate({ email: validatedEmail.email });
    } catch (error) {
      if (error instanceof z.ZodError) {
        setError(t(error.issues[0].message));
      }
    }
  };

  return (
    <ContainerLayout title={t("studio.reset_password.description")}>
      <form
        className="w-full max-w-[425px] space-y-4"
        onSubmit={handleForgotPassword}
      >
        <div className="text-sm space-y-2">
          <Label htmlFor="email" className="font-medium">
            {t("common.email")}
          </Label>
          <Input
            type="text"
            placeholder={t("studio.login.placeholder.email")}
            className="placeholder:text-[#b1b1b1]"
            name="email"
          />
        </div>
        {error && (
          <div className="text-red-800 dark:text-red-400 flex items-center justify-center text-sm">
            {error}
          </div>
        )}
        {success && (
          <div className="text-green-800 dark:text-green-400 flex items-center justify-center text-sm">
            {success}
          </div>
        )}
        <div className="flex mt-4 justify-center">
          <Button type="submit" variant="outline" className="w-full text-sm">
            {t("common.button.submit")}
          </Button>
        </div>
        <div className="flex justify-center">
          <Link to="/login" className="text-sm">
            {t("studio.reset_password.back_to_login")}
          </Link>
        </div>
      </form>
    </ContainerLayout>
  );
};

export default ForgotPassword;
