import { useEffect, useState } from "react";
import { useTranslate } from "@tolgee/react";
import { Pecha } from "@/components/ui/shadimport";
import { Button } from "@/components/ui/atoms/button";
import {
  BAN_DURATION_OPTIONS,
  DEFAULT_BAN_DURATION_DAYS,
  type GroupJoinedUserDTO,
} from "../api/groupCommunityApi";

type GroupRemoveUserDialogProps = {
  user: GroupJoinedUserDTO | null;
  isPending: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (input: { banDurationDays: number; reason: string }) => void;
};

/**
 * Removing a joined user always bans them, so the confirm step collects how
 * long rather than only asking whether to go ahead.
 */
const GroupRemoveUserDialog = ({
  user,
  isPending,
  onOpenChange,
  onConfirm,
}: GroupRemoveUserDialogProps) => {
  const { t } = useTranslate();
  const [duration, setDuration] = useState(String(DEFAULT_BAN_DURATION_DAYS));
  const [reason, setReason] = useState("");

  // Reset between targets so a previous reason never carries to the next user.
  useEffect(() => {
    if (!user) return;
    setDuration(String(DEFAULT_BAN_DURATION_DAYS));
    setReason("");
  }, [user]);

  return (
    <Pecha.Dialog
      open={user != null}
      onOpenChange={(open) => !open && !isPending && onOpenChange(false)}
    >
      <Pecha.DialogContent>
        <Pecha.DialogHeader>
          <Pecha.DialogTitle>
            {t("studio.groups.components.remove_user.title")}
          </Pecha.DialogTitle>
        </Pecha.DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">
              {user?.fullname ||
                user?.username ||
                t("studio.groups.components.remove_user.this_user")}
            </span>{" "}
            {t("studio.groups.components.remove_user.body")}
          </p>

          <div className="space-y-2">
            <label
              htmlFor="ban-duration"
              className="text-sm font-medium leading-none"
            >
              {t("studio.groups.components.remove_user.blocked_for")}
            </label>
            <Pecha.Select
              value={duration}
              onValueChange={setDuration}
              disabled={isPending}
            >
              <Pecha.SelectTrigger id="ban-duration" className="w-full">
                <Pecha.SelectValue />
              </Pecha.SelectTrigger>
              <Pecha.SelectContent>
                {BAN_DURATION_OPTIONS.map((option) => (
                  <Pecha.SelectItem
                    key={option.value}
                    value={String(option.value)}
                  >
                    {t(
                      `studio.groups.components.remove_user.ban_duration_${option.value}`,
                    )}
                  </Pecha.SelectItem>
                ))}
              </Pecha.SelectContent>
            </Pecha.Select>
          </div>

          <div className="space-y-2">
            <label
              htmlFor="ban-reason"
              className="text-sm font-medium leading-none"
            >
              {t("studio.groups.components.remove_user.reason")}{" "}
              <span className="font-normal text-muted-foreground">
                ({t("studio.common.optional")})
              </span>
            </label>
            <Pecha.Textarea
              id="ban-reason"
              value={reason}
              maxLength={500}
              rows={3}
              placeholder={t(
                "studio.groups.components.remove_user.reason_placeholder",
              )}
              disabled={isPending}
              onChange={(event) => setReason(event.target.value)}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              onClick={() => onOpenChange(false)}
            >
              {t("studio.common.cancel")}
            </Button>
            <Button
              type="button"
              className="bg-[#A51C21] text-white hover:bg-[#A51C21]/90"
              disabled={isPending}
              onClick={() =>
                onConfirm({ banDurationDays: Number(duration), reason })
              }
            >
              {isPending
                ? t("studio.groups.components.remove_user.removing")
                : t("studio.common.remove")}
            </Button>
          </div>
        </div>
      </Pecha.DialogContent>
    </Pecha.Dialog>
  );
};

export default GroupRemoveUserDialog;
