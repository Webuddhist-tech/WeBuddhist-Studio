import axiosInstance from "@/config/axios-config";
import {
  getLanguageLabel,
  getLanguageName,
} from "@/components/api/languagesApi";
import {
  resolveDashboardItemImageUrl,
  type DashboardImageVariants,
} from "@/components/routes/dashboard/dashboardTable";
import { sortLanguageCodes } from "@/lib/languageCodes";
import type { LanguageCode } from "@/schema/SeriesSchema";
import { usesStaffWideDashboardGroupList } from "@/lib/platformAccess";
import type { UserInfo } from "@/hooks/useUserInfo";
import { capitalizeFirstLetter } from "@/lib/textUtils";

import { getAuthHeaders } from "@/lib/auth-storage";
export type AuthorGroupMemberRole = "OWNER" | "ADMIN" | "AUTHOR" | "VIEWER";

export type AuthorGroupType = "PAGE" | "COMMUNITY";

/** App visibility, independent of `is_public`. DRAFT and UNPUBLISHED are both hidden. */
export type AuthorGroupStatus = "DRAFT" | "PUBLISHED" | "UNPUBLISHED";

export function isGroupVisibleInApp(status?: AuthorGroupStatus): boolean {
  return status === "PUBLISHED";
}

export interface GroupMetadataDTO {
  id?: string;
  title: string;
  sub_title?: string | null;
  description?: string | null;
  description_long?: string | null;
  language: LanguageCode;
}

export interface GroupMetadataInput {
  title: string;
  sub_title: string;
  description: string;
  description_long?: string | null;
  language: LanguageCode;
}

export interface TagSummaryDTO {
  id: string;
  name: string;
  image?: string | null;
  image_key?: string | null;
  description?: string | null;
  featured?: boolean;
}

export interface GroupSocialLinkDTO {
  platform: string;
  url: string;
}

export interface AuthorGroupMemberDTO {
  author_id: string;
  role: AuthorGroupMemberRole;
  firstname: string;
  lastname: string;
  email: string;
}

export interface GroupLinkedSeriesDTO {
  id: string;
  metadata: GroupMetadataDTO[];
  image?: string | DashboardImageVariants | null;
  image_key?: string | null;
  author_id?: string;
  featured: boolean;
  status: string;
  plan_count?: number;
  total_days?: number;
}

export interface GroupLinkedPlanAuthorDTO {
  id: string;
  firstname: string;
  lastname: string;
  image_url?: string | null;
  image_key?: string | null;
}

export interface GroupLinkedPlanDTO {
  id: string;
  title: string;
  description?: string | null;
  language: LanguageCode;
  difficulty_level?: string;
  image_url?: string | null;
  image_key?: string | null;
  total_days?: number;
  tags: TagSummaryDTO[];
  status: string;
  featured?: boolean;
  subscription_count?: number;
  author?: GroupLinkedPlanAuthorDTO;
  start_date?: string | null;
  series_id?: string | null;
  display_order?: number | null;
  group_id?: string | null;
}

export interface AuthorGroupListItem {
  id: string;
  slug: string;
  group_type?: AuthorGroupType;
  is_public: boolean;
  /** Optional until the backend status rollout has shipped everywhere. */
  status?: AuthorGroupStatus;
  metadata: GroupMetadataDTO[];
  tags: TagSummaryDTO[];
  follower_count: number;
  joiner_count?: number;
  member_count?: number;
  avatar?: string | null;
  avatar_key?: string | null;
  avatar_url?: string | null;
  /** Current user's membership role when returned by the CMS list API. */
  my_role?: AuthorGroupMemberRole | null;
}

export interface AuthorGroupDetailDTO extends AuthorGroupListItem {
  avatar_key?: string | null;
  banner?: string | null;
  banner_key?: string | null;
  banner_url?: string | null;
  members: AuthorGroupMemberDTO[];
  social_links: GroupSocialLinkDTO[];
  series: GroupLinkedSeriesDTO[];
  plans: GroupLinkedPlanDTO[];
}

export interface AuthorGroupListResponse {
  groups: AuthorGroupListItem[];
  skip: number;
  limit: number;
  total: number;
}

