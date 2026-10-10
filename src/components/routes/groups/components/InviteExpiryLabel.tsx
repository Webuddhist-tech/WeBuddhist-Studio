import { useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { useTranslate } from "@tolgee/react";
import type { GroupInviteDTO } from "../api/groupsApi";
import { isGroupInviteExpired } from "../api/groupsApi";

type InviteExpiryLabelProps = {
  invite: GroupInviteDTO;
};

const InviteExpiryLabel = ({ invite }: InviteExpiryLabelProps) => {
  const { t } = useTranslate();
  const [, setTick] = useState(0);

  useEffect(() => {
    if (isGroupInviteExpired(invite)) return;
    const id = window.setInterval(() => setTick((t) => t + 1), 30_000);
    return () => window.clearInterval(id);
  }, [invite.expires_at, invite.status]);

  if (isGroupInviteExpired(invite)) {
    return (
      <span className="text-muted-foreground">
        {t("studio.groups.components.status.expired")}
      </span>
    );
  }

  return (
    <span className="text-muted-foreground">
      {t("studio.groups.components.invite.time_left", {
        time: formatDistanceToNow(new Date(invite.expires_at), {
          addSuffix: false,
        }),
      })}
    </span>
  );
};

export default InviteExpiryLabel;
