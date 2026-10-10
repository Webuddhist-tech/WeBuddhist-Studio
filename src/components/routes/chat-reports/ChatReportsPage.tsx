import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Navigate } from "react-router-dom";
import { useTranslate } from "@tolgee/react";
import { Pecha } from "@/components/ui/shadimport";
import { Pagination } from "@/components/ui/molecules/pagination/Pagination";
import { getApiErrorMessage } from "@/lib/apiErrors";
import { useUserInfo } from "@/hooks/useUserInfo";
import { canAccessAdminAuthors } from "@/lib/platformAccess";
import { ROUTES } from "@/routes/paths";
import {
  fetchChatReports,
  REPORT_REASONS,
  type ChatMessageReportDTO,
  type ChatReportReason,
  type ChatReportSource,
  type ChatReportUserDTO,
} from "./api/chatReportsApi";

const PAGE_SIZE = 20;
const TABLE_COLUMN_COUNT = 7;

type TFn = ReturnType<typeof useTranslate>["t"];

const formatEnumLabel = (value: string) =>
  value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());

const formatReason = (reason: string, t: TFn) =>
  t(
    `studio.chat_reports.reason.${reason.toLowerCase()}`,
    formatEnumLabel(reason),
  );

const displayName = (user?: ChatReportUserDTO | null) => {
  if (!user) return null;
  const name = `${user.firstname ?? ""} ${user.lastname ?? ""}`.trim();
  return name || user.email || user.user_id;
};

const UserCell = ({ user }: { user?: ChatReportUserDTO | null }) => {
  if (!user) return <span className="text-muted-foreground">—</span>;
  return (
    <div className="min-w-[10rem]">
      <p className="font-medium">{displayName(user)}</p>
      {user.email ? (
        <p className="text-xs text-muted-foreground mt-0.5">{user.email}</p>
      ) : null}
    </div>
  );
};