export interface CreateAuthorGroupRequest {
  /** Omitted for practice spaces: the backend generates one from the name. */
  slug?: string;
  group_type?: AuthorGroupType;
  is_public?: boolean;
  avatar_key?: string | null;
  banner_key?: string | null;
  metadata: GroupMetadataInput[];
}

export interface UpdateAuthorGroupRequest {
  slug?: string;
  is_public?: boolean;
  avatar_key?: string | null;
  banner_key?: string | null;
  metadata?: GroupMetadataInput[];
}

export interface ReplaceGroupTagsRequest {
  tag_ids: string[];
}

export interface ReplaceGroupSocialLinksRequest {
  social_links: GroupSocialLinkDTO[];
}

export interface ReplaceGroupSeriesRequest {
  series_ids: string[];
}

export interface ReplaceGroupPlansRequest {
  plan_ids: string[];
}

export type AuthorGroupInviteStatus =
  | "PENDING"
  | "ACCEPTED"
  | "REJECTED"
  | "REVOKED"
  | "EXPIRED";

export interface GroupInviteDTO {
  id: string;
  group_id: string;
  group_name: string;
  target_email: string;
  role: AuthorGroupMemberRole;
  status: AuthorGroupInviteStatus;
  expires_at: string;
  accepted_at?: string | null;
  rejected_at?: string | null;
  revoked_at?: string | null;
  created_at: string;
  created_by: string;
  inviter_name?: string;
  inviter_email?: string;
}

export function formatGroupInviteInviter(invite: GroupInviteDTO): {
  name: string;
  email: string;
} {
  const email = (invite.inviter_email ?? invite.created_by).trim();
  const rawName = (invite.inviter_name ?? "").trim();
  const name =
    rawName && rawName.toLowerCase() !== email.toLowerCase() ? rawName : email;
  return { name, email };
}

export interface GroupInviteListResponse {
  invites: GroupInviteDTO[];
  total: number;
}

export interface CreateGroupInviteRequest {
  target_email: string;
  role: AuthorGroupMemberRole;
}

export interface GroupInviteCreatedResponse {
  invite: GroupInviteDTO;
  notification_id?: string | null;
}

export interface UpdateGroupMemberRoleRequest {
  role: AuthorGroupMemberRole;
}

export interface FetchGroupsParams {
  page: number;
  limit: number;
  search?: string;
  language?: string;
  tag_id?: string;
  group_type?: AuthorGroupType;
  /** Omit to list every status. */
  status?: AuthorGroupStatus;
  /** When true, lists all groups eligible as transfer targets (not only membership). */
  for_transfer?: boolean;
  /** When true, lists groups the user may filter dashboard content by (staff-wide read list). */
  for_dashboard?: boolean;
}

export const TRANSFER_GROUPS_PAGE_LIMIT = 100;

export const fetchGroups = async ({
  page,
  limit,
  search,
  language,
  tag_id,
  group_type,
  status,
  for_transfer,
  for_dashboard,
}: FetchGroupsParams): Promise<AuthorGroupListResponse> => {
  const requestLimit = for_transfer
    ? Math.min(Math.max(limit, 1), TRANSFER_GROUPS_PAGE_LIMIT)
    : limit;
  const skip = (page - 1) * requestLimit;
  const { data } = await axiosInstance.get<AuthorGroupListResponse>(
    `/api/v1/cms/author/groups`,
    {
      headers: getAuthHeaders(),
      params: {
        skip,
        limit: requestLimit,
        ...(search?.trim() && { search: search.trim() }),
        ...(language && { language }),
        ...(tag_id && { tag_id }),
        ...(group_type && { group_type }),
        ...(status && { status }),
        ...(for_transfer && { for_transfer: true }),
        ...(for_dashboard && { for_dashboard: true }),
      },
    },
  );
  return data;
};

