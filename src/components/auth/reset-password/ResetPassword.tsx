import { Button } from "@/components/ui/atoms/button";
import { Input } from "@/components/ui/atoms/input";
import { Label } from "@/components/ui/atoms/label";
import ContainerLayout from "@/components/ui/atoms/studio-card";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import axiosInstance from "@/config/axios-config";
import { useState } from "react";
import { useTranslate } from "@tolgee/react";
import { z } from "zod";
import { resetPasswordSchema } from "@/schema/ResetPasswordSchema";
import { createPasswordHash } from "@/lib/utils";

const ResetPassword = () => {
  const { t } = useTranslate();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const email = searchParams.get("email");

  const navigate = useNavigate();

  const forgotPasswordMutation = useMutation({
    mutationFn: async (password: { password: string }) => {
      const response = await axiosInstance.post(
        `/api/v1/cms/auth/reset-password`,
        { ...password, token },
      );
      return response.data;
    },
    onSuccess: () => {
      setSuccess(t("studio.auth.reset_password.success"));
      setTimeout(() => {
        navigate("/login");
      }, 3000);
    },
    onError: (error: any) => {
      setError(error.message);
    },
  });
  const handleResetPassword = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    const formData = new FormData(e.target as HTMLFormElement);
    const password = formData.get("password") as string;
    const confirmPassword = formData.get("confirmPassword") as string;

    const formDataObj = {
      password,
      confirmPassword,
    };

    try {
      const validatedData = resetPasswordSchema.parse(formDataObj);
      const clientPassword = createPasswordHash(
        email as string,
        validatedData.password,
      );
      forgotPasswordMutation.mutate({ password: clientPassword });
    } catch (error) {
      if (error instanceof z.ZodError) {
        setError(t(error.issues[0].message));
      }
    }
  };

  if (!token) {
    return (
      <ContainerLayout>
        <h2 className="text-xl font-semibold text-center">
          {t("studio.reset_password.invalid_token")}
        </h2>
        <p className="text-center mb-8 text-sm text-red-600 dark:text-red-400">
          {t("studio.reset_password.no_reset_password_token_provided")}
        </p>
      </ContainerLayout>
    );
  }
  return (
    <ContainerLayout title={t("studio.reset_password.new_password")}>
      <form
        className="w-full max-w-[425px] space-y-4"
        onSubmit={handleResetPassword}
      >
        <div className="text-sm space-y-2">
          <Label htmlFor="password" className="font-medium">
            {t("common.password")}
          </Label>
          <Input
            type="password"
            placeholder={t("studio.login.placeholder.password")}
            className="placeholder:text-[#b1b1b1]"
            name="password"
            required
          />
        </div>
        <div className="text-sm space-y-2">
          <Label htmlFor="confirmPassword" className="font-medium">
            {t("common.confirm_password")}
          </Label>
          <Input
            type="password"
            placeholder={t("common.confirm_your_password")}
            className="placeholder:text-[#b1b1b1]"
            name="confirmPassword"
            required
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
        <div className="flex mt-4 justify-center ">
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

export default ResetPassword;
