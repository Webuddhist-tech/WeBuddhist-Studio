import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { IoChatbubbleOutline } from "react-icons/io5";
import { toast } from "sonner";
import { Pecha } from "@/components/ui/shadimport";
import { Button } from "@/components/ui/atoms/button";
import { Pagination } from "@/components/ui/molecules/pagination/Pagination";
import { getApiErrorMessage } from "@/lib/apiErrors";
import { useUserInfo } from "@/hooks/useUserInfo";
import { shouldShowCmsActionsColumn } from "@/lib/platformAccess";
import {
  approveGroupJoinRequest,
  fetchGroupJoinRequests,
  isJoinRequestAlreadyReviewedError,
  rejectGroupJoinRequest,
  type GroupJoinRequestDTO,
  type GroupJoinRequestStatus,
} from "../api/groupJoinRequestsApi";
import { GroupSectionHeader } from "./GroupSection";
import GroupJoinRequestStatusBadge from "./GroupJoinRequestStatusBadge";

const PAGE_SIZE = 20;

const STATUS_FILTER_OPTIONS: {
  value: GroupJoinRequestStatus;
  label: string;
}[] = [
  { value: "PENDING", label: "Pending" },
  { value: "APPROVED", label: "Approved" },
  { value: "REJECTED", label: "Rejected" },
];

const EMPTY_STATE: Record<
  GroupJoinRequestStatus,
  { title: string; hint: string }
> = {
  PENDING: {
    title: "No pending requests",
    hint: "When someone asks to join this group from the app, they'll show up here for review.",
  },
  APPROVED: {
    title: "No approved requests",
    hint: "Requests you approve will be listed here.",
  },
  REJECTED: {
    title: "No rejected requests",
    hint: "Requests you reject will be listed here.",
  },
};

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

const nameInitial = (name: string): string =>
  name.trim().charAt(0).toUpperCase() || "?";

type GroupJoinRequestsSectionProps = {
  groupId: string;
  canModerate: boolean;
};

