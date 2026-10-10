import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { IoClose } from "react-icons/io5";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useTranslate } from "@tolgee/react";
import { Button } from "@/components/ui/atoms/button";
import { getApiErrorMessage } from "@/lib/apiErrors";
import { ROUTES } from "@/routes/paths";
import {
  acceptGroupInvite,
  rejectGroupInvite,
} from "@/components/routes/groups/api/groupsApi";
import {
  acceptTransferRequest,
  rejectTransferRequest,
} from "@/components/routes/content-transfer/api/transferApi";
import {
  fetchNotifications,
  getJoinRequestNotificationGroupId,
  getTransferNotificationTargetGroupId,
  isContentTransferNotification,
  isGroupInviteNotification,
  isGroupJoinRequestNotification,
  markNotificationRead,
  type NotificationDTO,
} from "@/components/routes/notifications/api/notificationsApi";

interface NotificationsPanelProps {
  onRequestClose?: () => void;
  /** Show the "Notifications" header row (default true). */
  showHeader?: boolean;
}

export function useUnreadNotifications() {
  return useQuery({
    queryKey: ["cms-notifications", { unread_only: true }],
    queryFn: () => fetchNotifications({ unread_only: true, limit: 30 }),
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });
}

export function NotificationsPanel({
  onRequestClose,
  showHeader = true,
}: NotificationsPanelProps) {
  const { t } = useTranslate();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data, isLoading } = useUnreadNotifications();

  const invalidateNotifications = () => {
    queryClient.invalidateQueries({ queryKey: ["cms-notifications"] });
    queryClient.invalidateQueries({ queryKey: ["cms-my-group-invites"] });
    queryClient.invalidateQueries({ queryKey: ["cms-groups"] });
  };

  const dismissMutation = useMutation({
    mutationFn: (notificationId: string) =>
      markNotificationRead(notificationId),
    onSuccess: () => invalidateNotifications(),
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  const inviteActionMutation = useMutation({
    mutationFn: async ({
      inviteId,
      action,
    }: {
      inviteId: string;
      action: "accept" | "reject";
    }) => {
      if (action === "accept") {
        return acceptGroupInvite(inviteId);
      }
      await rejectGroupInvite(inviteId);
      return null;
    },
    onSuccess: (group, { action }) => {
      if (action === "accept") {
        toast.success(t("studio.notifications.invitation_accepted"));
        onRequestClose?.();
        if (group) {
          navigate(ROUTES.group(group.id));
        }
      } else {
        toast.success(t("studio.notifications.invitation_declined"));
      }
      invalidateNotifications();
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  const handleInviteAction = (
    notification: NotificationDTO,
    action: "accept" | "reject",
  ) => {
    const inviteId = notification.reference_id;
    if (!inviteId) {
      toast.error(t("studio.notifications.invalid_invitation"));
      return;
    }
    inviteActionMutation.mutate({ inviteId, action });
  };

  const transferActionMutation = useMutation({
    mutationFn: async ({
      requestId,
      action,
    }: {
      requestId: string;
      action: "accept" | "reject";
    }) => {
      if (action === "accept") {
        return acceptTransferRequest(requestId);
      }
      await rejectTransferRequest(requestId);
      return null;
    },
    onSuccess: (_data, { action }) => {
      toast.success(
        action === "accept"
          ? t("studio.notifications.transfer_accepted")
          : t("studio.notifications.transfer_rejected"),
      );
      invalidateNotifications();
      queryClient.invalidateQueries({ queryKey: ["transfer-requests"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-items"] });
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  const handleTransferAction = (
    notification: NotificationDTO,
    action: "accept" | "reject",
  ) => {
    const requestId = notification.reference_id;
    if (!requestId) {
      toast.error(t("studio.notifications.invalid_transfer"));
      return;
    }
    transferActionMutation.mutate({ requestId, action });
  };

  const invitePending =
    inviteActionMutation.isPending || transferActionMutation.isPending;

  return (
    <div className="w-80 max-h-[min(24rem,70vh)] overflow-auto">
      {showHeader ? (
        <div className="border-b px-3 py-2 font-medium text-sm">
          {t("studio.notifications.title")}
        </div>
      ) : null}
      {isLoading ? (
        <p className="px-3 py-4 text-sm text-muted-foreground">
          {t("studio.common.loading")}
        </p>
      ) : !data?.notifications.length ? (
        <p className="px-3 py-4 text-sm text-muted-foreground">
          {t("studio.notifications.no_unread")}
        </p>
      ) : (
        <ul className="divide-y">
          {data.notifications.map((notification) => (
            <li key={notification.id} className="relative px-3 py-3 pr-9">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute top-2 right-1 h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                aria-label={t("studio.notifications.dismiss")}
                disabled={invitePending || dismissMutation.isPending}
                onClick={() => dismissMutation.mutate(notification.id)}
              >
                <IoClose className="h-4 w-4" />
              </Button>
              <div className="space-y-2">
                <p className="text-sm font-medium leading-snug pr-1">
                  {notification.title}
                </p>
                {notification.description && (
                  <p className="text-xs text-muted-foreground">
                    {notification.description}
                  </p>
                )}
                {isGroupInviteNotification(notification) && (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      className="bg-[#A51C21] text-white hover:bg-[#A51C21]/90 h-7 text-xs"
                      disabled={invitePending}
                      onClick={() => handleInviteAction(notification, "accept")}
                    >
                      {inviteActionMutation.isPending &&
                      inviteActionMutation.variables?.action === "accept"
                        ? t("studio.notifications.accepting")
                        : t("studio.notifications.accept")}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      disabled={invitePending}
                      onClick={() => handleInviteAction(notification, "reject")}
                    >
                      {inviteActionMutation.isPending &&
                      inviteActionMutation.variables?.action === "reject"
                        ? t("studio.notifications.declining")
                        : t("studio.notifications.reject")}
                    </Button>
                  </div>
                )}
                {isGroupJoinRequestNotification(notification) &&
                getJoinRequestNotificationGroupId(notification) ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="link"
                    className="h-auto p-0 text-xs text-[#A51C21]"
                    onClick={() => {
                      onRequestClose?.();
                      navigate(
                        ROUTES.groupJoinRequests(
                          getJoinRequestNotificationGroupId(notification)!,
                        ),
                      );
                    }}
                  >
                    {t("studio.notifications.review_request")}
                  </Button>
                ) : null}
                {isContentTransferNotification(notification) && (
                  <div className="flex flex-col gap-2">
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        className="bg-[#A51C21] text-white hover:bg-[#A51C21]/90 h-7 text-xs"
                        disabled={invitePending}
                        onClick={() =>
                          handleTransferAction(notification, "accept")
                        }
                      >
                        {t("studio.notifications.accept")}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        disabled={invitePending}
                        onClick={() =>
                          handleTransferAction(notification, "reject")
                        }
                      >
                        {t("studio.notifications.reject")}
                      </Button>
                    </div>
                    {getTransferNotificationTargetGroupId(notification) ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="link"
                        className="h-auto p-0 text-xs text-[#A51C21]"
                        onClick={() => {
                          onRequestClose?.();
                          navigate(
                            ROUTES.groupTransfers(
                              getTransferNotificationTargetGroupId(
                                notification,
                              )!,
                            ),
                          );
                        }}
                      >
                        {t("studio.notifications.view_on_group_page")}
                      </Button>
                    ) : null}
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
