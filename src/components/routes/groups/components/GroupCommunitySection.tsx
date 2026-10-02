import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { Pecha } from "@/components/ui/shadimport";
import { Button } from "@/components/ui/atoms/button";
import { Pagination } from "@/components/ui/molecules/pagination/Pagination";
import { getApiErrorMessage } from "@/lib/apiErrors";
import { useUserInfo } from "@/hooks/useUserInfo";
import { shouldShowCmsActionsColumn } from "@/lib/platformAccess";
import {
  fetchGroupBans,
  fetchGroupJoinedUsers,
  isBanAlreadyResolvedError,
  liftGroupBan,
  removeGroupJoinedUser,
  type GroupBanDTO,
  type GroupJoinedUserDTO,
} from "../api/groupCommunityApi";
import { GroupSectionHeader } from "./GroupSection";
import GroupRemoveUserDialog from "./GroupRemoveUserDialog";

const PAGE_SIZE = 20;

type Tab = "joined" | "banned";

const relativeTime = (value: string): string => {
  try {
    return formatDistanceToNow(new Date(value), { addSuffix: true });
  } catch {
    return value.slice(0, 10);
  }
};

const exactTime = (value: string): string => {
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
};

/** "in 6 days" reads better than a date for a ban that is still running. */
const banEndsIn = (value: string): string => {
  try {
    return formatDistanceToNow(new Date(value), { addSuffix: true });
  } catch {
    return value.slice(0, 10);
  }
};

const nameInitial = (name: string): string =>
  name.trim().charAt(0).toUpperCase() || "?";

const displayName = (person: { fullname: string; username?: string | null }) =>
  person.fullname.trim() || person.username?.trim() || "Unknown user";

type GroupCommunitySectionProps = {
  groupId: string;
};

