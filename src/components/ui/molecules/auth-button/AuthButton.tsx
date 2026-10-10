import { useState } from "react";
import { useTranslate } from "@tolgee/react";
import { Link } from "react-router-dom";
import {
  IoChevronBack,
  IoNotificationsOutline,
  IoPersonOutline,
} from "react-icons/io5";
import { useAuth } from "@/config/auth-context";
import { NO_PROFILE_IMAGE } from "@/lib/constant";
import { ROUTES } from "@/routes/paths";
import { useUserInfo } from "@/hooks/useUserInfo";
import { Pecha } from "@/components/ui/shadimport";
import {
  NotificationsPanel,
  useUnreadNotifications,
} from "@/components/ui/molecules/notification-bell/NotificationsPanel";

type MenuView = "options" | "notifications";

type AuthButtonProps = {
  /** "compact" is the bare avatar for the phone's top bar. Page headers use the
   * default, which steps aside on a phone because that top bar carries it. */
  variant?: "header" | "compact";
};

const AuthButton = ({ variant = "header" }: AuthButtonProps) => {
  const compact = variant === "compact";
  const { t } = useTranslate();
  const { isLoggedIn } = useAuth();
  const { data: userInfo } = useUserInfo();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<MenuView>("options");
  const { data: notificationsData } = useUnreadNotifications();
  const unreadCount = notificationsData?.total ?? 0;

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) setView("options");
  };

  if (!isLoggedIn) return null;

  return (
    <Pecha.DropdownMenu open={open} onOpenChange={handleOpenChange}>
      <Pecha.DropdownMenuTrigger asChild>
        <button
          type="button"
          className={`flex items-center font-dynamic gap-2 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring ${
            compact ? "" : "max-md:hidden"
          }`}
          aria-label={t("studio.nav.account_menu")}
        >
          <div className="relative">
            <img
              src={
                userInfo?.image?.thumbnail ||
                userInfo?.image_url ||
                NO_PROFILE_IMAGE
              }
              alt={t("studio.nav.user_avatar_alt")}
              className={
                compact
                  ? "block h-8 w-8 rounded-full object-cover"
                  : "hidden w-10 h-10 object-cover md:block rounded-full"
              }
            />
            {unreadCount > 0 && (
              <span
                className={`absolute -top-0.5 -right-0.5 ${
                  compact ? "flex" : "hidden md:flex"
                } h-4 min-w-4 items-center justify-center rounded-full bg-[#A51C21] px-1 text-[10px] font-medium text-white`}
              >
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </div>
          <div
            className={compact ? "hidden" : "md:flex hidden flex-col text-left"}
          >
            <span className="text-sm font-medium">
              {userInfo?.firstname} {userInfo?.lastname}
            </span>
            <span className="text-xs text-[#8a8a8a]">{userInfo?.email}</span>
          </div>
        </button>
      </Pecha.DropdownMenuTrigger>

      <Pecha.DropdownMenuContent
        align="end"
        className={
          view === "notifications"
            ? "w-auto max-h-none overflow-visible p-0"
            : "min-w-[12rem]"
        }
        onCloseAutoFocus={(event) => event.preventDefault()}
      >
        {view === "options" ? (
          <>
            <Pecha.DropdownMenuItem asChild>
              <Link to={ROUTES.profile} className="cursor-pointer">
                <IoPersonOutline className="size-4" />
                {t("studio.nav.profile")}
              </Link>
            </Pecha.DropdownMenuItem>
            <Pecha.DropdownMenuItem
              className="cursor-pointer"
              onSelect={(event) => {
                event.preventDefault();
                setView("notifications");
              }}
            >
              <IoNotificationsOutline className="size-4" />
              {t("studio.notifications.title")}
              {unreadCount > 0 ? (
                <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-[#A51C21] px-1.5 text-[10px] font-medium text-white">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              ) : null}
            </Pecha.DropdownMenuItem>
          </>
        ) : (
          <div>
            <button
              type="button"
              className="flex w-full items-center gap-2 border-b px-3 py-2 text-sm font-medium hover:bg-accent"
              onClick={() => setView("options")}
            >
              <IoChevronBack className="size-4" />
              {t("studio.notifications.title")}
            </button>
            <NotificationsPanel
              showHeader={false}
              onRequestClose={() => setOpen(false)}
            />
          </div>
        )}
      </Pecha.DropdownMenuContent>
    </Pecha.DropdownMenu>
  );
};

export default AuthButton;
