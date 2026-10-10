import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTranslate } from "@tolgee/react";
import { Pecha } from "@/components/ui/shadimport";
import { Button } from "@/components/ui/atoms/button";
import { getApiErrorMessage } from "@/lib/apiErrors";
import { useUserInfo } from "@/hooks/useUserInfo";
import { shouldShowCmsActionsColumn } from "@/lib/platformAccess";
import {
  createGroupInvite,
  fetchGroupInvites,
  revokeGroupInvite,
  formatGroupInviteInviter,
  type AuthorGroupInviteStatus,
  type AuthorGroupMemberRole,
} from "../api/groupsApi";
import {
  canRevokeInvite,
  inviteRoleOptions,
  normalizeMemberRole,
} from "../lib/groupPermissions";
import { GroupSectionHeader } from "./GroupSection";
import GroupInviteStatusBadge from "./GroupInviteStatusBadge";
import InviteExpiryLabel from "./InviteExpiryLabel";

const STATUS_FILTER_OPTIONS: {
  value: "all" | AuthorGroupInviteStatus;
  label: string;
}[] = [
  {
    value: "all",
    label: "studio.groups.components.invites_admin.all_statuses",
  },
  { value: "PENDING", label: "studio.groups.components.status.pending" },
  { value: "ACCEPTED", label: "studio.groups.components.status.accepted" },
  { value: "REJECTED", label: "studio.groups.components.status.rejected" },
  { value: "REVOKED", label: "studio.groups.components.status.revoked" },
  { value: "EXPIRED", label: "studio.groups.components.status.expired" },
];

type GroupInvitesAdminSectionProps = {
  groupId: string;
  myRole: AuthorGroupMemberRole | undefined;
};

