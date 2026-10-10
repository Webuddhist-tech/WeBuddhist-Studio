import { Pecha } from "@/components/ui/shadimport";
import { useEffect, useRef, useState } from "react";
import UserCard from "@/components/ui/molecules/user-card/UserCard";
import ProfileEditForm from "@/components/ui/molecules/profile-edit-form/ProfileEditForm";
import { useUserInfo } from "@/hooks/useUserInfo";
import { useStudioAuth0 } from "@/config/studio-auth0";
import {
  AUTH0_INTENT,
  consumeAuth0Intent,
  getAuth0Config,
  peekAuth0Intent,
  setAuth0Intent,
} from "@/config/auth0-config";
import { getPhoneAuthErrorMessage, linkPhoneToken } from "@/lib/phoneAuthApi";
import { toast } from "sonner";
import { useTranslate } from "@tolgee/react";

const Profile = () => {
  const { t } = useTranslate();
  const [isEditing, setIsEditing] = useState(false);
  const [linkError, setLinkError] = useState("");
  const [linkSuccess, setLinkSuccess] = useState("");
  const [isLinking, setIsLinking] = useState(false);
  const linkHandled = useRef(false);
  const { data: userInfo, isLoading } = useUserInfo();
  const auth0Config = getAuth0Config();
  const {
    isConfigured: isAuth0Configured,
    loginWithRedirect,
    getAccessTokenSilently,
    isAuthenticated: isAuth0Authenticated,
    isLoading: isAuth0Loading,
  } = useStudioAuth0();

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleCancel = () => {
    setIsEditing(false);
  };

  const handleEditSuccess = () => {
    setIsEditing(false);
  };

  useEffect(() => {
    if (!isAuth0Configured || isAuth0Loading || linkHandled.current) return;
    if (peekAuth0Intent() !== AUTH0_INTENT.phoneLink) return;
    if (!isAuth0Authenticated) return;

    linkHandled.current = true;
    consumeAuth0Intent();

    const runLink = async () => {
      setIsLinking(true);
      setLinkError("");
      setLinkSuccess("");
      try {
        const auth0Token = await getAccessTokenSilently({
          authorizationParams: auth0Config.audience
            ? { audience: auth0Config.audience }
            : undefined,
        });
        const result = await linkPhoneToken(auth0Token);
        const message =
          result.message ||
          t("studio.profile.phone_linked", { phone: result.phone_number });
        setLinkSuccess(message);
        toast.success(message);
      } catch (error) {
        linkHandled.current = false;
        const message = getPhoneAuthErrorMessage(
          error,
          t("studio.profile.phone_link_failed"),
        );
        setLinkError(message);
        toast.error(message);
      } finally {
        setIsLinking(false);
      }
    };

    void runLink();
  }, [
    auth0Config.audience,
    getAccessTokenSilently,
    isAuth0Authenticated,
    isAuth0Configured,
    isAuth0Loading,
  ]);

  const handleLinkPhone = async () => {
    setLinkError("");
    setLinkSuccess("");

    if (!isAuth0Configured) {
      setLinkError(t("studio.profile.phone_link_not_configured"));
      return;
    }

    try {
      setAuth0Intent(AUTH0_INTENT.phoneLink);
      await loginWithRedirect({
        authorizationParams: {
          connection: auth0Config.connection,
          redirect_uri: window.location.origin,
          ...(auth0Config.audience ? { audience: auth0Config.audience } : {}),
        },
        appState: {
          intent: AUTH0_INTENT.phoneLink,
          returnTo: "/profile",
        },
      });
    } catch {
      setLinkError(t("studio.profile.phone_link_start_failed"));
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6 w-full">
        <Pecha.Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!userInfo?.id) {
    return null;
  }

  return (
    <div className="container flex items-center justify-center mx-auto p-6">
      <div className="border w-full border-dashed rounded-lg space-y-6">
        <div className="flex h-full border-b border-dashed border-gray-300 dark:border-input justify-between items-center p-4">
          <h1 className="text-xl font-semibold">{t("studio.profile.title")}</h1>
          {!isEditing ? (
            <Pecha.Button variant="outline" onClick={handleEdit}>
              {t("studio.common.edit")}
            </Pecha.Button>
          ) : (
            <Pecha.Button variant="outline" onClick={handleCancel}>
              {t("studio.common.cancel")}
            </Pecha.Button>
          )}
        </div>
        {!isEditing ? (
          <>
            <UserCard userInfo={userInfo} />
            <div className="px-6 pb-6 space-y-3">
              <Pecha.Button
                variant="outline"
                onClick={handleLinkPhone}
                disabled={isLinking || isAuth0Loading}
              >
                {isLinking
                  ? t("studio.profile.linking_phone")
                  : t("studio.profile.link_phone")}
              </Pecha.Button>
              {linkError && (
                <p className="text-sm text-red-800 dark:text-red-400">
                  {linkError}
                </p>
              )}
              {linkSuccess && (
                <p className="text-sm text-green-800 dark:text-green-400">
                  {linkSuccess}
                </p>
              )}
            </div>
          </>
        ) : (
          <ProfileEditForm userInfo={userInfo} onSuccess={handleEditSuccess} />
        )}
      </div>
    </div>
  );
};

export default Profile;
