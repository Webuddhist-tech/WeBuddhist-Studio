import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Navigate } from "react-router-dom";
import { toast } from "sonner";
import { useTranslate } from "@tolgee/react";
import { Pecha } from "@/components/ui/shadimport";
import { Pagination } from "@/components/ui/molecules/pagination/Pagination";
import { getApiErrorMessage } from "@/lib/apiErrors";
import { useUserInfo } from "@/hooks/useUserInfo";
import { canManageTextRequests } from "@/lib/platformAccess";
import { ROUTES } from "@/routes/paths";
import {
  TEXT_REQUEST_STATUSES,
  TEXT_REQUEST_STATUS_LABELS,
  authorDisplayName,
  fetchTextRequests,
  updateTextRequest,
  type TextRequestAuthorDTO,
  type TextRequestDTO,
  type TextRequestStatus,
} from "./api/textRequestsApi";
import { TextRequestStatusBadge } from "./TextRequestStatusBadge";
import { TextRequestAttachmentList } from "./TextRequestAttachmentList";

const PAGE_SIZE = 20;
const TABLE_COLUMN_COUNT = 6;
const QUERY_KEY = "admin-text-requests";

const formatDate = (value?: string | null) =>
  value ? format(new Date(value), "MMM dd, yyyy HH:mm") : "—";

const AuthorCell = ({ author }: { author?: TextRequestAuthorDTO | null }) => {
  if (!author) return <span className="text-muted-foreground">—</span>;
  return (
    <div className="min-w-[10rem]">
      <p className="font-medium">{authorDisplayName(author)}</p>
      {author.email ? (
        <p className="mt-0.5 text-xs text-muted-foreground">{author.email}</p>
      ) : null}
    </div>
  );
};

interface RespondSheetProps {
  request: TextRequestDTO | null;
  onOpenChange: (open: boolean) => void;
}

