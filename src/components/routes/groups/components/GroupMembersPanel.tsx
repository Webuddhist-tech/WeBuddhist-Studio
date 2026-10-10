import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useTranslate } from "@tolgee/react";
import { Pecha } from "@/components/ui/shadimport";
import { Button } from "@/components/ui/atoms/button";
import { getApiErrorMessage } from "@/lib/apiErrors";
import { useUserInfo } from "@/hooks/useUserInfo";
import { isReviewer, shouldShowCmsActionsColumn } from "@/lib/platformAccess";
import {
  removeGroupMember,
  updateGroupMemberRole,
  type AuthorGroupMemberDTO,
  type AuthorGroupMemberRole,
  type AuthorGroupType,
} from "../api/groupsApi";
import { groupKindOf } from "../lib/groupKind";
import {
  canManageGroupInvites,
  canShowMemberRemovalAction,
  canTransferOwnership,
  getEffectiveGroupRole,
  isCurrentGroupMember,
  normalizeMemberRole,
  roleChangeOptions,
  transferOwnershipCandidates,
} from "../lib/groupPermissions";
import GroupInvitesAdminSection from "./GroupInvitesAdminSection";
import { GroupSectionHeader } from "./GroupSection";
import GroupTransferOwnershipDialog from "./GroupTransferOwnershipDialog";

type GroupMembersPanelProps = {
  groupId: string;
  groupType?: AuthorGroupType;
  members: AuthorGroupMemberDTO[];
};