const GroupJoinRequestsSection = ({
  groupId,
  canModerate,
}: GroupJoinRequestsSectionProps) => {
  const queryClient = useQueryClient();
  const { data: userInfo } = useUserInfo();
  const showActions =
    canModerate && shouldShowCmsActionsColumn(userInfo?.platform_role);

  const [status, setStatus] = useState<GroupJoinRequestStatus>("PENDING");
  const [page, setPage] = useState(1);
  /** Keyed by request id so overlapping actions each track their own row. */
  const [inFlight, setInFlight] = useState<
    Record<string, "approve" | "reject">
  >({});

  const {
    data,
    status: queryStatus,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["cms-group-join-requests", groupId, status, page],
    queryFn: () =>
      fetchGroupJoinRequests(groupId, {
        status,
        skip: (page - 1) * PAGE_SIZE,
        limit: PAGE_SIZE,
      }),
    enabled: Boolean(groupId),
    refetchOnWindowFocus: false,
  });

  const requests = data?.requests ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Moderating the last row on a trailing page shrinks the list past the
  // current offset; step back so the view never strands on an empty page.
  useEffect(() => {
    if (queryStatus !== "success") return;
    if (page > totalPages && totalPages > 0) {
      setPage(totalPages);
    }
  }, [queryStatus, page, totalPages]);

  const invalidate = () => {
    queryClient.invalidateQueries({
      queryKey: ["cms-group-join-requests", groupId],
    });
    queryClient.invalidateQueries({
      queryKey: ["cms-group-join-requests-count", groupId],
    });
    // Approving adds a member, so the group detail (Members tab) is now stale.
    queryClient.invalidateQueries({ queryKey: ["cms-group", groupId] });
    queryClient.invalidateQueries({ queryKey: ["cms-notifications"] });
  };

  const actionMutation = useMutation({
    mutationFn: ({
      requestId,
      action,
    }: {
      requestId: string;
      action: "approve" | "reject";
      userName: string;
    }) =>
      action === "approve"
        ? approveGroupJoinRequest(groupId, requestId)
        : rejectGroupJoinRequest(groupId, requestId),
    onMutate: ({ requestId, action }) =>
      setInFlight((current) => ({ ...current, [requestId]: action })),
    onSuccess: (_data, { action, userName }) => {
      toast.success(
        action === "approve"
          ? `${userName} is now a member`
          : `Request from ${userName} rejected`,
      );
      invalidate();
    },
    onError: (err) => {
      if (isJoinRequestAlreadyReviewedError(err)) {
        toast.error("This request was already reviewed.");
        invalidate();
        return;
      }
      toast.error(getApiErrorMessage(err));
    },
    onSettled: (_data, _err, { requestId }) =>
      setInFlight((current) => {
        const next = { ...current };
        delete next[requestId];
        return next;
      }),
  });

  const handleStatusChange = (next: GroupJoinRequestStatus) => {
    setStatus(next);
    setPage(1);
  };

  const runAction = (
    request: GroupJoinRequestDTO,
    action: "approve" | "reject",
  ) => {
    if (inFlight[request.id]) return;
    actionMutation.mutate({
      requestId: request.id,
      action,
      userName: request.user_name,
    });
  };

  const renderRequest = (request: GroupJoinRequestDTO) => {
    const rowAction = inFlight[request.id];
    const rowPending = Boolean(rowAction);
    const isPendingRequest = request.status === "PENDING";
    const message = request.message?.trim();

    return (
      <li
        key={request.id}
        className="flex gap-2.5 px-1 py-2.5 transition-opacity sm:gap-3 sm:px-2 data-[busy=true]:opacity-60"
        data-busy={rowPending}
      >
        <Pecha.Avatar className="size-9 shrink-0 ring-1 ring-border">
          <Pecha.AvatarImage
            src={request.user_avatar_url ?? undefined}
            alt=""
          />
          <Pecha.AvatarFallback className="bg-muted font-medium text-muted-foreground">
            {nameInitial(request.user_name)}
          </Pecha.AvatarFallback>
        </Pecha.Avatar>

        <div className="min-w-0 flex-1 space-y-1.5">
          <p className="text-sm leading-snug">
            <span className="font-semibold">{request.user_name}</span>
            {request.email ? (
              <span className="text-muted-foreground"> {request.email}</span>
            ) : null}
            <span className="text-muted-foreground">
              {" "}
              asked to join this group
            </span>
            <span className="text-muted-foreground"> · </span>
            <time
              dateTime={request.created_at}
              title={exactTime(request.created_at)}
              className="whitespace-nowrap text-muted-foreground"
            >
              {relativeTime(request.created_at)}
            </time>
          </p>

          {message ? (
            <blockquote className="flex gap-2 rounded-md border border-l-2 border-border border-l-[#A51C21] bg-muted py-1.5 pr-3 pl-2.5 dark:bg-muted/50">
              <IoChatbubbleOutline
                className="mt-0.5 size-3.5 shrink-0 text-muted-foreground"
                aria-hidden="true"
              />
              <p className="min-w-0 text-sm break-words whitespace-pre-wrap text-foreground/90">
                {message}
              </p>
            </blockquote>
          ) : null}

          {isPendingRequest && showActions ? (
            <div className="flex flex-wrap items-center gap-2 pt-0.5">
              <Button
                type="button"
                size="sm"
                className="h-8 min-w-[6rem] bg-[#A51C21] text-white hover:bg-[#A51C21]/90"
                disabled={rowPending}
                onClick={() => runAction(request, "approve")}
              >
                {rowAction === "approve" ? "Approving…" : "Approve"}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 min-w-[6rem]"
                disabled={rowPending}
                onClick={() => runAction(request, "reject")}
              >
                {rowAction === "reject" ? "Rejecting…" : "Reject"}
              </Button>
            </div>
          ) : null}

          {!isPendingRequest ? (
            <GroupJoinRequestStatusBadge status={request.status} />
          ) : null}
        </div>
      </li>
    );
  };

  const renderBody = () => {
    if (isLoading) {
      return (
        <ul className="divide-y">
          {[0, 1, 2].map((item) => (
            <li
              key={item}
              className="flex gap-2.5 px-1 py-2.5 sm:gap-3 sm:px-2"
            >
              <Pecha.Skeleton className="size-9 shrink-0 rounded-full" />
              <div className="min-w-0 flex-1 space-y-1.5">
                <Pecha.Skeleton className="h-4 w-64 max-w-full" />
                <Pecha.Skeleton className="h-7 w-48 max-w-full rounded-md" />
              </div>
            </li>
          ))}
        </ul>
      );
    }

    if (isError) {
      return (
        <div className="rounded-xl border border-dashed px-4 py-10 text-center sm:px-6">
          <p className="text-sm text-destructive">
            {getApiErrorMessage(error, "Could not load join requests.")}
          </p>
        </div>
      );
    }

    if (requests.length === 0) {
      return (
        <div className="rounded-xl border border-dashed px-4 py-10 text-center sm:px-6 sm:py-14">
          <p className="font-medium">{EMPTY_STATE[status].title}</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
            {EMPTY_STATE[status].hint}
          </p>
        </div>
      );
    }

    return <ul className="divide-y">{requests.map(renderRequest)}</ul>;
  };

  const pendingCount = status === "PENDING" && total ? ` (${total})` : "";

  return (
    <div className="space-y-3">
      <GroupSectionHeader
        title={`Join requests${pendingCount}`}
        action={
          <Pecha.Select
            value={status}
            onValueChange={(v) =>
              handleStatusChange(v as GroupJoinRequestStatus)
            }
          >
            <Pecha.SelectTrigger
              className="h-8 w-28 shrink-0 sm:w-36"
              aria-label="Filter by status"
            >
              <Pecha.SelectValue />
            </Pecha.SelectTrigger>
            <Pecha.SelectContent>
              {STATUS_FILTER_OPTIONS.map((opt) => (
                <Pecha.SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </Pecha.SelectItem>
              ))}
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
    </div>
  );
};

export default GroupJoinRequestsSection;
