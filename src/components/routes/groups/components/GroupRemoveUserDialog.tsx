import { useEffect, useState } from "react";
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
          <Pecha.DialogTitle>Remove from group?</Pecha.DialogTitle>
        </Pecha.DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">
              {user?.fullname || user?.username || "This user"}
            </span>{" "}
            will be removed from the group and blocked from rejoining until the
            ban ends. You can lift it early from the Banned list.
          </p>

          <div className="space-y-2">
            <label
              htmlFor="ban-duration"
              className="text-sm font-medium leading-none"
            >
              Blocked for
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
                    {option.label}
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
              Reason{" "}
              <span className="font-normal text-muted-foreground">
                (optional)
              </span>
            </label>
            <Pecha.Textarea
              id="ban-reason"
              value={reason}
              maxLength={500}
              rows={3}
              placeholder="Visible to other moderators of this group."
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
              Cancel
            </Button>
            <Button
              type="button"
              className="bg-[#A51C21] text-white hover:bg-[#A51C21]/90"
              disabled={isPending}
              onClick={() =>
                onConfirm({ banDurationDays: Number(duration), reason })
              }
            >
              {isPending ? "Removing…" : "Remove"}
            </Button>
          </div>
        </div>
      </Pecha.DialogContent>
    </Pecha.Dialog>
  );
};

export default GroupRemoveUserDialog;
