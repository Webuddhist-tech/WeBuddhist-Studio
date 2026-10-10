import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTranslate } from "@tolgee/react";
import { Button } from "@/components/ui/atoms/button";
import { getApiErrorMessage } from "@/lib/apiErrors";
import {
  acceptTransferRequest,
  fetchIncomingTransferRequests,
  fetchOutgoingTransferRequests,
  filterIncomingForGroup,
  filterOutgoingForGroup,
  isTransferRequestExpired,
  rejectTransferRequest,
  revokeTransferRequest,
  type ContentTransferRequestDTO,
} from "@/components/routes/content-transfer/api/transferApi";
import { formatDistanceToNow } from "date-fns";
import { GroupDetailCard } from "./GroupSection";

type GroupTransfersSectionProps = {
  groupId: string;
  canManageIncoming: boolean;
  canManageOutgoing: boolean;
  alwaysVisible?: boolean;
};

function TransferRow({
  req,
  actions,
}: {
  req: ContentTransferRequestDTO;
  actions: React.ReactNode;
}) {
  const { t } = useTranslate();
  const expired = isTransferRequestExpired(req);
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 border-b py-2 text-sm last:border-0">
      <div>
        <span className="font-medium capitalize">
          {t(
            `studio.groups.components.transfers.content_type_${req.content_type}`,
          )}
        </span>
        {req.content_title ? `: ${req.content_title}` : null}
        <span className="text-muted-foreground">
          {" "}
          · {t(`studio.groups.components.status.${req.status.toLowerCase()}`)}
          {req.source_group_title ||
          req.target_group_title ||
          req.source_group_id ||
          req.target_group_id ? (
            <>
              {" "}
              · {(req.source_group_title ?? req.source_group_id) || "—"} →{" "}
              {(req.target_group_title ?? req.target_group_id) || "—"}
            </>
          ) : null}
        </span>
        {req.status === "PENDING" && req.expires_at && !expired ? (
          <div className="mt-1 text-xs text-muted-foreground">
            {t("studio.groups.components.invite.time_left", {
              time: formatDistanceToNow(new Date(req.expires_at)),
            })}
          </div>
        ) : null}
        {expired ? (
          <div className="mt-1 text-xs text-muted-foreground">
            {t("studio.groups.components.status.expired")}
          </div>
        ) : null}
      </div>
      <div className="flex gap-2">{expired ? null : actions}</div>
    </li>
  );
}

