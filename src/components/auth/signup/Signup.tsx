import { Button } from "@/components/ui/atoms/button";
import { Input } from "@/components/ui/atoms/input";
import { Label } from "@/components/ui/atoms/label";
import ContainerLayout from "@/components/ui/atoms/studio-card";
import { Link, useNavigate } from "react-router-dom";
import { useTranslate } from "@tolgee/react";
import axiosInstance from "@/config/axios-config";
import { type FormEvent } from "react";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { z } from "zod";
import { signupSchema } from "@/schema/SignupSchema";
import { createPasswordHash } from "@/lib/utils";
interface SignupData {
  email: string;
  first_name: string;
  last_name: string;
  password: string;
}

const Signup = () => {
  const { t } = useTranslate();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  const signupMutation = useMutation<any, Error, SignupData>({
    mutationFn: async (signupData: SignupData) => {
      const response = await axiosInstance.post(
        `/api/v1/cms/auth/register`,
        signupData,
      );
      return response.data;
    },
    onSuccess: () => {
      setTimeout(() => {
        navigate("/login");
      }, 2000);
    },
    onError: (error: any) => {
      setError(error.response.data.detail.message);
    },
  });

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;
    const confirmPassword = formData.get("confirm-password") as string;
    const first_name = formData.get("first_name") as string;
    const last_name = formData.get("last_name") as string;

    const formDataObj = {
      email,
      first_name,
      last_name,
      password,
      confirmPassword,
    };

    try {
      const validatedData = signupSchema.parse(formDataObj);
      const clientPassword = createPasswordHash(email, password);
      signupMutation.mutate({
        email: validatedData.email,
        first_name: validatedData.first_name,
        last_name: validatedData.last_name,
        password: clientPassword,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        setError(t(error.issues[0].message));
      }
    }
  };
  return (
    <ContainerLayout title={t("studio.signup.title")}>
      <form className="w-full max-w-[425px] space-y-4" onSubmit={handleSubmit}>
        <div className="text-sm space-y-2">
          <Label htmlFor="email" className="font-medium">
            {t("common.email")}
          </Label>
          <Input
            type="email"
            name="email"
            placeholder={t("studio.login.placeholder.email")}
            className=" placeholder:text-[#b1b1b1]"
            required
          />
        </div>
        <div className="text-sm space-y-2">
          <Label htmlFor="firstname" className="font-medium">
            {t("sign_up.form.first_name")}
          </Label>
          <Input
            type="text"
            name="first_name"
            placeholder={t("studio.signup.placeholder.first_name")}
            className="placeholder:text-[#b1b1b1]"
            required
          />
        </div>
        <div className="text-sm space-y-2">
          <Label htmlFor="last_name" className="font-medium">
            {t("sign_up.form.last_name")}
          </Label>
          <Input
            type="text"
            name="last_name"
            placeholder={t("studio.signup.placeholder.last_name")}
            className="placeholder:text-[#b1b1b1]"
            required
          />
        </div>
        <div className="text-sm space-y-2">
          <Label htmlFor="password" className="font-medium">
            {t("common.password")}
          </Label>
          <Input
            type="password"
            name="password"
            placeholder={t("studio.signup.placeholder.password")}
            className=" placeholder:text-[#b1b1b1]"
            required
          />
        </div>
        <div className="text-sm space-y-2">
          <Label htmlFor="confirm-password" className="font-medium">
            {t("common.confirm_password")}
          </Label>
          <Input
            type="password"
            name="confirm-password"
            placeholder={t("studio.signup.placeholder.password")}
            className=" placeholder:text-[#b1b1b1]"
            required
          />
        </div>

        <div className="flex mt-4 justify-center ">
          <Button
            type="submit"
            variant="outline"
            className=" w-full text-sm "
            disabled={signupMutation.isPending}
          >
            {signupMutation.isPending
              ? t("studio.signup.signing_up")
              : t("common.button.submit")}
          </Button>
        </div>

        {error && (
          <div className="text-red-800 dark:text-red-400 flex items-center justify-center text-sm">
            {error}
          </div>
        )}
        {signupMutation.isSuccess && (
          <div className="text-green-600 text-center dark:text-green-400 text-sm mb-2">
            {t("studio.signup.success_message")}
          </div>
        )}
        <div className="flex justify-center">
          <Link to="/login" className="text-sm">
            {t("sign_up.already_have_account")}
          </Link>
        </div>
      </form>
    </ContainerLayout>
  );
};

export default Signup;
