import axiosInstance from "@/config/axios-config";

export type GroupJoinRequestStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface GroupJoinRequestDTO {
  id: string;
  user_id: string;
  user_name: string;
  email?: string | null;
  user_avatar_url?: string | null;
  message?: string | null;
  status: GroupJoinRequestStatus;
  created_at: string;
}

export interface GroupJoinRequestListResponse {
  requests: GroupJoinRequestDTO[];
  skip: number;
  limit: number;
  total: number;
}

export interface GroupJoinRequestActionResponse {
  id: string;
  status: GroupJoinRequestStatus;
}

export interface FetchGroupJoinRequestsParams {
  status?: GroupJoinRequestStatus;
  skip?: number;
  limit?: number;
}

const getAuthHeaders = () => ({
  Authorization: `Bearer ${sessionStorage.getItem("accessToken")}`,
});

export const fetchGroupJoinRequests = async (
  groupId: string,
  params: FetchGroupJoinRequestsParams = {},
): Promise<GroupJoinRequestListResponse> => {
  const { data } = await axiosInstance.get<GroupJoinRequestListResponse>(
    `/api/v1/cms/author/groups/${groupId}/join-requests`,
    {
      headers: getAuthHeaders(),
      params: {
        status: params.status ?? "PENDING",
        skip: params.skip ?? 0,
        limit: params.limit ?? 20,
      },
    },
  );
  return data;
};

export const approveGroupJoinRequest = async (
  groupId: string,
  requestId: string,
): Promise<GroupJoinRequestActionResponse> => {
  const { data } = await axiosInstance.post<GroupJoinRequestActionResponse>(
    `/api/v1/cms/author/groups/${groupId}/join-requests/${requestId}/approve`,
    {},
    { headers: getAuthHeaders() },
  );
  return data;
};

export const rejectGroupJoinRequest = async (
  groupId: string,
  requestId: string,
): Promise<GroupJoinRequestActionResponse> => {
  const { data } = await axiosInstance.post<GroupJoinRequestActionResponse>(
    `/api/v1/cms/author/groups/${groupId}/join-requests/${requestId}/reject`,
    {},
    { headers: getAuthHeaders() },
  );
  return data;
};

/**
 * A 400 from approve/reject means the request is no longer PENDING — another
 * moderator actioned it first. The list must be refetched rather than patched.
 */
export function isJoinRequestAlreadyReviewedError(error: unknown): boolean {
  const err = error as { response?: { status?: number } } | null;
  if (!err || typeof err !== "object") return false;
  return err.response?.status === 400;
}
