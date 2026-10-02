import axiosInstance from "@/config/axios-config";

export const REPORT_SOURCES = ["MANUAL", "AUTOMATIC"] as const;
export type ChatReportSource = (typeof REPORT_SOURCES)[number];

export const REPORT_REASONS = [
  "SPAM",
  "HARASSMENT",
  "HATE_SPEECH",
  "INAPPROPRIATE",
  "INAPPROPRIATE_LANGUAGE",
  "OTHER",
] as const;
export type ChatReportReason = (typeof REPORT_REASONS)[number];

export type ChatReportUserDTO = {
  user_id: string;
  email?: string | null;
  firstname?: string | null;
  lastname?: string | null;
};

export type ChatMessageReportDTO = {
  id: string;
  source: ChatReportSource;
  reason: string;
  description?: string | null;
  message_id?: string | null;
  message_text?: string | null;
  /** TEXT or PRAYER. Absent when the message was never stored. */
  message_type?: string | null;
  room_id?: string | null;
  room_name?: string | null;
  /** GROUP, EVENT or PRIVATE. */
  room_kind?: string | null;
  /** Null for AUTOMATIC reports — the system filed them, not a person. */
  reporter?: ChatReportUserDTO | null;
  reported_user?: ChatReportUserDTO | null;
  created_at: string;
  resolved_at?: string | null;
};

export type ChatMessageReportListResponse = {
  reports: ChatMessageReportDTO[];
  skip: number;
  limit: number;
  total: number;
};

export type FetchChatReportsParams = {
  skip?: number;
  limit?: number;
  source?: ChatReportSource;
  reason?: ChatReportReason;
  resolved?: boolean;
};

export const fetchChatReports = async (
  params: FetchChatReportsParams = {},
): Promise<ChatMessageReportListResponse> => {
  const { data } = await axiosInstance.get<ChatMessageReportListResponse>(
    `/api/v1/cms/admin/chat-reports`,
    {
      params: {
        skip: params.skip ?? 0,
        limit: params.limit ?? 20,
        ...(params.source && { source: params.source }),
        ...(params.reason && { reason: params.reason }),
        ...(params.resolved !== undefined && { resolved: params.resolved }),
      },
    },
  );
  return data;
};
