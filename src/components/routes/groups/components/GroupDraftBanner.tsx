import { IoEyeOffSharp } from "react-icons/io5";
import {
  isGroupVisibleInApp,
  type AuthorGroupDetailDTO,
} from "../api/groupsApi";
import { useTranslate } from "@tolgee/react";
import GroupPublishControl from "./GroupPublishControl";

type GroupDraftBannerProps = {
  group: AuthorGroupDetailDTO;
  canPublish: boolean;
};

const GroupDraftBanner = ({ group, canPublish }: GroupDraftBannerProps) => {
  const { t } = useTranslate();
  if (isGroupVisibleInApp(group.status) || !group.status) return null;

  const isDraft = group.status === "DRAFT";

  return (
    <div className="flex flex-wrap items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800/60 dark:bg-amber-950/40">
      <IoEyeOffSharp
        className="mt-0.5 h-5 w-5 shrink-0 text-amber-700 dark:text-amber-300"
        aria-hidden
      />
      <div className="min-w-0 flex-1 space-y-1">
        <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
          {isDraft
            ? t("studio.groups.components.draft_banner.draft_notice")
            : t("studio.groups.components.draft_banner.hidden_notice")}
        </p>
        <p className="text-sm text-amber-800 dark:text-amber-200/90">
          {canPublish
            ? t("studio.groups.components.draft_banner.publish_hint")
            : t("studio.groups.components.draft_banner.ask_admin_hint")}
        </p>
      </div>
      {canPublish ? (
        <GroupPublishControl
          group={group}
          variant="default"
          className="shrink-0"
        />
      ) : null}
    </div>
  );
};

export default GroupDraftBanner;
