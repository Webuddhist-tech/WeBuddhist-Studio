import axiosInstance from "@/config/axios-config";

/**
 * Community users who joined a group from the app, and the moderation actions
 * an owner/admin can take on them.
 *
 * Not to be confused with `groupsApi`'s members, which are the group's staff
 * authors and their CMS roles. These two lists never overlap.
 */

/** Matches DEFAULT_GROUP_BAN_DURATION_DAYS on the API. */
export const DEFAULT_BAN_DURATION_DAYS = 7;

export const BAN_DURATION_OPTIONS: { value: number; label: string }[] = [
  { value: 1, label: "1 day" },
  { value: 7, label: "7 days" },
  { value: 30, label: "30 days" },
  { value: 90, label: "90 days" },
  { value: 365, label: "1 year" },
];

export interface GroupJoinedUserDTO {
  user_id: string;
  username?: string | null;
  fullname: string;
  avatar_url?: string | null;
  joined_at?: string | null;
}

export interface GroupJoinedUsersListResponse {
  users: GroupJoinedUserDTO[];
  skip: number;
  limit: number;
  total: number;
}

export interface GroupBanDTO {
  id: string;
  user_id: string;
  username?: string | null;
  fullname: string;
  avatar_url?: string | null;
  reason?: string | null;
  expires_at: string;
  lifted_at?: string | null;
  created_at: string;
  is_active: boolean;
}

export interface GroupBanListResponse {
  bans: GroupBanDTO[];
  skip: number;
  limit: number;
  total: number;
}

export interface RemoveGroupUserPayload {
  ban_duration_days?: number;
  reason?: string | null;
}

export interface PaginationParams {
  skip?: number;
  limit?: number;
}

const getAuthHeaders = () => ({
  Authorization: `Bearer ${sessionStorage.getItem("accessToken")}`,
});

export const fetchGroupJoinedUsers = async (
  groupId: string,
  params: PaginationParams = {},
): Promise<GroupJoinedUsersListResponse> => {
  const { data } = await axiosInstance.get<GroupJoinedUsersListResponse>(
    `/api/v1/cms/author/groups/${groupId}/joined-users`,
    {
      headers: getAuthHeaders(),
      params: { skip: params.skip ?? 0, limit: params.limit ?? 20 },
    },
  );
  return data;
};

/**
 * Removes the user from the group AND blocks them from rejoining. There is no
 * remove-without-ban: pass a short duration if that is what you want.
 */
export const removeGroupJoinedUser = async (
  groupId: string,
  userId: string,
  payload: RemoveGroupUserPayload = {},
): Promise<GroupBanDTO> => {
  const { data } = await axiosInstance.post<GroupBanDTO>(
    `/api/v1/cms/author/groups/${groupId}/joined-users/${userId}/remove`,
    {
      ban_duration_days: payload.ban_duration_days ?? DEFAULT_BAN_DURATION_DAYS,
      reason: payload.reason?.trim() ? payload.reason.trim() : null,
    },
    { headers: getAuthHeaders() },
  );
  return data;
};

export const fetchGroupBans = async (
  groupId: string,
  params: PaginationParams & { activeOnly?: boolean } = {},
): Promise<GroupBanListResponse> => {
  const { data } = await axiosInstance.get<GroupBanListResponse>(
    `/api/v1/cms/author/groups/${groupId}/bans`,
    {
      headers: getAuthHeaders(),
      params: {
        skip: params.skip ?? 0,
        limit: params.limit ?? 20,
        active_only: params.activeOnly ?? true,
      },
    },
  );
  return data;
};

/** Ends a ban early. The user may rejoin but is not re-added automatically. */
export const liftGroupBan = async (
  groupId: string,
  banId: string,
): Promise<GroupBanDTO> => {
  const { data } = await axiosInstance.post<GroupBanDTO>(
    `/api/v1/cms/author/groups/${groupId}/bans/${banId}/lift`,
    {},
    { headers: getAuthHeaders() },
  );
  return data;
};

/**
 * A 400 from lift means another moderator got there first, or the ban ran out
 * while the page sat open. Either way the list is stale and must be refetched.
 */
export function isBanAlreadyResolvedError(error: unknown): boolean {
  const err = error as { response?: { status?: number } } | null;
  if (!err || typeof err !== "object") return false;
  return err.response?.status === 400;
}