const GroupInvitesAdminSection = ({
  groupId,
  myRole,
}: GroupInvitesAdminSectionProps) => {
  const { t } = useTranslate();
  const { data: userInfo } = useUserInfo();
  const showActionsColumn = shouldShowCmsActionsColumn(userInfo?.platform_role);
  const inviteTableColSpan = showActionsColumn ? 6 : 5;
  const queryClient = useQueryClient();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [targetEmail, setTargetEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<AuthorGroupMemberRole>("AUTHOR");
  const [statusFilter, setStatusFilter] = useState<
    "all" | AuthorGroupInviteStatus
  >("all");

  const availableInviteRoles = useMemo(
    () => inviteRoleOptions(myRole),
    [myRole],
  );

  const statusParam = statusFilter === "all" ? undefined : statusFilter;

  const { data: invitesData, isLoading } = useQuery({
    queryKey: ["cms-group-invites", groupId, statusFilter],
    queryFn: () => fetchGroupInvites(groupId, statusParam),
    refetchOnWindowFocus: false,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["cms-group", groupId] });
    queryClient.invalidateQueries({ queryKey: ["cms-group-invites", groupId] });
    queryClient.invalidateQueries({ queryKey: ["cms-my-group-invites"] });
    queryClient.invalidateQueries({ queryKey: ["cms-notifications"] });
  };

  const inviteMutation = useMutation({
    mutationFn: () =>
      createGroupInvite(groupId, {
        target_email: targetEmail.trim(),
        role: inviteRole,
      }),
    onSuccess: () => {
      toast.success(t("studio.groups.components.invites_admin.sent_toast"));
      setInviteOpen(false);
      setTargetEmail("");
      setInviteRole(availableInviteRoles[0] ?? "AUTHOR");
      invalidate();
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  const revokeMutation = useMutation({
    mutationFn: (inviteId: string) => revokeGroupInvite(groupId, inviteId),
    onSuccess: () => {
      toast.success(t("studio.groups.components.invites_admin.revoked_toast"));
      invalidate();
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  const invites = invitesData?.invites ?? [];

  return (
    <div className="space-y-4 border-t border-dashed border-gray-300 dark:border-input pt-8">
      <GroupSectionHeader
        title={t("studio.groups.components.invites_admin.title")}
        action={
          availableInviteRoles.length > 0 ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setInviteOpen(true)}
            >
              {t("studio.groups.components.invites_admin.invite_member")}
            </Button>
          ) : undefined
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <label className="text-sm text-muted-foreground">
          {t("studio.common.status")}
        </label>
        <Pecha.Select
          value={statusFilter}
          onValueChange={(v) =>
            setStatusFilter(v as "all" | AuthorGroupInviteStatus)
          }
        >
          <Pecha.SelectTrigger className="w-40 h-8">
            <Pecha.SelectValue />
          </Pecha.SelectTrigger>
          <Pecha.SelectContent>
            {STATUS_FILTER_OPTIONS.map((opt) => (
              <Pecha.SelectItem key={opt.value} value={opt.value}>
                {t(opt.label)}
              </Pecha.SelectItem>
            ))}
          </Pecha.SelectContent>
        </Pecha.Select>
      </div>

      <div className="overflow-x-auto">
        <Pecha.Table>
          <Pecha.TableHeader>
            <Pecha.TableRow>
              <Pecha.TableHead>
                {t("studio.groups.components.members.email")}
              </Pecha.TableHead>
              <Pecha.TableHead>
                {t("studio.groups.components.members.role")}
              </Pecha.TableHead>
              <Pecha.TableHead>{t("studio.common.status")}</Pecha.TableHead>
              <Pecha.TableHead>
                {t("studio.groups.components.invites_admin.expires")}
              </Pecha.TableHead>
              <Pecha.TableHead>
                {t("studio.groups.components.invites_admin.invited_by")}
              </Pecha.TableHead>
              {showActionsColumn ? (
                <Pecha.TableHead className="text-right">
                  {t("studio.common.actions")}
                </Pecha.TableHead>
              ) : null}
            </Pecha.TableRow>
          </Pecha.TableHeader>
          <Pecha.TableBody>
            {isLoading ? (
              <Pecha.TableRow>
                <Pecha.TableCell
                  colSpan={inviteTableColSpan}
                  className="text-muted-foreground"
                >
                  {t("studio.groups.components.invites_admin.loading")}
                </Pecha.TableCell>
              </Pecha.TableRow>
            ) : invites.length === 0 ? (
              <Pecha.TableRow>
                <Pecha.TableCell
                  colSpan={inviteTableColSpan}
                  className="text-muted-foreground"
                >
                  {t("studio.groups.components.invites_admin.empty")}
                </Pecha.TableCell>
              </Pecha.TableRow>
            ) : (
              invites.map((invite) => (
                <Pecha.TableRow key={invite.id}>
                  <Pecha.TableCell>{invite.target_email}</Pecha.TableCell>
                  <Pecha.TableCell>
                    {t(
                      `studio.groups.components.role.${normalizeMemberRole(invite.role).toLowerCase()}`,
                    )}
                  </Pecha.TableCell>
                  <Pecha.TableCell>
                    <GroupInviteStatusBadge status={invite.status} />
                  </Pecha.TableCell>
                  <Pecha.TableCell>
                    <InviteExpiryLabel invite={invite} />
                  </Pecha.TableCell>
                  <Pecha.TableCell className="text-muted-foreground text-sm">
                    {(() => {
                      const inviter = formatGroupInviteInviter(invite);
                      return inviter.name.toLowerCase() !==
                        inviter.email.toLowerCase()
                        ? `${inviter.name} (${inviter.email})`
                        : inviter.email;
                    })()}
                  </Pecha.TableCell>
                  {showActionsColumn ? (
                    <Pecha.TableCell className="text-right">
                      {invite.status === "PENDING" &&
                        canRevokeInvite(myRole, invite) && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-red-600 hover:text-red-700"
                            disabled={revokeMutation.isPending}
                            onClick={() => revokeMutation.mutate(invite.id)}
                          >
                            {t("studio.groups.components.invites_admin.revoke")}
                          </Button>
                        )}
                    </Pecha.TableCell>
                  ) : null}
                </Pecha.TableRow>
              ))
            )}
          </Pecha.TableBody>
        </Pecha.Table>
      </div>

      <Pecha.Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <Pecha.DialogContent>
          <Pecha.DialogHeader>
            <Pecha.DialogTitle>
              {t("studio.groups.components.invites_admin.invite_member")}
            </Pecha.DialogTitle>
          </Pecha.DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {t("studio.groups.components.invites_admin.dialog_description")}
            </p>
            <div className="space-y-2">
              <label className="text-sm font-medium">
                {t("studio.groups.components.members.email")}
              </label>
              <Pecha.Input
                type="email"
                value={targetEmail}
                onChange={(e) => setTargetEmail(e.target.value)}
                placeholder={t(
                  "studio.groups.components.invites_admin.email_placeholder",
                )}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">
                {t("studio.groups.components.members.role")}
              </label>
              <Pecha.Select
                value={inviteRole}
                onValueChange={(v) => setInviteRole(v as AuthorGroupMemberRole)}
              >
                <Pecha.SelectTrigger>
                  <Pecha.SelectValue />
                </Pecha.SelectTrigger>
                <Pecha.SelectContent>
                  {availableInviteRoles.map((role) => (
                    <Pecha.SelectItem key={role} value={role}>
                      {t(`studio.groups.components.role.${role.toLowerCase()}`)}
                    </Pecha.SelectItem>
                  ))}
                </Pecha.SelectContent>
              </Pecha.Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setInviteOpen(false)}
              >
                {t("studio.common.cancel")}
              </Button>
              <Button
                type="button"
                disabled={!targetEmail.trim() || inviteMutation.isPending}
                onClick={() => inviteMutation.mutate()}
              >
                {inviteMutation.isPending
                  ? t("studio.groups.components.invites_admin.sending")
                  : t("studio.groups.components.invites_admin.send_invite")}
              </Button>
            </div>
          </div>
        </Pecha.DialogContent>
      </Pecha.Dialog>
    </div>
  );
};

export default GroupInvitesAdminSection;
