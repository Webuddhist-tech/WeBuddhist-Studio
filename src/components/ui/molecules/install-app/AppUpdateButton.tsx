import { useState } from "react";
import { LuRefreshCw } from "react-icons/lu";
import { useTranslate } from "@tolgee/react";
import { cn } from "@/lib/utils";
import { Button } from "../../atoms/button";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "../../atoms/popover";
import { useAppUpdate, useUpdateWaiting } from "./appUpdateContext";

interface AppUpdateButtonProps {
  /** What a reload costs on this screen. Defaults to a translated warning. */
  description?: string;
  /** Says "Update" beside the icon; the sidebar labels its rows itself. */
  showLabel?: boolean;
  side?: "top" | "right" | "bottom" | "left";
  className?: string;
  /** Hides "Update" where a row runs short of room; it stays readable aloud. */
  labelClassName?: string;
}

/**
 * Keeps a waiting update in reach once its toast has gone. Asks before
 * reloading, as a reload drops what this page has not saved. Renders nothing
 * while there is no update or the toast is still up; menus check
 * `useUpdateWaiting` to leave out its row.
 */
export function AppUpdateButton({
  description,
  showLabel = false,
  labelClassName,
  side = "bottom",
  className,
}: Readonly<AppUpdateButtonProps>) {
  const { t } = useTranslate();
  const { reload } = useAppUpdate();
  const waiting = useUpdateWaiting();
  const [open, setOpen] = useState(false);

  if (!waiting) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size={showLabel ? "sm" : "icon"}
          className={cn("relative", className)}
        >
          <LuRefreshCw className="size-4" />
          <span className={showLabel ? labelClassName : "sr-only"}>
            {t("studio.pwa.update")}
          </span>
          <span
            aria-hidden="true"
            className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-blue-500"
          />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        side={side}
        align="end"
        // Clear of the screen's edge on a phone, where the trigger sits close to it.
        collisionPadding={8}
        className="w-64"
      >
        <PopoverHeader>
          <PopoverTitle>{t("studio.pwa.new_version_title")}</PopoverTitle>
          <PopoverDescription>
            {description ?? t("studio.pwa.unsaved_warning")}
          </PopoverDescription>
        </PopoverHeader>
        <div className="mt-3 flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={() => setOpen(false)}
          >
            {t("studio.pwa.later")}
          </Button>
          <Button size="sm" className="flex-1" onClick={reload}>
            {t("studio.pwa.reload_now")}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
