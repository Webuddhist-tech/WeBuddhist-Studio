import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useTranslate } from "@tolgee/react";
import { Button } from "@/components/ui/atoms/button";
import { getApiErrorMessage } from "@/lib/apiErrors";
import { ROUTES } from "@/routes/paths";
import {
  acceptGroupInvite,
  isGroupInviteExpired,
  rejectGroupInvite,
  type GroupInviteDTO,
} from "../api/groupsApi";

type GroupInviteRespondButtonsProps = {
  invite: GroupInviteDTO;
  size?: "sm" | "default";
  align?: "start" | "center";
  onSettled?: () => void;
};

const GroupInviteRespondButtons = ({
  invite,
  size = "sm",
  align = "center",
  onSettled,
}: GroupInviteRespondButtonsProps) => {
  const { t } = useTranslate();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const expired = isGroupInviteExpired(invite);
  const disabled = expired || invite.status !== "PENDING";

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["cms-my-group-invites"] });
    queryClient.invalidateQueries({ queryKey: ["cms-notifications"] });
    queryClient.invalidateQueries({ queryKey: ["cms-groups"] });
    queryClient.invalidateQueries({
      queryKey: ["cms-group", invite.group_id],
    });
    queryClient.invalidateQueries({
      queryKey: ["cms-group-invites", invite.group_id],
    });
  };

  const acceptMutation = useMutation({
    mutationFn: () => acceptGroupInvite(invite.id),
    onSuccess: (group) => {
      toast.success(t("studio.groups.components.invite.accepted_toast"));
      invalidate();
      onSettled?.();
      navigate(ROUTES.group(group.id));
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  const rejectMutation = useMutation({
    mutationFn: () => rejectGroupInvite(invite.id),
    onSuccess: () => {
      toast.success(t("studio.groups.components.invite.declined_toast"));
      invalidate();
      onSettled?.();
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  const pending = acceptMutation.isPending || rejectMutation.isPending;

  return (
    <div
      className={`flex flex-wrap gap-2 ${align === "center" ? "justify-center" : "justify-start"}`}
    >
      <Button
        type="button"
        size={size}
        className="bg-[#A51C21] text-white hover:bg-[#A51C21]/90"
        disabled={disabled || pending}
        onClick={() => acceptMutation.mutate()}
      >
        {acceptMutation.isPending
          ? t("studio.groups.components.invite.accepting")
          : t("studio.groups.components.invite.accept")}
      </Button>
      <Button
        type="button"
        size={size}
        variant="outline"
        disabled={disabled || pending}
        onClick={() => rejectMutation.mutate()}
      >
        {rejectMutation.isPending
          ? t("studio.groups.components.invite.declining")
          : t("studio.groups.components.invite.reject")}
      </Button>
    </div>
  );
};

export default GroupInviteRespondButtons;
