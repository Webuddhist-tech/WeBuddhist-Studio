import { useEffect } from "react";
import { useAuth } from "@/config/auth-context";
import { Navigate, useLocation } from "react-router-dom";
import { useTranslate } from "@tolgee/react";
import { useUserInfo } from "@/hooks/useUserInfo";
import { Button } from "@/components/ui/atoms/button";
import {
  needsGroupOnboardingRedirect,
  needsInactiveLogout,
  needsVerifyEmailRedirect,
} from "@/lib/platformAccess";
import { ROUTES } from "@/routes/paths";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const { isLoggedIn, isAuthLoading, logout } = useAuth();
  const { t } = useTranslate();
  const location = useLocation();
  const {
    data: userInfo,
    isLoading: isUserInfoLoading,
    isError: isUserInfoError,
    refetch: refetchUserInfo,
  } = useUserInfo({
    enabled: isLoggedIn,
  });

  useEffect(() => {
    if (!isLoggedIn || isUserInfoLoading || !userInfo) return;
    if (needsInactiveLogout(userInfo)) {
      logout();
    }
  }, [isLoggedIn, isUserInfoLoading, userInfo, logout]);

  if (isAuthLoading || (isLoggedIn && isUserInfoLoading)) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-lg">{t("common.loading")}</div>
      </div>
    );
  }

  if (!isLoggedIn) {
    const inactive =
      (location.state as { inactive?: boolean } | null)?.inactive === true;
    return (
      <Navigate
        to={ROUTES.login}
        replace
        state={inactive ? { inactive: true } : undefined}
      />
    );
  }

  if (isLoggedIn && isUserInfoError && !userInfo) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <div className="text-base text-red-500">
          {t("studio.auth.profile_load_failed")}
        </div>
        <Button variant="outline" onClick={() => refetchUserInfo()}>
          {t("studio.common.retry")}
        </Button>
      </div>
    );
  }

  if (userInfo && needsInactiveLogout(userInfo)) {
    return (
      <Navigate
        to={ROUTES.login}
        replace
        state={{ inactive: true, message: "Author not active" }}
      />
    );
  }

  if (userInfo && needsVerifyEmailRedirect(userInfo)) {
    return <Navigate to={ROUTES.verifyEmail} replace />;
  }

  if (userInfo && needsGroupOnboardingRedirect(location.pathname, userInfo)) {
    return <Navigate to={ROUTES.groups} replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