const GroupTransfersSection = ({
  groupId,
  canManageIncoming,
  canManageOutgoing,
  alwaysVisible = false,
}: GroupTransfersSectionProps) => {
  const { t } = useTranslate();
  const queryClient = useQueryClient();

  const {
    data: incomingScoped,
    isLoading: isIncomingScopedLoading,
    isError: isIncomingScopedError,
    error: incomingScopedError,
  } = useQuery({
    queryKey: ["transfer-requests", "incoming", "scoped", groupId],
    queryFn: () => fetchIncomingTransferRequests(groupId),
    refetchOnWindowFocus: true,
  });

  const {
    data: incomingAll,
    isLoading: isIncomingAllLoading,
    isError: isIncomingAllError,
    error: incomingAllError,
  } = useQuery({
    queryKey: ["transfer-requests", "incoming", "all"],
    queryFn: () => fetchIncomingTransferRequests(),
    refetchOnWindowFocus: true,
  });

  const {
    data: outgoingScoped,
    isLoading: isOutgoingScopedLoading,
    isError: isOutgoingScopedError,
    error: outgoingScopedError,
  } = useQuery({
    queryKey: ["transfer-requests", "outgoing", "scoped", groupId],
    queryFn: () => fetchOutgoingTransferRequests(groupId),
    refetchOnWindowFocus: true,
  });

  const {
    data: outgoingAll,
    isLoading: isOutgoingAllLoading,
    isError: isOutgoingAllError,
    error: outgoingAllError,
  } = useQuery({
    queryKey: ["transfer-requests", "outgoing", "all"],
    queryFn: () => fetchOutgoingTransferRequests(),
    refetchOnWindowFocus: true,
  });

  const incomingForGroup = useMemo(() => {
    const all = incomingAll?.requests ?? [];
    const scoped = incomingScoped?.requests ?? [];
    const filtered = filterIncomingForGroup(all, groupId);
    if (filtered.length > 0) return filtered;
    if (scoped.length > 0) return scoped;
    // API returned rows but group ids missing/wrong in JSON — still show them.
    if (all.length > 0) return all;
    return filterIncomingForGroup(scoped, groupId);
  }, [incomingScoped?.requests, incomingAll?.requests, groupId]);

  const outgoingForGroup = useMemo(() => {
    const all = outgoingAll?.requests ?? [];
    const scoped = outgoingScoped?.requests ?? [];
    const filtered = filterOutgoingForGroup(all, groupId);
    if (filtered.length > 0) return filtered;
    if (scoped.length > 0) return scoped;
    if (all.length > 0) return all;
    return filterOutgoingForGroup(scoped, groupId);
  }, [outgoingScoped?.requests, outgoingAll?.requests, groupId]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["transfer-requests"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard-items"] });
    queryClient.invalidateQueries({ queryKey: ["cms-group", groupId] });
    queryClient.invalidateQueries({ queryKey: ["cms-notifications"] });
  };

  const acceptMutation = useMutation({
    mutationFn: acceptTransferRequest,
    onSuccess: () => {
      toast.success(t("studio.groups.components.transfers.accepted_toast"));
      invalidate();
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  const rejectMutation = useMutation({
    mutationFn: rejectTransferRequest,
    onSuccess: () => {
      toast.success(t("studio.groups.components.transfers.rejected_toast"));
      invalidate();
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  const revokeMutation = useMutation({
    mutationFn: revokeTransferRequest,
    onSuccess: () => {
      toast.success(t("studio.groups.components.transfers.revoked_toast"));
      invalidate();
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  const isLoading =
    isIncomingScopedLoading ||
    isIncomingAllLoading ||
    isOutgoingScopedLoading ||
    isOutgoingAllLoading;

  const hasRequests =
    incomingForGroup.length > 0 || outgoingForGroup.length > 0;

  const hasApiData =
    (incomingAll?.requests?.length ?? 0) > 0 ||
    (outgoingAll?.requests?.length ?? 0) > 0;

  const showCard = alwaysVisible || hasRequests || isLoading || hasApiData;

  if (!showCard) {
    return null;
  }

  const incomingError = isIncomingScopedError
    ? incomingScopedError
    : isIncomingAllError
      ? incomingAllError
      : null;

  const outgoingError = isOutgoingScopedError
    ? outgoingScopedError
    : isOutgoingAllError
      ? outgoingAllError
      : null;

  return (
    <GroupDetailCard title={t("studio.groups.components.transfers.title")}>
      {isLoading ? (
        <p className="text-sm text-muted-foreground">
          {t("studio.groups.components.transfers.loading")}
        </p>
      ) : null}

      {incomingError ? (
        <p className="text-sm text-destructive mb-3">
          {getApiErrorMessage(
            incomingError,
            t("studio.groups.components.transfers.load_incoming_error"),
          )}
        </p>
      ) : null}

      {outgoingError ? (
        <p className="text-sm text-destructive mb-3">
          {getApiErrorMessage(
            outgoingError,
            t("studio.groups.components.transfers.load_outgoing_error"),
          )}
        </p>
      ) : null}

      {!isLoading && !hasRequests && hasApiData ? (
        <>
          <p className="text-sm text-amber-700 dark:text-amber-400 mb-3">
            {t("studio.groups.components.transfers.unmatched_notice")}
          </p>
          {(incomingAll?.requests?.length ?? 0) > 0 ? (
            <div className="mb-4">
              <p className="text-xs font-semibold uppercase text-muted-foreground mb-2">
                {t("studio.groups.components.transfers.all_incoming")}
              </p>
              <ul>
                {incomingAll!.requests.map((req) => (
                  <TransferRow
                    key={req.id}
                    req={req}
                    actions={
                      canManageIncoming && req.status === "PENDING" ? (
                        <>
                          <Button
                            size="sm"
                            variant="default"
                            disabled={
                              acceptMutation.isPending ||
                              rejectMutation.isPending
                            }
                            onClick={() => acceptMutation.mutate(req.id)}
                          >
                            {t("studio.groups.components.invite.accept")}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={
                              acceptMutation.isPending ||
                              rejectMutation.isPending
                            }
                            onClick={() => rejectMutation.mutate(req.id)}
                          >
                            {t("studio.groups.components.invite.reject")}
                          </Button>
                        </>
                      ) : null
                    }
                  />
                ))}
              </ul>
            </div>
          ) : null}
          {(outgoingAll?.requests?.length ?? 0) > 0 ? (
            <div>
              <p className="text-xs font-semibold uppercase text-muted-foreground mb-2">
                {t("studio.groups.components.transfers.all_outgoing")}
              </p>
              <ul>
                {outgoingAll!.requests.map((req) => (
                  <TransferRow
                    key={req.id}
                    req={req}
                    actions={
                      canManageOutgoing && req.status === "PENDING" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={revokeMutation.isPending}
                          onClick={() => revokeMutation.mutate(req.id)}
                        >
                          {t("studio.groups.components.invites_admin.revoke")}
                        </Button>
                      ) : null
                    }
                  />
                ))}
              </ul>
            </div>
          ) : null}
        </>
      ) : null}

      {!isLoading && !hasRequests && !hasApiData ? (
        <p className="text-sm text-muted-foreground">
          {t("studio.groups.components.transfers.empty")}
        </p>
      ) : null}

      {incomingForGroup.length > 0 ? (
        <div className="mb-4">
          <p className="text-xs font-semibold uppercase text-muted-foreground mb-2">
            {t("studio.groups.components.transfers.incoming")}
          </p>
          <ul>
            {incomingForGroup.map((req) => (
              <TransferRow
                key={req.id}
                req={req}
                actions={
                  canManageIncoming && req.status === "PENDING" ? (
                    <>
                      <Button
                        size="sm"
                        variant="default"
                        disabled={
                          acceptMutation.isPending || rejectMutation.isPending
                        }
                        onClick={() => acceptMutation.mutate(req.id)}
                      >
                        {t("studio.groups.components.invite.accept")}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={
                          acceptMutation.isPending || rejectMutation.isPending
                        }
                        onClick={() => rejectMutation.mutate(req.id)}
                      >
                        {t("studio.groups.components.invite.reject")}
                      </Button>
                    </>
                  ) : null
                }
              />
            ))}
          </ul>
        </div>
      ) : null}

      {outgoingForGroup.length > 0 ? (
        <div>
          <p className="text-xs font-semibold uppercase text-muted-foreground mb-2">
            {t("studio.groups.components.transfers.outgoing")}
          </p>
          <ul>
            {outgoingForGroup.map((req) => (
              <TransferRow
                key={req.id}
                req={req}
                actions={
                  canManageOutgoing && req.status === "PENDING" ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={revokeMutation.isPending}
                      onClick={() => revokeMutation.mutate(req.id)}
                    >
                      {t("studio.groups.components.invites_admin.revoke")}
                    </Button>
                  ) : null
                }
              />
            ))}
          </ul>
        </div>
      ) : null}
    </GroupDetailCard>
  );
};

export default GroupTransfersSection;
