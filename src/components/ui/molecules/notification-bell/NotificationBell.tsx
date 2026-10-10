import { useState } from "react";
import { useTranslate } from "@tolgee/react";
import { IoNotificationsOutline } from "react-icons/io5";
import { Pecha } from "@/components/ui/shadimport";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/atoms/tooltip";
import {
  NotificationsPanel,
  useUnreadNotifications,
} from "./NotificationsPanel";

const NotificationBell = () => {
  const { t } = useTranslate();
  const [open, setOpen] = useState(false);
  const [tooltipOpen, setTooltipOpen] = useState(false);
  const { data } = useUnreadNotifications();
  const unreadCount = data?.total ?? 0;

  const handleMenuOpenChange = (next: boolean) => {
    setOpen(next);
    setTooltipOpen(false);
  };

  return (
    <Pecha.DropdownMenu open={open} onOpenChange={handleMenuOpenChange}>
      <Tooltip open={open ? false : tooltipOpen} onOpenChange={setTooltipOpen}>
        <TooltipTrigger asChild>
          <Pecha.DropdownMenuTrigger asChild>
            <button
              type="button"
              className="relative border p-2 rounded-md text-zinc-400 dark:text-zinc-600 hover:text-black dark:hover:text-white transition-colors"
              aria-label={t("studio.notifications.title")}
            >
              <IoNotificationsOutline className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#A51C21] px-1 text-[10px] font-medium text-white">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </button>
          </Pecha.DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side="right">
          {t("studio.notifications.title")}
        </TooltipContent>
      </Tooltip>

      <Pecha.DropdownMenuContent
        side="right"
        align="start"
        className="w-auto max-h-none overflow-visible p-0"
        onCloseAutoFocus={(event) => event.preventDefault()}
      >
        <NotificationsPanel onRequestClose={() => setOpen(false)} />
      </Pecha.DropdownMenuContent>
    </Pecha.DropdownMenu>
  );
};

export default NotificationBell;
