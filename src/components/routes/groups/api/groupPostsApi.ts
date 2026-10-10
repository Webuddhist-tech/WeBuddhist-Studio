import axiosInstance from "@/config/axios-config";
import { tolgee } from "@/i18n/tolgee";
import { uploadImageToS3 } from "@/components/routes/task/api/taskApi";
import type {
  PostFormData,
  PostLinkRow,
  PostMediaRow,
  PostMediaType,
  PostStatus,
} from "@/schema/PostSchema";

const BASE_URL = "/api/v1/cms/author/groups";

export interface GroupPostMediaDTO {
  id: string;
  media_type: string;
  url?: string | null;
  thumbnail_url?: string | null;
  width?: number | null;
  height?: number | null;
  duration_ms?: number | null;
  display_order: number;
}

export interface GroupPostLinkDTO {
  id: string;
  type: string;
  url: string;
  label?: string | null;
  display_order: number;
}

export interface GroupPostDTO {
  id: string;
  group_id: string;
  caption?: string | null;
  status: string;
  published_at: string;
  media: GroupPostMediaDTO[];
  links: GroupPostLinkDTO[];
  creator_name?: string | null;
  creator_image_url?: string | null;
  like_count: number;
  comment_count: number;
  created_at: string;
  updated_at?: string | null;
  liked_by_me?: boolean;
}

export interface GroupPostsResponse {
  posts: GroupPostDTO[];
  skip: number;
  limit: number;
  total: number;
}

export interface GroupPostMediaInput {
  media_type: PostMediaType;
  media_key: string;
  thumbnail_key?: string;
  width?: number;
  height?: number;
  duration_ms?: number;
  display_order: number;
}

export interface GroupPostLinkInput {
  type: string;
  url: string;
  label?: string;
  display_order: number;
}

export interface CreateGroupPostRequest {
  caption?: string;
  status?: PostStatus;
  published_at?: string;
  media?: GroupPostMediaInput[];
  links?: GroupPostLinkInput[];
}

export interface UpdateGroupPostRequest {
  caption?: string | null;
  status?: PostStatus;
  published_at?: string;
}

export const fetchGroupPosts = async (
  groupId: string,
  skip = 0,
  limit = 20,
  status?: PostStatus,
): Promise<GroupPostsResponse> => {
  const { data } = await axiosInstance.get<GroupPostsResponse>(
    `${BASE_URL}/${groupId}/posts`,
    { params: { skip, limit, ...(status ? { status } : {}) } },
  );
  return data;
};

export const fetchGroupPost = async (
  groupId: string,
  postId: string,
): Promise<GroupPostDTO> => {
  const { data } = await axiosInstance.get<GroupPostDTO>(
    `${BASE_URL}/${groupId}/posts/${postId}`,
  );
  return data;
};

export const createGroupPost = async (
  groupId: string,
  body: CreateGroupPostRequest,
): Promise<GroupPostDTO> => {
  const { data } = await axiosInstance.post<GroupPostDTO>(
    `${BASE_URL}/${groupId}/posts`,
    body,
  );
  return data;
};

export const updateGroupPost = async (
  groupId: string,
  postId: string,
  body: UpdateGroupPostRequest,
): Promise<GroupPostDTO> => {
  const { data } = await axiosInstance.patch<GroupPostDTO>(
    `${BASE_URL}/${groupId}/posts/${postId}`,
    body,
  );
  return data;
};

export const replaceGroupPostMedia = async (
  groupId: string,
  postId: string,
  media: GroupPostMediaInput[],
): Promise<GroupPostDTO> => {
  const { data } = await axiosInstance.put<GroupPostDTO>(
    `${BASE_URL}/${groupId}/posts/${postId}/media`,
    { media },
  );
  return data;
};

export const replaceGroupPostLinks = async (
  groupId: string,
  postId: string,
  links: GroupPostLinkInput[],
): Promise<GroupPostDTO> => {
  const { data } = await axiosInstance.put<GroupPostDTO>(
    `${BASE_URL}/${groupId}/posts/${postId}/links`,
    { links },
  );
  return data;
};

export const deleteGroupPost = async (
  groupId: string,
  postId: string,
): Promise<void> => {
  await axiosInstance.delete(`${BASE_URL}/${groupId}/posts/${postId}`);
};

export const uploadPostImage = async (file: File): Promise<string> => {
  const { key } = await uploadImageToS3(file, "");
  return key;
};