function groupIdsEqual(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/** Loads all transfer-target groups (paginated), excluding the source group. */
export const fetchGroupsForTransfer = async (options?: {
  search?: string;
  excludeGroupId?: string;
}): Promise<AuthorGroupListItem[]> => {
  const limit = TRANSFER_GROUPS_PAGE_LIMIT;
  const collected: AuthorGroupListItem[] = [];
  let page = 1;
  let total = 0;

  do {
    const res = await fetchGroups({
      page,
      limit,
      search: options?.search,
      for_transfer: true,
    });
    total = res.total ?? 0;
    const batch = res.groups ?? [];
    collected.push(...batch);
    if (batch.length === 0) break;
    page += 1;
  } while (collected.length < total);

  const excludeId = options?.excludeGroupId?.trim();
  if (!excludeId) return collected;
  return collected.filter((g) => !groupIdsEqual(g.id, excludeId));
};

export type DashboardGroupFilterUser = Pick<
  UserInfo,
  "platform_role" | "has_group"
>;

async function fetchAllGroupPages(
  limit: number,
  flags?: Pick<FetchGroupsParams, "for_dashboard" | "for_transfer">,
): Promise<AuthorGroupListItem[]> {
  const collected: AuthorGroupListItem[] = [];
  let page = 1;
  let total = 0;

  do {
    const res = await fetchGroups({
      page,
      limit,
      ...flags,
    });
    total = res.total ?? 0;
    const batch = res.groups ?? [];
    collected.push(...batch);
    if (batch.length === 0) break;
    page += 1;
  } while (collected.length < total);

  return collected;
}

/** Groups the user may filter dashboard content by (membership vs staff-wide list). */
export async function fetchAccessibleGroupsForDashboard(
  user?: DashboardGroupFilterUser | null,
): Promise<AuthorGroupListItem[]> {
  const platformRole = user?.platform_role;
  if (
    platformRole &&
    !usesStaffWideDashboardGroupList(platformRole) &&
    user?.has_group === false
  ) {
    return [];
  }

  const staffWideList = usesStaffWideDashboardGroupList(platformRole);
  const limit = staffWideList ? TRANSFER_GROUPS_PAGE_LIMIT : 100;

  let collected = await fetchAllGroupPages(
    limit,
    staffWideList ? { for_dashboard: true } : undefined,
  );

  // Fallback when backend has not shipped for_dashboard yet.
  if (staffWideList && collected.length === 0) {
    collected = await fetchAllGroupPages(limit);
  }

  return collected.sort((a, b) =>
    pickGroupTitle(a.metadata).localeCompare(pickGroupTitle(b.metadata)),
  );
}

export const fetchGroup = async (
  groupId: string,
): Promise<AuthorGroupDetailDTO> => {
  const { data } = await axiosInstance.get<AuthorGroupDetailDTO>(
    `/api/v1/cms/author/groups/${groupId}`,
    { headers: getAuthHeaders() },
  );
  return data;
};

export const createGroup = async (
  payload: CreateAuthorGroupRequest,
): Promise<AuthorGroupDetailDTO> => {
  const { data } = await axiosInstance.post<AuthorGroupDetailDTO>(
    `/api/v1/cms/author/groups`,
    payload,
    { headers: getAuthHeaders() },
  );
  return data;
};

export const patchGroup = async (
  groupId: string,
  payload: UpdateAuthorGroupRequest,
): Promise<AuthorGroupDetailDTO> => {
  const { data } = await axiosInstance.patch<AuthorGroupDetailDTO>(
    `/api/v1/cms/author/groups/${groupId}`,
    payload,
    { headers: getAuthHeaders() },
  );
  return data;
};

/** Non-destructive: members, content and followers persist and return on re-publish. */
export const updateGroupStatus = async (
  groupId: string,
  status: AuthorGroupStatus,
): Promise<AuthorGroupDetailDTO> => {
  const { data } = await axiosInstance.patch<AuthorGroupDetailDTO>(
    `/api/v1/cms/author/groups/${groupId}/status`,
    { status },
    { headers: getAuthHeaders() },
  );
  return data;
};

export const deleteGroup = async (groupId: string): Promise<void> => {
  await axiosInstance.delete(`/api/v1/cms/author/groups/${groupId}`, {
    headers: getAuthHeaders(),
  });
};

export const replaceGroupTags = async (
  groupId: string,
  payload: ReplaceGroupTagsRequest,
): Promise<AuthorGroupDetailDTO> => {
  const { data } = await axiosInstance.put<AuthorGroupDetailDTO>(
    `/api/v1/cms/author/groups/${groupId}/tags`,
    payload,
    { headers: getAuthHeaders() },
  );
  return data;
};

export const replaceGroupSocialLinks = async (
  groupId: string,
  payload: ReplaceGroupSocialLinksRequest,
): Promise<AuthorGroupDetailDTO> => {
  const { data } = await axiosInstance.put<AuthorGroupDetailDTO>(
    `/api/v1/cms/author/groups/${groupId}/social-links`,
    payload,
    { headers: getAuthHeaders() },
  );
  return data;
};

export const replaceGroupSeries = async (
  groupId: string,
  payload: ReplaceGroupSeriesRequest,
): Promise<AuthorGroupDetailDTO> => {
  const { data } = await axiosInstance.put<AuthorGroupDetailDTO>(
    `/api/v1/cms/author/groups/${groupId}/series`,
    payload,
    { headers: getAuthHeaders() },
  );
  return data;
};

export const replaceGroupPlans = async (
  groupId: string,
  payload: ReplaceGroupPlansRequest,
): Promise<AuthorGroupDetailDTO> => {
  const { data } = await axiosInstance.put<AuthorGroupDetailDTO>(
    `/api/v1/cms/author/groups/${groupId}/plans`,
    payload,
    { headers: getAuthHeaders() },
  );
  return data;
};

export const createGroupInvite = async (
  groupId: string,
  payload: CreateGroupInviteRequest,
): Promise<GroupInviteCreatedResponse> => {
  const { data } = await axiosInstance.post<GroupInviteCreatedResponse>(
    `/api/v1/cms/author/groups/${groupId}/members/invites`,
    payload,
    { headers: getAuthHeaders() },
  );
  return data;
};

export const fetchGroupInvites = async (
  groupId: string,
  status?: AuthorGroupInviteStatus,
): Promise<GroupInviteListResponse> => {
  const { data } = await axiosInstance.get<GroupInviteListResponse>(
    `/api/v1/cms/author/groups/${groupId}/members/invites`,
    {
      headers: getAuthHeaders(),
      params: status ? { status } : undefined,
    },
  );
  return data;
};

export const fetchMyPendingGroupInvites =
  async (): Promise<GroupInviteListResponse> => {
    const { data } = await axiosInstance.get<GroupInviteListResponse>(
      `/api/v1/cms/author/groups/invites/me`,
    );
    return data;
  };

export const acceptGroupInvite = async (
  inviteId: string,
): Promise<AuthorGroupDetailDTO> => {
  const { data } = await axiosInstance.post<AuthorGroupDetailDTO>(
    `/api/v1/cms/author/groups/invites/${inviteId}/accept`,
  );
  return data;
};

export const rejectGroupInvite = async (
  inviteId: string,
): Promise<GroupInviteDTO> => {
  const { data } = await axiosInstance.post<GroupInviteDTO>(
    `/api/v1/cms/author/groups/invites/${inviteId}/reject`,
    {},
    { headers: getAuthHeaders() },
  );
  return data;
};

export const revokeGroupInvite = async (
  groupId: string,
  inviteId: string,
): Promise<void> => {
  await axiosInstance.post(
    `/api/v1/cms/author/groups/${groupId}/members/invites/${inviteId}/revoke`,
    {},
    { headers: getAuthHeaders() },
  );
};

export function isGroupInviteExpired(invite: GroupInviteDTO): boolean {
  if (invite.status === "EXPIRED") return true;
  return new Date(invite.expires_at).getTime() <= Date.now();
}

export const updateGroupMemberRole = async (
  groupId: string,
  authorId: string,
  payload: UpdateGroupMemberRoleRequest,
): Promise<AuthorGroupDetailDTO> => {
  const { data } = await axiosInstance.patch<AuthorGroupDetailDTO>(
    `/api/v1/cms/author/groups/${groupId}/members/${authorId}/role`,
    payload,
    { headers: getAuthHeaders() },
  );
  return data;
};

export interface TransferGroupOwnershipRequest {
  new_owner_author_id: string;
}

export const transferGroupOwnership = async (
  groupId: string,
  payload: TransferGroupOwnershipRequest,
): Promise<AuthorGroupDetailDTO> => {
  const { data } = await axiosInstance.post<AuthorGroupDetailDTO>(
    `/api/v1/cms/author/groups/${groupId}/transfer-ownership`,
    payload,
    { headers: getAuthHeaders() },
  );
  return data;
};

export const removeGroupMember = async (
  groupId: string,
  authorId: string,
): Promise<void> => {
  await axiosInstance.delete(
    `/api/v1/cms/author/groups/${groupId}/members/${authorId}`,
    { headers: getAuthHeaders() },
  );
};

export function pickGroupTitle(
  metadata: GroupMetadataDTO[] | undefined,
  fallback = "Untitled group",
): string {
  if (!metadata?.length) return capitalizeFirstLetter(fallback);
  const en = metadata.find((m) => m.language === "EN");
  if (en?.title?.trim()) return capitalizeFirstLetter(en.title.trim());
  const first = metadata.find((m) => m.title?.trim());
  return capitalizeFirstLetter(first?.title?.trim() || fallback);
}

export function resolveGroupBannerUrl(group: {
  banner?: string | DashboardImageVariants | null;
  banner_url?: string | null;
  banner_key?: string | null;
}): string | null {
  const url = resolveDashboardItemImageUrl({
    image_url: group.banner_url,
    image: group.banner,
    image_key: group.banner_key,
  });
  return url || null;
}

export function resolveGroupAvatarUrl(group: {
  avatar?: string | DashboardImageVariants | null;
  avatar_url?: string | null;
  avatar_key?: string | null;
}): string | null {
  const url = resolveDashboardItemImageUrl({
    image_url: group.avatar_url,
    image: group.avatar,
    image_key: group.avatar_key,
  });
  return url || null;
}

export function pickGroupLinkedSeriesTitle(
  series: GroupLinkedSeriesDTO,
  fallback = "Untitled series",
): string {
  return pickGroupTitle(series.metadata, fallback);
}

export function groupLinkedSeriesToFkOptions(
  series: GroupLinkedSeriesDTO[],
): { id: string; title: string; image_url?: string }[] {
  return series.map((item) => {
    const image_url =
      resolveDashboardItemImageUrl({
        image: item.image,
        image_key: item.image_key,
      }) || undefined;
    return {
      id: item.id,
      title: pickGroupLinkedSeriesTitle(item),
      image_url,
    };
  });
}

export function pickGroupLinkedPlanTitle(
  plan: GroupLinkedPlanDTO,
  fallback = "Untitled plan",
): string {
  const title = plan.title?.trim() || fallback;
  return capitalizeFirstLetter(title);
}

export function groupLinkedPlansToFkOptions(
  plans: GroupLinkedPlanDTO[],
): { id: string; title: string; image_url?: string }[] {
  return plans.map((item) => {
    const image_url =
      resolveDashboardItemImageUrl({
        image_url: item.image_url,
        image_key: item.image_key,
      }) || undefined;
    return {
      id: item.id,
      title: pickGroupLinkedPlanTitle(item),
      image_url,
    };
  });
}

export function languageLabelForCode(code: LanguageCode): string {
  return getLanguageName(code) || getLanguageLabel(code);
}

export function buildGroupMetadata(
  languages: Partial<
    Record<
      LanguageCode,
      {
        title: string;
        sub_title: string;
        description: string;
        description_long?: string;
      }
    >
  >,
): GroupMetadataInput[] {
  const out: GroupMetadataInput[] = [];
  for (const code of sortLanguageCodes(Object.keys(languages))) {
    const block = languages[code];
    if (!block) continue;
    const descriptionLong = block.description_long?.trim() ?? "";
    out.push({
      language: code,
      title: block.title.trim(),
      sub_title: block.sub_title.trim(),
      description: block.description.trim(),
      description_long: descriptionLong || null,
    });
  }
  return out;
}