const renderTableBody = ({
  isLoading,
  reports,
  t,
}: {
  isLoading: boolean;
  reports: ChatMessageReportDTO[];
  t: TFn;
}) => {
  if (isLoading) {
    return (
      <Pecha.TableRow>
        <Pecha.TableCell colSpan={TABLE_COLUMN_COUNT}>
          {t("studio.common.loading")}
        </Pecha.TableCell>
      </Pecha.TableRow>
    );
  }

  if (reports.length === 0) {
    return (
      <Pecha.TableRow>
        <Pecha.TableCell colSpan={TABLE_COLUMN_COUNT}>
          {t("studio.chat_reports.empty")}
        </Pecha.TableCell>
      </Pecha.TableRow>
    );
  }

  return reports.map((report) => (
    <Pecha.TableRow key={report.id}>
      <Pecha.TableCell>
        <UserCell user={report.reported_user} />
      </Pecha.TableCell>
      <Pecha.TableCell>
        {report.source === "AUTOMATIC" ? (
          <span className="text-muted-foreground italic">
            {t("studio.chat_reports.source.automatic")}
          </span>
        ) : (
          <UserCell user={report.reporter} />
        )}
      </Pecha.TableCell>
      <Pecha.TableCell>
        <div className="max-w-[24rem]">
          {report.message_type === "PRAYER" ? (
            <Pecha.Badge variant="secondary" className="mb-1">
              {t("studio.chat_reports.prayer_request")}
            </Pecha.Badge>
          ) : null}
          <p
            className="line-clamp-3 break-words"
            title={report.message_text ?? ""}
          >
            {report.message_text?.trim() || "—"}
          </p>
          {report.description?.trim() ? (
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
              {t("studio.chat_reports.note", { note: report.description })}
            </p>
          ) : null}
        </div>
      </Pecha.TableCell>
      <Pecha.TableCell>{formatReason(report.reason, t)}</Pecha.TableCell>
      <Pecha.TableCell>
        {report.room_name?.trim() ? (
          <div className="flex flex-col gap-0.5">
            <span>{report.room_name.trim()}</span>
            {report.room_kind === "EVENT" ? (
              <span className="text-xs text-muted-foreground">
                {t("studio.chat_reports.event_chat")}
              </span>
            ) : null}
          </div>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </Pecha.TableCell>
      <Pecha.TableCell>
        {report.created_at
          ? format(new Date(report.created_at), "MMM dd, yyyy HH:mm")
          : "—"}
      </Pecha.TableCell>
      <Pecha.TableCell>
        {report.resolved_at ? (
          <span className="text-xs font-medium text-green-700 dark:text-green-400">
            {t("studio.chat_reports.status.resolved")}
          </span>
        ) : (
          <span className="text-xs font-medium text-amber-700 dark:text-amber-400">
            {t("studio.chat_reports.status.open")}
          </span>
        )}
      </Pecha.TableCell>
    </Pecha.TableRow>
  ));
};

const ChatReportsPage = () => {
  const { t } = useTranslate();
  const { data: userInfo } = useUserInfo();
  const [page, setPage] = useState(0);
  const [sourceFilter, setSourceFilter] = useState<ChatReportSource | "ALL">(
    "ALL",
  );
  const [reasonFilter, setReasonFilter] = useState<ChatReportReason | "ALL">(
    "ALL",
  );
  const [statusFilter, setStatusFilter] = useState<"ALL" | "OPEN" | "RESOLVED">(
    "ALL",
  );

  const canAccess = Boolean(
    userInfo && canAccessAdminAuthors(userInfo.platform_role),
  );

  const { data, isLoading, error } = useQuery({
    queryKey: ["chat-reports", page, sourceFilter, reasonFilter, statusFilter],
    queryFn: () =>
      fetchChatReports({
        skip: page * PAGE_SIZE,
        limit: PAGE_SIZE,
        ...(sourceFilter !== "ALL" && { source: sourceFilter }),
        ...(reasonFilter !== "ALL" && { reason: reasonFilter }),
        ...(statusFilter !== "ALL" && {
          resolved: statusFilter === "RESOLVED",
        }),
      }),
    enabled: canAccess,
  });

  const reports = data?.reports ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  if (userInfo && !canAccess) {
    return <Navigate to={ROUTES.dashboard} replace />;
  }

  return (
    <div className="font-dynamic border h-[calc(100vh-40px)] overflow-auto bg-[#F5F5F5] dark:bg-[#181818] my-4 rounded-l-2xl max-md:my-0 max-md:h-full max-md:rounded-none max-md:border-0">
      <div className="px-4 pt-10 pb-4">
        <h1 className="text-xl font-semibold">
          {t("studio.chat_reports.title")}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t("studio.chat_reports.subtitle")}
        </p>
      </div>

      <div className="px-4 pb-4 flex flex-wrap gap-3">
        <select
          className="rounded border bg-background px-3 py-2 text-sm"
          value={sourceFilter}
          onChange={(e) => {
            setSourceFilter(e.target.value as ChatReportSource | "ALL");
            setPage(0);
          }}
        >
          <option value="ALL">{t("studio.chat_reports.all_sources")}</option>
          <option value="MANUAL">
            {t("studio.chat_reports.source.manual")}
          </option>
          <option value="AUTOMATIC">
            {t("studio.chat_reports.source.automatic")}
          </option>
        </select>
        <select
          className="rounded border bg-background px-3 py-2 text-sm"
          value={reasonFilter}
          onChange={(e) => {
            setReasonFilter(e.target.value as ChatReportReason | "ALL");
            setPage(0);
          }}
        >
          <option value="ALL">{t("studio.chat_reports.all_reasons")}</option>
          {REPORT_REASONS.map((reason) => (
            <option key={reason} value={reason}>
              {formatReason(reason, t)}
            </option>
          ))}
        </select>
        <select
          className="rounded border bg-background px-3 py-2 text-sm"
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value as "ALL" | "OPEN" | "RESOLVED");
            setPage(0);
          }}
        >
          <option value="ALL">{t("studio.chat_reports.all_statuses")}</option>
          <option value="OPEN">{t("studio.chat_reports.status.open")}</option>
          <option value="RESOLVED">
            {t("studio.chat_reports.status.resolved")}
          </option>
        </select>
      </div>

      {error ? (
        <p className="px-4 text-destructive text-sm">
          {getApiErrorMessage(error)}
        </p>
      ) : null}

      <div className="px-4 pb-8 overflow-x-auto">
        <Pecha.Table>
          <Pecha.TableHeader>
            <Pecha.TableRow>
              <Pecha.TableHead>
                {t("studio.chat_reports.table.reported_user")}
              </Pecha.TableHead>
              <Pecha.TableHead>
                {t("studio.chat_reports.table.reported_by")}
              </Pecha.TableHead>
              <Pecha.TableHead>
                {t("studio.chat_reports.table.message")}
              </Pecha.TableHead>
              <Pecha.TableHead>
                {t("studio.chat_reports.table.reason")}
              </Pecha.TableHead>
              <Pecha.TableHead>
                {t("studio.chat_reports.table.room")}
              </Pecha.TableHead>
              <Pecha.TableHead>{t("studio.common.date")}</Pecha.TableHead>
              <Pecha.TableHead>{t("studio.common.status")}</Pecha.TableHead>
            </Pecha.TableRow>
          </Pecha.TableHeader>
          <Pecha.TableBody>
            {renderTableBody({ isLoading, reports, t })}
          </Pecha.TableBody>
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
    </div>
  );
};

export default ChatReportsPage;