export function postCaptionPreview(post: GroupPostDTO, max = 80): string {
  const caption = post.caption?.trim();
  if (caption) {
    return caption.length > max ? `${caption.slice(0, max)}…` : caption;
  }
  if (post.media.length > 0) {
    return post.media.length === 1
      ? tolgee.t("studio.groups.posts.summary.media_items_one")
      : tolgee.t("studio.groups.posts.summary.media_items_other", {
          count: post.media.length,
        });
  }
  if (post.links.length > 0) {
    return post.links[0].label?.trim() || post.links[0].url;
  }
  return tolgee.t("studio.groups.posts.summary.untitled");
}

export function postThumbnail(post: GroupPostDTO): string | null {
  const first = [...post.media].sort(
    (a, b) => a.display_order - b.display_order,
  )[0];
  if (!first) return null;
  if (first.thumbnail_url) return first.thumbnail_url;
  if (first.url) return first.url;
  return null;
}

function buildLinksInput(rows: PostLinkRow[]): GroupPostLinkInput[] {
  return rows.map((row, index) => {
    const label = row.label.trim();
    return {
      type: row.type.trim(),
      url: row.url.trim(),
      display_order: index + 1,
      ...(label ? { label } : {}),
    };
  });
}

function buildMediaInput(rows: PostMediaRow[]): GroupPostMediaInput[] {
  return rows
    .filter((row) => row.media_key.trim())
    .map((row, index) => ({
      media_type: row.media_type,
      media_key: row.media_key.trim(),
      display_order: index + 1,
      ...(row.width != null ? { width: row.width } : {}),
      ...(row.height != null ? { height: row.height } : {}),
      ...(row.duration_ms != null ? { duration_ms: row.duration_ms } : {}),
    }));
}

function linksEqual(a: PostLinkRow[], b: PostLinkRow[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i].type.trim() !== b[i].type.trim()) return false;
    if (a[i].url.trim() !== b[i].url.trim()) return false;
    if (a[i].label.trim() !== b[i].label.trim()) return false;
  }
  return true;
}

export function mapPostToFormData(post: GroupPostDTO): PostFormData {
  const media: PostMediaRow[] = [...post.media]
    .sort((a, b) => a.display_order - b.display_order)
    .map((item) => ({
      media_type: (item.media_type as PostMediaType) || "IMAGE",
      media_key: "",
      preview_url: item.thumbnail_url || item.url || "",
      width: item.width ?? null,
      height: item.height ?? null,
      duration_ms: item.duration_ms ?? null,
      is_existing: true,
    }));

  const links = [...(post.links ?? [])]
    .sort((a, b) => a.display_order - b.display_order)
    .map(
      (link): PostLinkRow => ({
        type: link.type?.trim() || "EXTERNAL",
        url: link.url?.trim() ?? "",
        label: link.label?.trim() ?? "",
      }),
    );

  const status =
    post.status === "HIDDEN" ? ("HIDDEN" as const) : ("PUBLISHED" as const);

  return {
    caption: post.caption?.trim() ?? "",
    status,
    media,
    links,
    media_dirty: false,
  };
}

export function buildCreatePostBody(
  data: PostFormData,
): CreateGroupPostRequest {
  const caption = data.caption.trim();
  const media = buildMediaInput(data.media);
  const links = buildLinksInput(data.links);
  return {
    status: data.status,
    ...(caption ? { caption } : {}),
    ...(media.length ? { media } : {}),
    ...(links.length ? { links } : {}),
  };
}

export async function saveGroupPostEdit(params: {
  groupId: string;
  postId: string;
  data: PostFormData;
  original: PostFormData;
}): Promise<GroupPostDTO> {
  const { groupId, postId, data, original } = params;
  let latest: GroupPostDTO | null = null;

  const captionChanged = data.caption.trim() !== original.caption.trim();
  const statusChanged = data.status !== original.status;

  if (captionChanged || statusChanged) {
    latest = await updateGroupPost(groupId, postId, {
      ...(captionChanged ? { caption: data.caption.trim() } : {}),
      ...(statusChanged ? { status: data.status } : {}),
    });
  }

  if (data.media_dirty) {
    latest = await replaceGroupPostMedia(
      groupId,
      postId,
      buildMediaInput(data.media),
    );
  }

  if (!linksEqual(data.links, original.links)) {
    latest = await replaceGroupPostLinks(
      groupId,
      postId,
      buildLinksInput(data.links),
    );
  }

  if (latest) return latest;
  return fetchGroupPost(groupId, postId);
}
