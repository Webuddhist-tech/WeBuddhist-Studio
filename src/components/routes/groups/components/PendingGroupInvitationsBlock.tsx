import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslate } from "@tolgee/react";
import { Pecha } from "@/components/ui/shadimport";
import {
  fetchMyPendingGroupInvites,
  formatGroupInviteInviter,
} from "../api/groupsApi";
import GroupInviteRespondButtons from "./GroupInviteRespondButtons";
import InviteExpiryLabel from "./InviteExpiryLabel";

const PendingGroupInvitationsBlock = () => {
  const { t } = useTranslate();
  const [dismissed, setDismissed] = useState(false);

  const { data: invitesData, isLoading } = useQuery({
    queryKey: ["cms-my-group-invites"],
    queryFn: fetchMyPendingGroupInvites,
    refetchOnWindowFocus: true,
  });

  const invites = invitesData?.invites ?? [];
  const open = !isLoading && invites.length > 0 && !dismissed;

  if (isLoading || invites.length === 0) return null;

  return (
    <Pecha.Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setDismissed(true);
      }}
    >
      <Pecha.DialogContent className="max-w-md gap-0 p-0 overflow-hidden">
        <div className="flex items-start justify-between gap-3 border-b px-4 py-3">
          <div className="min-w-0">
            <Pecha.DialogHeader className="space-y-1 p-0 text-left">
              <Pecha.DialogTitle>
                {t("studio.groups.components.pending_invites.title")}
              </Pecha.DialogTitle>
            </Pecha.DialogHeader>
            <p className="text-sm text-muted-foreground mt-1">
              {invites.length === 1
                ? t("studio.groups.components.pending_invites.count_one")
                : t("studio.groups.components.pending_invites.count_other", {
                    count: invites.length,
                  })}
            </p>
          </div>
        </div>

        <ul className="max-h-[min(20rem,60vh)] overflow-y-auto divide-y">
          {invites.map((invite) => {
            const inviter = formatGroupInviteInviter(invite);
            return (
              <li key={invite.id} className="px-4 py-4 space-y-3">
                <div>
                  <p className="font-medium leading-snug">
                    {invite.group_name?.trim() ||
                      t("studio.groups.components.untitled_group")}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t("studio.groups.components.pending_invites.invited_by", {
                      name: inviter.name,
                    })}
                    {inviter.name.toLowerCase() !==
                      inviter.email.toLowerCase() && (
                      <>
                        <span className="mx-1">·</span>
                        {inviter.email}
                      </>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t("studio.groups.components.pending_invites.role", {
                      role: t(
                        `studio.groups.components.role.${invite.role.toLowerCase()}`,
                      ),
                    })}
                    <span className="mx-1.5">·</span>
                    <InviteExpiryLabel invite={invite} />
                  </p>
                </div>
                <GroupInviteRespondButtons invite={invite} align="start" />
              </li>
            );
          })}
        </ul>
      </Pecha.DialogContent>
    </Pecha.Dialog>
  );
};

export default PendingGroupInvitationsBlock;