const RespondSheet = ({ request, onOpenChange }: RespondSheetProps) => {
  const { t } = useTranslate();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<TextRequestStatus>("PENDING");
  const [reply, setReply] = useState("");
  const [textId, setTextId] = useState("");

  useEffect(() => {
    if (!request) return;
    setStatus(request.status);
    setReply(request.reply ?? "");
    setTextId(request.text_id ?? "");
  }, [request]);

  const mutation = useMutation({
    mutationFn: () =>
      updateTextRequest(request!.id, {
        status,
        reply: reply.trim(),
        text_id: textId.trim(),
      }),
    onSuccess: () => {
      toast.success(t("studio.text_requests.admin_page.saved"));
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      onOpenChange(false);
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  const dirty =
    !!request &&
    (status !== request.status ||
      reply.trim() !== (request.reply ?? "") ||
      textId.trim() !== (request.text_id ?? ""));

  return (
    <Pecha.Sheet open={request !== null} onOpenChange={onOpenChange}>
      <Pecha.SheetContent
        side="right"
        className="flex w-full flex-col gap-0 sm:max-w-xl"
      >
        <Pecha.SheetHeader>
          <Pecha.SheetTitle>
            {t("studio.text_requests.admin_page.detail_title")}
          </Pecha.SheetTitle>
          <Pecha.SheetDescription>
            {request ? formatDate(request.created_at) : null}
          </Pecha.SheetDescription>
        </Pecha.SheetHeader>

        {request ? (
          <div className="flex-1 space-y-6 overflow-y-auto px-4 pb-4">
            <section className="space-y-2">
              <h3 className="text-sm font-semibold">
                {t("studio.text_requests.admin_page.requested_by")}
              </h3>
              <AuthorCell author={request.requester} />
              {request.group_name || request.collection_name ? (
                <p className="text-sm text-muted-foreground">
                  {[request.group_name, request.collection_name]
                    .filter(Boolean)
                    .join(" › ")}
                </p>
              ) : null}
            </section>

            <section className="space-y-2">
              <h3 className="text-sm font-semibold">
                {t("studio.text_requests.admin_page.message")}
              </h3>
              <p className="whitespace-pre-wrap break-words rounded-md border bg-muted/40 p-3 text-sm">
                {request.message}
              </p>
            </section>

            {request.attachments.length > 0 ? (
              <section className="space-y-2">
                <h3 className="text-sm font-semibold">
                  {t("studio.text_requests.admin_page.attachments", {
                    count: request.attachments.length,
                  })}
                </h3>
                <TextRequestAttachmentList attachments={request.attachments} />
              </section>
            ) : null}

            <section className="space-y-4 border-t pt-4">
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="tr-status">
                  {t("studio.text_requests.admin_page.status")}
                </label>
                <Pecha.Select
                  value={status}
                  onValueChange={(value) =>
                    setStatus(value as TextRequestStatus)
                  }
                >
                  <Pecha.SelectTrigger id="tr-status" className="w-full">
                    <Pecha.SelectValue />
                  </Pecha.SelectTrigger>
                  <Pecha.SelectContent>
                    {TEXT_REQUEST_STATUSES.map((value) => (
                      <Pecha.SelectItem key={value} value={value}>
                        {t(TEXT_REQUEST_STATUS_LABELS[value])}
                      </Pecha.SelectItem>
                    ))}
                  </Pecha.SelectContent>
                </Pecha.Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="tr-reply">
                  {t("studio.text_requests.admin_page.reply")}
                </label>
                <Pecha.Textarea
                  id="tr-reply"
                  value={reply}
                  onChange={(event) => setReply(event.target.value)}
                  placeholder={t(
                    "studio.text_requests.admin_page.reply_placeholder",
                  )}
                  rows={4}
                  maxLength={4000}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="tr-text-id">
                  {t("studio.text_requests.admin_page.text_id")}
                </label>
                <Pecha.Input
                  id="tr-text-id"
                  value={textId}
                  onChange={(event) => setTextId(event.target.value)}
                  placeholder={t(
                    "studio.text_requests.admin_page.text_id_placeholder",
                  )}
                  maxLength={255}
                />
                <p className="text-xs text-muted-foreground">
                  {t("studio.text_requests.admin_page.text_id_hint")}
                </p>
              </div>

              {request.responder ? (
                <p className="text-xs text-muted-foreground">
                  {t("studio.text_requests.admin_page.last_response", {
                    name: authorDisplayName(request.responder),
                    date: formatDate(request.responded_at),
                  })}
                </p>
              ) : null}
            </section>
          </div>
        ) : null}

        <div className="flex justify-end gap-2 border-t px-4 py-3">
          <Pecha.Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            {t("studio.common.cancel")}
          </Pecha.Button>
          <Pecha.Button
            type="button"
            onClick={() => mutation.mutate()}
            disabled={!dirty || mutation.isPending}
            className="bg-[#A51C21] text-white hover:bg-[#A51C21]/90"
          >
            {mutation.isPending
              ? t("studio.common.saving")
              : t("studio.text_requests.admin_page.save")}
          </Pecha.Button>
        </div>
      </Pecha.SheetContent>
    </Pecha.Sheet>
  );
};

const TextRequestsPage = () => {
  const { t } = useTranslate();
  const { data: userInfo } = useUserInfo();
  const [page, setPage] = useState(0);
  const [statusFilter, setStatusFilter] = useState<TextRequestStatus | "ALL">(
    "PENDING",
  );
  const [selected, setSelected] = useState<TextRequestDTO | null>(null);

  const canAccess = Boolean(
    userInfo && canManageTextRequests(userInfo.platform_role),
  );

  const { data, isLoading, error } = useQuery({
    queryKey: [QUERY_KEY, page, statusFilter],
    queryFn: () =>
      fetchTextRequests({
        skip: page * PAGE_SIZE,
        limit: PAGE_SIZE,
        ...(statusFilter !== "ALL" && { status: statusFilter }),
      }),
    enabled: canAccess,
  });

  const requests = data?.requests ?? [];
  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / PAGE_SIZE));

  if (userInfo && !canAccess) {
    return <Navigate to={ROUTES.dashboard} replace />;
  }

  const renderRows = () => {
    if (isLoading) {
      return (
        <Pecha.TableRow>
          <Pecha.TableCell colSpan={TABLE_COLUMN_COUNT}>
            {t("studio.common.loading")}
          </Pecha.TableCell>
        </Pecha.TableRow>
      );
    }
    if (requests.length === 0) {
      return (
        <Pecha.TableRow>
          <Pecha.TableCell colSpan={TABLE_COLUMN_COUNT}>
            {t("studio.text_requests.admin_page.empty")}
          </Pecha.TableCell>
        </Pecha.TableRow>
      );
    }
    return requests.map((request) => (
      <Pecha.TableRow
        key={request.id}
        className="cursor-pointer"
        onClick={() => setSelected(request)}
      >
        <Pecha.TableCell>
          <AuthorCell author={request.requester} />
        </Pecha.TableCell>
        <Pecha.TableCell>
          <div className="max-w-[24rem]">
            <p className="line-clamp-3 break-words" title={request.message}>
              {request.message}
            </p>
            {request.attachments.length > 0 ? (
              <p className="mt-0.5 text-xs text-muted-foreground">
                {t("studio.text_requests.admin_page.attachments", {
                  count: request.attachments.length,
                })}
              </p>
            ) : null}
          </div>
        </Pecha.TableCell>
        <Pecha.TableCell>
          {request.group_name || request.collection_name ? (
            <div className="flex flex-col gap-0.5">
              <span>{request.group_name ?? "—"}</span>
              {request.collection_name ? (
                <span className="text-xs text-muted-foreground">
                  {request.collection_name}
                </span>
              ) : null}
            </div>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </Pecha.TableCell>
        <Pecha.TableCell>{formatDate(request.created_at)}</Pecha.TableCell>
        <Pecha.TableCell>
          <TextRequestStatusBadge status={request.status} />
        </Pecha.TableCell>
        <Pecha.TableCell>
          <AuthorCell author={request.responder} />
        </Pecha.TableCell>
      </Pecha.TableRow>
    ));
  };

  return (
    <div className="font-dynamic border h-[calc(100vh-40px)] overflow-auto bg-[#F5F5F5] dark:bg-[#181818] my-4 rounded-l-2xl max-md:my-0 max-md:h-full max-md:rounded-none max-md:border-0">
      <div className="px-4 pt-10 pb-4">
        <h1 className="text-xl font-semibold">
          {t("studio.text_requests.admin_page.title")}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("studio.text_requests.admin_page.description")}
        </p>
      </div>

      <div className="flex flex-wrap gap-3 px-4 pb-4">
        <select
          className="rounded border bg-background px-3 py-2 text-sm"
          value={statusFilter}
          onChange={(event) => {
            setStatusFilter(event.target.value as TextRequestStatus | "ALL");
            setPage(0);
          }}
        >
          <option value="ALL">
            {t("studio.text_requests.admin_page.all_statuses")}
          </option>
          {TEXT_REQUEST_STATUSES.map((value) => (
            <option key={value} value={value}>
              {t(TEXT_REQUEST_STATUS_LABELS[value])}
            </option>
          ))}
        </select>
      </div>

      {error ? (
        <p className="px-4 text-sm text-destructive">
          {getApiErrorMessage(error)}
        </p>
      ) : null}

      <div className="overflow-x-auto px-4 pb-8">
        <Pecha.Table>
          <Pecha.TableHeader>
            <Pecha.TableRow>
              <Pecha.TableHead>
                {t("studio.text_requests.admin_page.requested_by")}
              </Pecha.TableHead>
              <Pecha.TableHead>
                {t("studio.text_requests.admin_page.message")}
              </Pecha.TableHead>
              <Pecha.TableHead>
                {t("studio.text_requests.admin_page.space")}
              </Pecha.TableHead>
              <Pecha.TableHead>
                {t("studio.text_requests.admin_page.date")}
              </Pecha.TableHead>
              <Pecha.TableHead>
                {t("studio.text_requests.admin_page.status")}
              </Pecha.TableHead>
              <Pecha.TableHead>
                {t("studio.text_requests.admin_page.responder")}
              </Pecha.TableHead>
            </Pecha.TableRow>
          </Pecha.TableHeader>
          <Pecha.TableBody>{renderRows()}</Pecha.TableBody>
        </Pecha.Table>

        {totalPages > 1 ? (
          <div className="mt-4">
            <Pagination
              currentPage={page + 1}
              totalPages={totalPages}
              onPageChange={(p) => setPage(p - 1)}
            />
          </div>
        ) : null}
      </div>

      <RespondSheet
        request={selected}
        onOpenChange={(open) => !open && setSelected(null)}
      />
    </div>
  );
};

export default TextRequestsPage;
