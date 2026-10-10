import axiosInstance from "@/config/axios-config";

export const TEXT_REQUEST_STATUSES = [
  "PENDING",
  "IN_PROGRESS",
  "COMPLETED",
  "REJECTED",
] as const;
export type TextRequestStatus = (typeof TEXT_REQUEST_STATUSES)[number];

/** Literal keys so key extraction finds them. */
export const TEXT_REQUEST_STATUS_LABELS: Record<TextRequestStatus, string> = {
  PENDING: "studio.text_requests.status.pending",
  IN_PROGRESS: "studio.text_requests.status.in_progress",
  COMPLETED: "studio.text_requests.status.completed",
  REJECTED: "studio.text_requests.status.rejected",
};

/** File types the backend accepts as attachments; kept in step with
 * `_ATTACHMENT_CONTENT_TYPES` in pecha_api/text_requests. */
export const TEXT_REQUEST_ACCEPTED_EXTENSIONS = [
  ".pdf",
  ".doc",
  ".docx",
  ".odt",
  ".rtf",
  ".txt",
  ".md",
  ".csv",
  ".xls",
  ".xlsx",
  ".epub",
  ".xml",
  ".json",
  ".zip",
  ".7z",
  ".rar",
  ".tar",
  ".gz",
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".tif",
  ".tiff",
  ".mp3",
  ".m4a",
  ".wav",
] as const;
export const TEXT_REQUEST_MAX_FILES = 10;
export const TEXT_REQUEST_MAX_TOTAL_MB = 50;

export interface TextRequestAuthorDTO {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
}

export interface TextRequestAttachmentDTO {
  filename: string;
  content_type: string;
  size: number;
  /** Presigned; expires, so always read it from a fresh response. */
  url: string;
}

export interface TextRequestDTO {
  id: string;
  message: string;
  status: TextRequestStatus;
  reply?: string | null;
  /** Edition linked by the responder once the text is in the library. */
  text_id?: string | null;
  group_id?: string | null;
  group_name?: string | null;
  collection_id?: string | null;
  collection_name?: string | null;
  attachments: TextRequestAttachmentDTO[];
  requester?: TextRequestAuthorDTO | null;
  responder?: TextRequestAuthorDTO | null;
  responded_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface TextRequestsResponse {
  requests: TextRequestDTO[];
  skip: number;
  limit: number;
  total: number;
}

export interface CreateTextRequestInput {
  message: string;
  files: File[];
  groupId?: string | null;
  collectionId?: string | null;
}

export interface UpdateTextRequestInput {
  status?: TextRequestStatus;
  /** An empty string clears it. */
  reply?: string;
  /** An empty string clears it. */
  text_id?: string;
}

interface ListParams {
  skip?: number;
  limit?: number;
  status?: TextRequestStatus;
}

const AUTHOR_URL = "/api/v1/cms/author/text-requests";
const ADMIN_URL = "/api/v1/cms/admin/text-requests";

export const createTextRequest = async ({
  message,
  files,
  groupId,
  collectionId,
}: CreateTextRequestInput): Promise<TextRequestDTO> => {
  const formData = new FormData();
  formData.append("message", message);
  files.forEach((file) => formData.append("files", file));
  if (groupId) formData.append("group_id", groupId);
  if (collectionId) formData.append("collection_id", collectionId);
  const { data } = await axiosInstance.post<TextRequestDTO>(
    AUTHOR_URL,
    formData,
  );
  return data;
};

const listParams = (params: ListParams) => ({
  skip: params.skip ?? 0,
  limit: params.limit ?? 20,
  ...(params.status && { status: params.status }),
});

export const fetchMyTextRequests = async (
  params: ListParams = {},
): Promise<TextRequestsResponse> => {
  const { data } = await axiosInstance.get<TextRequestsResponse>(
    `${AUTHOR_URL}/mine`,
    { params: listParams(params) },
  );
  return data;
};

export const fetchTextRequests = async (
  params: ListParams = {},
): Promise<TextRequestsResponse> => {
  const { data } = await axiosInstance.get<TextRequestsResponse>(ADMIN_URL, {
    params: listParams(params),
  });
  return data;
};

export const updateTextRequest = async (
  requestId: string,
  body: UpdateTextRequestInput,
): Promise<TextRequestDTO> => {
  const { data } = await axiosInstance.patch<TextRequestDTO>(
    `${ADMIN_URL}/${requestId}`,
    body,
  );
  return data;
};

export const authorDisplayName = (author?: TextRequestAuthorDTO | null) => {
  if (!author) return null;
  const name = `${author.first_name ?? ""} ${author.last_name ?? ""}`.trim();
  return name || author.email || author.id;
};

export const formatFileSize = (size: number) =>
  size >= 1024 * 1024
    ? `${(size / (1024 * 1024)).toFixed(1)} MB`
    : `${Math.max(1, Math.round(size / 1024))} KB`;
