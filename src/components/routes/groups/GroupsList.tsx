import { useNavigate } from "react-router-dom";
import { useTranslate } from "@tolgee/react";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/atoms/avatar";
import { ROUTES } from "@/routes/paths";
import {
  pickGroupTitle,
  resolveGroupAvatarUrl,
  type AuthorGroupListItem,
} from "./api/groupsApi";
import GroupStatusBadge from "./components/GroupStatusBadge";

interface GroupsListProps {
  groups: AuthorGroupListItem[];
  isLoading?: boolean;
  loadingLabel: string;
}

const Stat = ({ label, value }: { label: string; value: string | number }) => (
  <div className="min-w-0">
    <p className="text-xs text-muted-foreground">{label}</p>
    <p className="text-sm font-medium tabular-nums">{value}</p>
  </div>
);

const GroupsList = ({ groups, isLoading, loadingLabel }: GroupsListProps) => {
  const { t } = useTranslate();
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center">
        {loadingLabel}
      </p>
    );
  }

  return (
    <div className="w-full grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
      {groups.map((group) => {
        const title = pickGroupTitle(group.metadata);
        const avatarUrl = resolveGroupAvatarUrl(group);

        return (
          <button
            key={group.id}
            type="button"
            onClick={() => navigate(ROUTES.group(group.id))}
            className="text-left rounded-lg border bg-white dark:bg-[#1e1e1e] p-4 space-y-4 hover:bg-muted/40 transition-colors cursor-pointer"
          >
            <div className="flex items-start gap-3 min-w-0">
              <Avatar className="size-12 shrink-0">
                <AvatarImage src={avatarUrl ?? undefined} />
                <AvatarFallback>{title.charAt(0)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium truncate">{title}</p>
                  <GroupStatusBadge
                    status={group.status}
                    className="shrink-0"
                  />
                </div>
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  {group.is_public ? (
                    <span className="text-green-600 dark:text-green-400">
                      {t("studio.groups.pages.visibility.public")}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">
                      {t("studio.groups.pages.visibility.private")}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="border-t border-dashed border-gray-200 dark:border-input pt-3">
              {group.group_type === "COMMUNITY" ? (
                <Stat
                  label={t("studio.groups.pages.list.joiners")}
                  value={group.joiner_count ?? "—"}
                />
              ) : (
                <Stat
                  label={t("studio.groups.pages.list.followers")}
                  value={group.follower_count}
                />
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
};

export default GroupsList;