const GroupMembersPanel = ({
  groupId,
  groupType,
  members,
}: GroupMembersPanelProps) => {
  const { t } = useTranslate();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { data: userInfo } = useUserInfo();
  const actor = userInfo
    ? {
        id: userInfo.id,
        email: userInfo.email,
        platform_role: userInfo.platform_role,
      }
    : undefined;
  const myRole = getEffectiveGroupRole(members, actor);
  const platformReadOnly = isReviewer(userInfo?.platform_role);
  const showActionsColumn = shouldShowCmsActionsColumn(userInfo?.platform_role);
  const [removeTarget, setRemoveTarget] = useState<AuthorGroupMemberDTO | null>(
    null,
  );
  const [transferOpen, setTransferOpen] = useState(false);

  const showTransferOwnership =
    !platformReadOnly && canTransferOwnership(members, actor);
  const showInvitesSection = !platformReadOnly && canManageGroupInvites(myRole);
  const transferCandidates = transferOwnershipCandidates(members, actor);

  const leavingSelf =
    removeTarget != null && isCurrentGroupMember(removeTarget, actor);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["cms-group", groupId] });
  };

  const roleMutation = useMutation({
    mutationFn: ({
      authorId,
      role,
    }: {
      authorId: string;
      role: AuthorGroupMemberRole;
    }) => updateGroupMemberRole(groupId, authorId, { role }),
    onSuccess: () => {
      toast.success(t("studio.groups.components.members.role_updated_toast"));
      invalidate();
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  const removeMutation = useMutation({
    mutationFn: ({ authorId }: { authorId: string; isSelf: boolean }) =>
      removeGroupMember(groupId, authorId),
    onSuccess: (_data, { isSelf }) => {
      setRemoveTarget(null);
      if (isSelf) {
        toast.success(t("studio.groups.components.members.left_toast"));
        queryClient.invalidateQueries({ queryKey: ["cms-groups"] });
        navigate(groupKindOf(groupType).listPath);
        return;
      }
      toast.success(t("studio.groups.components.members.removed_toast"));
      invalidate();
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <GroupSectionHeader
          title={t("studio.groups.components.members.title_count", {
            count: members.length,
          })}
          action={
            showTransferOwnership ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setTransferOpen(true)}
              >
                {t("studio.groups.components.transfer.title")}
              </Button>
            ) : undefined
          }
        />

        <div className="overflow-x-auto">
          <Pecha.Table>
            <Pecha.TableHeader>
              <Pecha.TableRow>
                <Pecha.TableHead>{t("studio.common.name")}</Pecha.TableHead>
                <Pecha.TableHead>
                  {t("studio.groups.components.members.email")}
                </Pecha.TableHead>
                <Pecha.TableHead>
                  {t("studio.groups.components.members.role")}
                </Pecha.TableHead>
                {showActionsColumn ? (
                  <Pecha.TableHead className="text-right">
                    {t("studio.common.actions")}
                  </Pecha.TableHead>
                ) : null}
              </Pecha.TableRow>
            </Pecha.TableHeader>
            <Pecha.TableBody>
              {members.map((member) => {
                const isSelf = isCurrentGroupMember(member, actor);
                const displayRole = normalizeMemberRole(member.role);
                const assignableRoles = roleChangeOptions(
                  myRole,
                  member,
                  actor,
                );
                const showRemoval = canShowMemberRemovalAction(
                  members,
                  myRole,
                  member,
                  actor,
                );

                return (
                  <Pecha.TableRow key={member.author_id}>
                    <Pecha.TableCell>
                      {member.firstname} {member.lastname}
                    </Pecha.TableCell>
                    <Pecha.TableCell className="text-muted-foreground">
                      {member.email}
                    </Pecha.TableCell>
                    <Pecha.TableCell>
                      {assignableRoles && !platformReadOnly ? (
                        <Pecha.Select
                          value={displayRole}
                          onValueChange={(role) =>
                            roleMutation.mutate({
                              authorId: member.author_id,
                              role: role as AuthorGroupMemberRole,
                            })
                          }
                          disabled={roleMutation.isPending}
                        >
                          <Pecha.SelectTrigger className="w-32 h-8">
                            <Pecha.SelectValue />
                          </Pecha.SelectTrigger>
                          <Pecha.SelectContent>
                            {assignableRoles.map((role) => (
                              <Pecha.SelectItem key={role} value={role}>
                                {t(
                                  `studio.groups.components.role.${role.toLowerCase()}`,
                                )}
                              </Pecha.SelectItem>
                            ))}
                          </Pecha.SelectContent>
                        </Pecha.Select>
                      ) : (
                        <span className="text-sm">
                          {t(
                            `studio.groups.components.role.${displayRole.toLowerCase()}`,
                          )}
                        </span>
                      )}
                    </Pecha.TableCell>
                    {showActionsColumn ? (
                      <Pecha.TableCell className="text-right">
                        {showRemoval && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-red-600 hover:text-red-700"
                            onClick={() => setRemoveTarget(member)}
                          >
                            {isSelf
                              ? t("studio.groups.components.members.leave")
                              : t("studio.common.remove")}
                          </Button>
                        )}
                      </Pecha.TableCell>
                    ) : null}
                  </Pecha.TableRow>
                );
              })}
            </Pecha.TableBody>
          </Pecha.Table>
        </div>
      </div>

      {showInvitesSection ? (
        <GroupInvitesAdminSection groupId={groupId} myRole={myRole} />
      ) : null}

      {showTransferOwnership && (
        <GroupTransferOwnershipDialog
          groupId={groupId}
          open={transferOpen}
          onOpenChange={setTransferOpen}
          candidates={transferCandidates}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ["cms-groups"] });
            invalidate();
          }}
        />
      )}

      <Pecha.AlertDialog
        open={!!removeTarget}
        onOpenChange={(open) => !open && setRemoveTarget(null)}
      >
        <Pecha.AlertDialogContent>
          <Pecha.AlertDialogHeader>
            <Pecha.AlertDialogTitle>
              {leavingSelf
                ? t("studio.groups.components.members.leave_title")
                : t("studio.groups.components.members.remove_title")}
            </Pecha.AlertDialogTitle>
            <Pecha.AlertDialogDescription>
              {leavingSelf
                ? t("studio.groups.components.members.leave_description")
                : t("studio.groups.components.members.remove_description", {
                    name: `${removeTarget?.firstname} ${removeTarget?.lastname}`,
                  })}
            </Pecha.AlertDialogDescription>
          </Pecha.AlertDialogHeader>
          <Pecha.AlertDialogFooter>
            <Pecha.AlertDialogCancel disabled={removeMutation.isPending}>
              {t("studio.common.cancel")}
            </Pecha.AlertDialogCancel>
            <Pecha.AlertDialogAction
              className="bg-[#AD1B21] dark:text-white hover:bg-[#AD1B21]/90"
              disabled={removeMutation.isPending}
              onClick={() =>
                removeTarget &&
                removeMutation.mutate({
                  authorId: removeTarget.author_id,
                  isSelf: leavingSelf,
                })
              }
            >
              {removeMutation.isPending
                ? leavingSelf
                  ? t("studio.groups.components.members.leaving")
                  : t("studio.groups.components.remove_user.removing")
                : leavingSelf
                  ? t("studio.groups.components.members.leave")
                  : t("studio.common.remove")}
            </Pecha.AlertDialogAction>
          </Pecha.AlertDialogFooter>
        </Pecha.AlertDialogContent>
      </Pecha.AlertDialog>
    </div>
  );
};

export default GroupMembersPanel;
