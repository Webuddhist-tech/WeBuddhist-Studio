import { Button } from "@/components/ui/atoms/button";
import { Input } from "@/components/ui/atoms/input";
import { Label } from "@/components/ui/atoms/label";
import ContainerLayout from "@/components/ui/atoms/studio-card";
import {
  IoCallOutline,
  IoLockClosedOutline,
  IoMailOutline,
} from "react-icons/io5";
import { FcGoogle } from "react-icons/fc";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import axiosInstance from "@/config/axios-config";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/config/auth-context";
import { useTranslate } from "@tolgee/react";
import { createPasswordHash } from "@/lib/utils";
import {
  AUTHOR_NOT_ACTIVE_DETAIL,
  isAuthorNotActiveDetail,
} from "@/lib/platformAccess";
import { getApiErrorDetail, isTransientApiError } from "@/lib/apiErrors";
import { ROUTES } from "@/routes/paths";
import { useStudioAuth0 } from "@/config/studio-auth0";
import {
  AUTH0_INTENT,
  clearPendingAuth0Token,
  consumeAuth0Intent,
  getAuth0Config,
  getAuth0ProviderFromToken,
  getPendingAuth0Provider,
  getPendingAuth0Token,
  peekAuth0Intent,
  setAuth0Intent,
  setPendingAuth0Token,
  type Auth0PendingProvider,
} from "@/config/auth0-config";
import {
  exchangePhoneToken,
  getPhoneAuthErrorMessage,
  isPhoneExchangeInactive,
  isProfileRequiredDetail,
  type PhoneExchangeResponse,
} from "@/lib/phoneAuthApi";
import {
  exchangeGoogleToken,
  getGoogleAuthErrorMessage,
  isGoogleExchangeInactive,
  type GoogleExchangeResponse,
} from "@/lib/googleAuthApi";
import {
  exchangeEmailToken,
  getEmailAuthErrorMessage,
  isEmailExchangeInactive,
  type EmailExchangeResponse,
} from "@/lib/emailAuthApi";

interface LoginData {
  email: string;
  password: string;
}