const GroupCommunitySection = ({ groupId }: GroupCommunitySectionProps) => {
  const queryClient = useQueryClient();
  const { data: userInfo } = useUserInfo();
  const showActions = shouldShowCmsActionsColumn(userInfo?.platform_role);

  const [tab, setTab] = useState<Tab>("joined");
  const [page, setPage] = useState(1);
  const [removeTarget, setRemoveTarget] = useState<GroupJoinedUserDTO | null>(
    null,
  );
  /** Keyed by ban id so overlapping lifts each track their own row. */
  const [liftingIds, setLiftingIds] = useState<Record<string, true>>({});

  const joinedQuery = useQuery({
    queryKey: ["cms-group-joined-users", groupId, page],
    queryFn: () =>
      fetchGroupJoinedUsers(groupId, {
        skip: (page - 1) * PAGE_SIZE,
        limit: PAGE_SIZE,
      }),
    enabled: Boolean(groupId) && tab === "joined",
    refetchOnWindowFocus: false,
  });

  const bansQuery = useQuery({
    queryKey: ["cms-group-bans", groupId, page],
    queryFn: () =>
      fetchGroupBans(groupId, {
        skip: (page - 1) * PAGE_SIZE,
        limit: PAGE_SIZE,
        activeOnly: true,
      }),
    enabled: Boolean(groupId) && tab === "banned",
    refetchOnWindowFocus: false,
  });

  const activeQuery = tab === "joined" ? joinedQuery : bansQuery;
  const total =
    tab === "joined"
      ? (joinedQuery.data?.total ?? 0)
      : (bansQuery.data?.total ?? 0);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Removing the last row on a trailing page shrinks the list past the current
  // offset; step back so the view never strands on an empty page.
  useEffect(() => {
    if (activeQuery.status !== "success") return;
    if (page > totalPages && totalPages > 0) setPage(totalPages);
  }, [activeQuery.status, page, totalPages]);

  const invalidate = () => {
    queryClient.invalidateQueries({
      queryKey: ["cms-group-joined-users", groupId],
    });
    queryClient.invalidateQueries({ queryKey: ["cms-group-bans", groupId] });
    // The joiner count on the group detail is now stale.
    queryClient.invalidateQueries({ queryKey: ["cms-group", groupId] });
  };

  const removeMutation = useMutation({
    mutationFn: ({
      userId,
      banDurationDays,
      reason,
    }: {
      userId: string;
      banDurationDays: number;
      reason: string;
      userName: string;
    }) =>
      removeGroupJoinedUser(groupId, userId, {
        ban_duration_days: banDurationDays,
        reason,
      }),
    onSuccess: (ban, { userName }) => {
      setRemoveTarget(null);
      toast.success(
        `${userName} removed — blocked ${banEndsIn(ban.expires_at)}`,
      );
      invalidate();
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  const liftMutation = useMutation({
    mutationFn: ({ banId }: { banId: string; userName: string }) =>
      liftGroupBan(groupId, banId),
    onMutate: ({ banId }) =>
      setLiftingIds((current) => ({ ...current, [banId]: true })),
    onSuccess: (_data, { userName }) => {
      toast.success(`${userName} can rejoin this group`);
      invalidate();
    },
    onError: (err) => {
      if (isBanAlreadyResolvedError(err)) {
        toast.error("This ban was already lifted or has expired.");
        invalidate();
        return;
      }
      toast.error(getApiErrorMessage(err));
    },
    onSettled: (_data, _err, { banId }) =>
      setLiftingIds((current) => {
        const next = { ...current };
        delete next[banId];
        return next;
      }),
  });

  const handleTabChange = (next: Tab) => {
    setTab(next);
    setPage(1);
  };

  const renderJoinedUser = (user: GroupJoinedUserDTO) => {
    const name = displayName(user);
    const isRemoving =
      removeMutation.isPending && removeTarget?.user_id === user.user_id;

    return (
      <li
        key={user.user_id}
        className="flex items-center gap-2.5 px-1 py-2.5 transition-opacity sm:gap-3 sm:px-2 data-[busy=true]:opacity-60"
        data-busy={isRemoving}
      >
        <Pecha.Avatar className="size-9 shrink-0 ring-1 ring-border">
          <Pecha.AvatarImage src={user.avatar_url ?? undefined} alt="" />
          <Pecha.AvatarFallback className="bg-muted font-medium text-muted-foreground">
            {nameInitial(name)}
          </Pecha.AvatarFallback>
        </Pecha.Avatar>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{name}</p>
          {user.joined_at ? (
            <time
              dateTime={user.joined_at}
              title={exactTime(user.joined_at)}
              className="text-xs text-muted-foreground"
            >
              Joined {relativeTime(user.joined_at)}
            </time>
          ) : null}
        </div>

        {showActions ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="shrink-0 text-red-600 hover:text-red-700"
            disabled={removeMutation.isPending}
            onClick={() => setRemoveTarget(user)}
          >
            Remove
          </Button>
        ) : null}
      </li>
    );
  };

  const renderBan = (ban: GroupBanDTO) => {
    const name = displayName(ban);
    const isLifting = Boolean(liftingIds[ban.id]);
    const reason = ban.reason?.trim();

    return (
      <li
        key={ban.id}
        className="flex gap-2.5 px-1 py-2.5 transition-opacity sm:gap-3 sm:px-2 data-[busy=true]:opacity-60"
        data-busy={isLifting}
      >
        <Pecha.Avatar className="size-9 shrink-0 ring-1 ring-border">
          <Pecha.AvatarImage src={ban.avatar_url ?? undefined} alt="" />
          <Pecha.AvatarFallback className="bg-muted font-medium text-muted-foreground">
            {nameInitial(name)}
          </Pecha.AvatarFallback>
        </Pecha.Avatar>

        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-sm leading-snug">
            <span className="font-semibold">{name}</span>
            <span className="text-muted-foreground"> · removed </span>
            <time
              dateTime={ban.created_at}
              title={exactTime(ban.created_at)}
              className="whitespace-nowrap text-muted-foreground"
            >
              {relativeTime(ban.created_at)}
            </time>
          </p>
          <p className="text-xs text-muted-foreground">
            Can rejoin{" "}
            <time dateTime={ban.expires_at} title={exactTime(ban.expires_at)}>
              {banEndsIn(ban.expires_at)}
            </time>
          </p>
          {reason ? (
            <p className="text-sm break-words text-foreground/90">{reason}</p>
          ) : null}
        </div>

        {showActions ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 shrink-0"
            disabled={isLifting}
            onClick={() =>
              liftMutation.mutate({ banId: ban.id, userName: name })
            }
          >
            {isLifting ? "Lifting…" : "Lift ban"}
          </Button>
        ) : null}
      </li>
    );
  };

  const renderBody = () => {
    if (activeQuery.isLoading) {
      return (
        <ul className="divide-y">
          {[0, 1, 2].map((item) => (
            <li
              key={item}
              className="flex gap-2.5 px-1 py-2.5 sm:gap-3 sm:px-2"
            >
              <Pecha.Skeleton className="size-9 shrink-0 rounded-full" />
              <div className="min-w-0 flex-1 space-y-1.5">
                <Pecha.Skeleton className="h-4 w-48 max-w-full" />
                <Pecha.Skeleton className="h-3 w-32 max-w-full" />
              </div>
            </li>
          ))}
        </ul>
      );
    }

    if (activeQuery.isError) {
      return (
        <div className="rounded-xl border border-dashed px-4 py-10 text-center sm:px-6">
          <p className="text-sm text-destructive">
            {getApiErrorMessage(
              activeQuery.error,
              tab === "joined"
                ? "Could not load members."
                : "Could not load removed users.",
            )}
          </p>
        </div>
      );
    }

    if (tab === "joined") {
      const users = joinedQuery.data?.users ?? [];
      if (users.length === 0) {
        return (
          <div className="rounded-xl border border-dashed px-4 py-10 text-center sm:px-6 sm:py-14">
            <p className="font-medium">No one has joined yet</p>
            <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
              People who join this group from the app will be listed here.
            </p>
          </div>
        );
      }
      return <ul className="divide-y">{users.map(renderJoinedUser)}</ul>;
    }

    const bans = bansQuery.data?.bans ?? [];
    if (bans.length === 0) {
      return (
        <div className="rounded-xl border border-dashed px-4 py-10 text-center sm:px-6 sm:py-14">
          <p className="font-medium">No one is blocked</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
            Users you remove appear here until their ban ends. You can let
            someone back in early from this list.
          </p>
        </div>
      );
    }
    return <ul className="divide-y">{bans.map(renderBan)}</ul>;
  };

  return (
    <div className="space-y-3">
      {/* "Members" alone would read as the staff list on the Members tab. */}
      <GroupSectionHeader
        title={
          tab === "joined"
            ? `Joined members${total ? ` (${total})` : ""}`
            : `Removed${total ? ` (${total})` : ""}`
        }
        action={
          <Pecha.Select
            value={tab}
            onValueChange={(value) => handleTabChange(value as Tab)}
          >
            <Pecha.SelectTrigger
              className="h-8 w-28 shrink-0 sm:w-36"
              aria-label="Filter community users"
            >
              <Pecha.SelectValue />
            </Pecha.SelectTrigger>
            <Pecha.SelectContent>
              <Pecha.SelectItem value="joined">Joined</Pecha.SelectItem>
              <Pecha.SelectItem value="banned">Removed</Pecha.SelectItem>
            </Pecha.SelectContent>
          </Pecha.Select>
        }
      />

      {renderBody()}

      {totalPages > 1 ? (
        <Pagination
          currentPage={page}
          totalPages={totalPages}
          onPageChange={setPage}
        />
      ) : null}

      <GroupRemoveUserDialog
        user={removeTarget}
        isPending={removeMutation.isPending}
        onOpenChange={(open) => !open && setRemoveTarget(null)}
        onConfirm={({ banDurationDays, reason }) => {
          if (!removeTarget) return;
          removeMutation.mutate({
            userId: removeTarget.user_id,
            banDurationDays,
            reason,
            userName: displayName(removeTarget),
          });
        }}
      />
    </div>
  );
};

export default GroupCommunitySection;
