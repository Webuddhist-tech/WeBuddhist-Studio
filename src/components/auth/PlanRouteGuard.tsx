import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useUserInfo } from "@/hooks/useUserInfo";
import { canAccessPlanRoutes } from "@/lib/platformAccess";
import { ROUTES } from "@/routes/paths";
import { useTranslate } from "@tolgee/react";

type PlanRouteGuardProps = {
  children: ReactNode;
};

/** Blocks `/plan/*` CMS routes for platform REVIEWER (read-only staff). */
const PlanRouteGuard = ({ children }: PlanRouteGuardProps) => {
  const { data: userInfo, isLoading } = useUserInfo();
  const { t } = useTranslate();

  if (isLoading) {
    return (
      <div className="flex h-[calc(100vh-40px)] items-center justify-center text-muted-foreground max-md:h-full">
        {t("studio.common.loading")}
      </div>
    );
  }

  if (userInfo && !canAccessPlanRoutes(userInfo.platform_role)) {
    return <Navigate to={ROUTES.dashboard} replace />;
  }

  return <>{children}</>;
};

export default PlanRouteGuard;