const Login = () => {
  const { t } = useTranslate();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [errors, setErrors] = useState<string>("");
  const [successMessage, setSuccessMessage] = useState<string>("");
  const [showEmailReverify, setShowEmailReverify] = useState<boolean>(false);
  const [inactiveOnly, setInactiveOnly] = useState(false);
  const [needsOAuthProfile, setNeedsOAuthProfile] = useState(false);
  const [oauthProfileProvider, setOauthProfileProvider] =
    useState<Auth0PendingProvider>("phone");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [oauthExchangePending, setOauthExchangePending] = useState(false);
  const [pendingOauthProvider, setPendingOauthProvider] =
    useState<Auth0PendingProvider | null>(null);
  const oauthCallbackHandled = useRef(false);
  const { login } = useAuth();
  const auth0Config = getAuth0Config();
  const {
    isConfigured: isAuth0Configured,
    loginWithRedirect,
    getAccessTokenSilently,
    isAuthenticated: isAuth0Authenticated,
    isLoading: isAuth0Loading,
  } = useStudioAuth0();

  useEffect(() => {
    const state = location.state as {
      inactive?: boolean;
      message?: string;
    } | null;
    if (state?.inactive) {
      setInactiveOnly(true);
      setErrors(state.message ?? AUTHOR_NOT_ACTIVE_DETAIL);
    }
  }, [location.state]);

  /** Any account (CREATOR, REVIEWER, SUPER_ADMIN) signs in here; the dashboard
   * and nav branch on platform_role/has_group from useUserInfo afterwards. */
  const completeLogin = (accessToken: string, refreshToken?: string) => {
    login(accessToken, refreshToken);
    navigate(ROUTES.dashboard);
  };

  const applyPhoneExchangeResult = (data: PhoneExchangeResponse) => {
    if (isPhoneExchangeInactive(data)) {
      clearPendingAuth0Token();
      setNeedsOAuthProfile(false);
      setInactiveOnly(true);
      setErrors(data.message || AUTHOR_NOT_ACTIVE_DETAIL);
      return;
    }

    if (data.auth?.access_token && data.auth?.refresh_token) {
      clearPendingAuth0Token();
      setNeedsOAuthProfile(false);
      void completeLogin(data.auth.access_token, data.auth.refresh_token);
      return;
    }

    setErrors(data.message || "Phone authentication failed");
  };

  const applyGoogleExchangeResult = (data: GoogleExchangeResponse) => {
    if (isGoogleExchangeInactive(data)) {
      clearPendingAuth0Token();
      setNeedsOAuthProfile(false);
      setInactiveOnly(true);
      setErrors(data.message || AUTHOR_NOT_ACTIVE_DETAIL);
      return;
    }

    if (data.auth?.access_token && data.auth?.refresh_token) {
      clearPendingAuth0Token();
      setNeedsOAuthProfile(false);
      void completeLogin(data.auth.access_token, data.auth.refresh_token);
      return;
    }

    setErrors(data.message || "Google authentication failed");
  };

  const applyEmailExchangeResult = (data: EmailExchangeResponse) => {
    if (isEmailExchangeInactive(data)) {
      clearPendingAuth0Token();
      setNeedsOAuthProfile(false);
      setInactiveOnly(true);
      setErrors(data.message || AUTHOR_NOT_ACTIVE_DETAIL);
      return;
    }

    if (data.auth?.access_token && data.auth?.refresh_token) {
      clearPendingAuth0Token();
      setNeedsOAuthProfile(false);
      void completeLogin(data.auth.access_token, data.auth.refresh_token);
      return;
    }

    setErrors(data.message || "Email authentication failed");
  };

  const phoneExchangeMutation = useMutation({
    mutationFn: exchangePhoneToken,
    onSuccess: (data) => {
      applyPhoneExchangeResult(data);
    },
    onError: (error: unknown) => {
      const detail = getApiErrorDetail(error);
      if (isProfileRequiredDetail(detail)) {
        setOauthProfileProvider("phone");
        setNeedsOAuthProfile(true);
        setErrors("");
        return;
      }
      if (isAuthorNotActiveDetail(detail)) {
        clearPendingAuth0Token();
        setNeedsOAuthProfile(false);
        setInactiveOnly(true);
        setErrors(AUTHOR_NOT_ACTIVE_DETAIL);
        return;
      }
      // Transient network/server failures do not invalidate the stored token;
      // keep the profile form so the user can retry without re-authenticating.
      if (isTransientApiError(error) && needsOAuthProfile) {
        setErrors(getPhoneAuthErrorMessage(error));
        return;
      }
      // The stored token can never succeed after this point; clear it so the
      // profile form is not re-shown with a token the backend already rejected.
      clearPendingAuth0Token();
      setNeedsOAuthProfile(false);
      setErrors(getPhoneAuthErrorMessage(error));
    },
    onSettled: () => {
      setOauthExchangePending(false);
      setPendingOauthProvider(null);
    },
  });

  const googleExchangeMutation = useMutation({
    mutationFn: exchangeGoogleToken,
    onSuccess: (data) => {
      applyGoogleExchangeResult(data);
    },
    onError: (error: unknown) => {
      const detail = getApiErrorDetail(error);
      if (isProfileRequiredDetail(detail)) {
        setOauthProfileProvider("google");
        setNeedsOAuthProfile(true);
        setErrors("");
        return;
      }
      if (isAuthorNotActiveDetail(detail)) {
        clearPendingAuth0Token();
        setNeedsOAuthProfile(false);
        setInactiveOnly(true);
        setErrors(AUTHOR_NOT_ACTIVE_DETAIL);
        return;
      }
      if (isTransientApiError(error) && needsOAuthProfile) {
        setErrors(getGoogleAuthErrorMessage(error));
        return;
      }
      clearPendingAuth0Token();
      setNeedsOAuthProfile(false);
      setErrors(getGoogleAuthErrorMessage(error));
    },
    onSettled: () => {
      setOauthExchangePending(false);
      setPendingOauthProvider(null);
    },
  });

  const emailExchangeMutation = useMutation({
    mutationFn: exchangeEmailToken,
    onSuccess: (data) => {
      applyEmailExchangeResult(data);
    },
    onError: (error: unknown) => {
      const detail = getApiErrorDetail(error);
      if (isProfileRequiredDetail(detail)) {
        setOauthProfileProvider("email");
        setNeedsOAuthProfile(true);
        setErrors("");
        return;
      }
      if (isAuthorNotActiveDetail(detail)) {
        clearPendingAuth0Token();
        setNeedsOAuthProfile(false);
        setInactiveOnly(true);
        setErrors(AUTHOR_NOT_ACTIVE_DETAIL);
        return;
      }
      if (isTransientApiError(error) && needsOAuthProfile) {
        setErrors(getEmailAuthErrorMessage(error));
        return;
      }
      clearPendingAuth0Token();
      setNeedsOAuthProfile(false);
      setErrors(getEmailAuthErrorMessage(error));
    },
    onSettled: () => {
      setOauthExchangePending(false);
      setPendingOauthProvider(null);
    },
  });

  useEffect(() => {
    if (!isAuth0Configured) return;
    if (isAuth0Loading || oauthCallbackHandled.current) return;

    const pendingToken = getPendingAuth0Token();
    const pendingProvider = getPendingAuth0Provider();
    if (pendingToken && !needsOAuthProfile) {
      setOauthProfileProvider(pendingProvider ?? "phone");
      setNeedsOAuthProfile(true);
    }

    const intent = peekAuth0Intent();
    if (
      intent !== AUTH0_INTENT.phoneLogin &&
      intent !== AUTH0_INTENT.googleLogin
    ) {
      return;
    }
    if (!isAuth0Authenticated) return;

    oauthCallbackHandled.current = true;
    consumeAuth0Intent();
    const intentProvider: Auth0PendingProvider =
      intent === AUTH0_INTENT.googleLogin ? "google" : "phone";

    const runExchange = async () => {
      setOauthExchangePending(true);
      setPendingOauthProvider(intentProvider);
      setErrors("");
      try {
        const auth0Token = await getAccessTokenSilently({
          authorizationParams: auth0Config.audience
            ? { audience: auth0Config.audience }
            : undefined,
        });
        // The user may have switched identifier (e.g. email instead of phone)
        // on the Auth0 page, so trust the token's connection over the intent.
        const provider =
          getAuth0ProviderFromToken(auth0Token) ?? intentProvider;
        setPendingOauthProvider(provider);
        setPendingAuth0Token(auth0Token, provider);
        if (provider === "google") {
          googleExchangeMutation.mutate({ auth0_token: auth0Token });
        } else if (provider === "email") {
          emailExchangeMutation.mutate({ auth0_token: auth0Token });
        } else {
          phoneExchangeMutation.mutate({ auth0_token: auth0Token });
        }
      } catch {
        oauthCallbackHandled.current = false;
        setOauthExchangePending(false);
        setPendingOauthProvider(null);
        setErrors(
          intentProvider === "google"
            ? "Unable to complete Google login. Please try again."
            : "Unable to complete phone login. Please try again.",
        );
      }
    };

    void runExchange();
    // Intentionally omit mutations from deps to avoid re-running callback.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isAuth0Configured,
    auth0Config.audience,
    getAccessTokenSilently,
    isAuth0Authenticated,
    isAuth0Loading,
    needsOAuthProfile,
  ]);

  const loginMutation = useMutation<any, Error, LoginData>({
    mutationFn: async (loginData: LoginData) => {
      const response = await axiosInstance.post(
        `/api/v1/cms/auth/login`,
        loginData,
      );
      return response.data;
    },
    onSuccess: (data: any) => {
      const accessToken = data.auth.access_token;
      const refreshToken = data.auth.refresh_token;
      void completeLogin(accessToken, refreshToken);
    },
    onError: (error: any) => {
      const detail = getApiErrorDetail(error) ?? "Login failed";
      const emailVerificationErrorMessage = detail
        .toLowerCase()
        .includes("author not verified");

      if (isAuthorNotActiveDetail(detail)) {
        setInactiveOnly(true);
        setShowEmailReverify(false);
        setErrors(AUTHOR_NOT_ACTIVE_DETAIL);
        return;
      }

      setInactiveOnly(false);
      setShowEmailReverify(emailVerificationErrorMessage);
      setErrors(detail);
    },
  });

  const emailReverifyMutation = useMutation<any, Error, { email: string }>({
    mutationFn: async (data: { email: string }) => {
      const response = await axiosInstance.post(
        `/api/v1/cms/auth/email-re-verification?email=${encodeURIComponent(data.email)}`,
      );
      return response.data;
    },
    onSuccess: (data: any) => {
      const message = data?.message;
      setSuccessMessage(message);
      setErrors("");
    },
    onError: (error: any) => {
      const errorMsg =
        getApiErrorDetail(error) || "Email re-verification failed";
      setErrors(errorMsg);
      setSuccessMessage("");
    },
  });

  const handleLogin = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setShowEmailReverify(false);
    setSuccessMessage("");
    setInactiveOnly(false);
    const formData = new FormData(e.currentTarget);
    const password = formData.get("password") as string;
    const clientPassword = createPasswordHash(email, password);
    loginMutation.mutate({
      email,
      password: clientPassword,
    });
  };

  const handleEmailReverify = () => {
    setErrors("");
    setSuccessMessage("");
    emailReverifyMutation.mutate({ email });
  };

  const startAuth0Login = async (
    connection: string,
    intent: typeof AUTH0_INTENT.phoneLogin | typeof AUTH0_INTENT.googleLogin,
    failureMessage: string,
  ) => {
    setErrors("");
    setSuccessMessage("");
    setInactiveOnly(false);
    setNeedsOAuthProfile(false);

    if (!isAuth0Configured) {
      setErrors(
        intent === AUTH0_INTENT.googleLogin
          ? "Google login is not configured."
          : "Phone login is not configured.",
      );
      return;
    }

    try {
      setAuth0Intent(intent);
      await loginWithRedirect({
        authorizationParams: {
          connection,
          redirect_uri: window.location.origin,
          ...(auth0Config.audience ? { audience: auth0Config.audience } : {}),
        },
        appState: {
          intent,
          returnTo: ROUTES.login,
        },
      });
    } catch {
      setErrors(failureMessage);
    }
  };

  const handleContinueWithPhone = async () => {
    await startAuth0Login(
      auth0Config.connection,
      AUTH0_INTENT.phoneLogin,
      "Unable to start phone login. Please try again.",
    );
  };

  const handleContinueWithGoogle = async () => {
    await startAuth0Login(
      auth0Config.googleConnection,
      AUTH0_INTENT.googleLogin,
      "Unable to start Google login. Please try again.",
    );
  };

  const handleOAuthProfileSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const auth0Token = getPendingAuth0Token();
    if (!auth0Token) {
      setErrors("Sign-in session expired. Please try again.");
      setNeedsOAuthProfile(false);
      return;
    }
    setErrors("");
    const payload = {
      auth0_token: auth0Token,
      first_name: firstName.trim(),
      last_name: lastName.trim(),
    };
    if (oauthProfileProvider === "google") {
      googleExchangeMutation.mutate(payload);
    } else if (oauthProfileProvider === "email") {
      emailExchangeMutation.mutate(payload);
    } else {
      phoneExchangeMutation.mutate(payload);
    }
  };

  if (inactiveOnly) {
    return (
      <ContainerLayout title={t("studio.login.title")}>
        <div className="animate-in fade-in-0 slide-in-from-top-1 w-full max-w-[425px] space-y-4 text-center duration-500">
          <p className="text-sm text-muted-foreground">
            {errors || AUTHOR_NOT_ACTIVE_DETAIL}
          </p>
          <p className="text-xs text-muted-foreground">
            Your account must be activated by a platform administrator before
            you can sign in.
          </p>
        </div>
      </ContainerLayout>
    );
  }

  if (needsOAuthProfile) {
    const profilePending =
      oauthProfileProvider === "google"
        ? googleExchangeMutation.isPending
        : oauthProfileProvider === "email"
          ? emailExchangeMutation.isPending
          : phoneExchangeMutation.isPending;

    return (
      <ContainerLayout title={t("studio.login.title")}>
        <form
          key="oauth-profile"
          className="animate-in fade-in-0 slide-in-from-bottom-2 w-full max-w-[425px] space-y-4 duration-500"
          onSubmit={handleOAuthProfileSubmit}
        >
          <p className="text-sm text-muted-foreground">
            Enter your name to finish creating your account.
          </p>
          <div className="text-sm space-y-2">
            <Label htmlFor="first_name" className="font-medium">
              First name
            </Label>
            <Input
              id="first_name"
              name="first_name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              required
            />
          </div>
          <div className="text-sm space-y-2">
            <Label htmlFor="last_name" className="font-medium">
              Last name
            </Label>
            <Input
              id="last_name"
              name="last_name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              required
            />
          </div>
          <Button
            type="submit"
            variant="outline"
            className="w-full text-sm transition-transform hover:scale-[1.02] active:scale-[0.98]"
            disabled={profilePending}
          >
            {profilePending ? "Creating profile..." : "Create profile"}
          </Button>
          {errors && (
            <div className="animate-in fade-in-0 slide-in-from-top-1 text-center text-sm text-red-800 duration-300 dark:text-red-400">
              {errors}
            </div>
          )}
        </form>
      </ContainerLayout>
    );
  }

  return (
    <ContainerLayout title={t("studio.login.title")}>
      <form
        key="email-login"
        className="animate-in fade-in-0 slide-in-from-bottom-2 w-full max-w-[425px] space-y-4 duration-500"
        onSubmit={handleLogin}
      >
        <div className="text-sm space-y-2">
          <Label htmlFor="email" className="font-medium">
            {t("common.email")}
          </Label>
          <div className="relative">
            <IoMailOutline className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="email"
              type="email"
              placeholder={t("studio.login.placeholder.email")}
              className="pl-9 placeholder:text-[#b1b1b1]"
              required
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
              }}
            />
          </div>
        </div>

        <div className="text-sm space-y-2">
          <Label htmlFor="password" className="font-medium">
            {t("common.password")}
          </Label>
          <div className="relative">
            <IoLockClosedOutline className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="password"
              type="password"
              name="password"
              placeholder={t("studio.login.placeholder.password")}
              className="pl-9 placeholder:text-[#b1b1b1]"
              required
            />
          </div>
        </div>
        <div className="flex justify-center pt-2">
          <Button
            type="submit"
            className="w-full bg-gradient-to-r from-amber-500 to-orange-500 text-sm text-white shadow-lg shadow-amber-500/20 transition-transform hover:scale-[1.02] hover:from-amber-600 hover:to-orange-600 active:scale-[0.98]"
          >
            {t("common.button.submit")}
          </Button>
        </div>

        <div className="flex items-center gap-3 py-1">
          <div className="h-px flex-1 bg-border" />
          <span className="text-xs text-muted-foreground">
            or continue with
          </span>
          <div className="h-px flex-1 bg-border" />
        </div>

        <div className="flex justify-center">
          <Button
            type="button"
            variant="outline"
            className="w-full text-sm transition-transform hover:scale-[1.02] active:scale-[0.98]"
            onClick={handleContinueWithGoogle}
            disabled={oauthExchangePending || isAuth0Loading}
          >
            <FcGoogle className="h-4 w-4 shrink-0" />
            {pendingOauthProvider === "google"
              ? "Continuing with Google..."
              : "Continue with Google"}
          </Button>
        </div>
        <div className="flex justify-center">
          <Button
            type="button"
            variant="outline"
            className="w-full text-sm transition-transform hover:scale-[1.02] active:scale-[0.98]"
            onClick={handleContinueWithPhone}
            disabled={oauthExchangePending || isAuth0Loading}
          >
            <IoCallOutline className="h-4 w-4 shrink-0" />
            {pendingOauthProvider === "phone"
              ? "Continuing with phone..."
              : "Continue with phone"}
          </Button>
        </div>
        {showEmailReverify && (
          <div className="animate-in fade-in-0 duration-300">
            <Button
              type="button"
              variant="outline"
              className="w-full text-sm"
              onClick={handleEmailReverify}
              disabled={emailReverifyMutation.isPending}
            >
              {emailReverifyMutation.isPending
                ? t("studio.login.sending")
                : t("studio.login.reverify_your_email")}
            </Button>
          </div>
        )}
        {errors && (
          <div className="animate-in fade-in-0 slide-in-from-top-1 text-center text-sm text-red-800 duration-300 dark:text-red-400">
            {errors}
          </div>
        )}
        {successMessage && (
          <div className="animate-in fade-in-0 slide-in-from-top-1 text-center text-sm text-green-800 duration-300 dark:text-green-400">
            {successMessage}
          </div>
        )}
        <div className="flex justify-center">
          <Link
            to="/forgot-password"
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            {t("studio.login.forgot_password")}
          </Link>
        </div>

        <div className="flex justify-center">
          <Link
            to="/signup"
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            {t("studio.login.no_account")}
          </Link>
        </div>
      </form>
    </ContainerLayout>
  );
};

export default Login;
