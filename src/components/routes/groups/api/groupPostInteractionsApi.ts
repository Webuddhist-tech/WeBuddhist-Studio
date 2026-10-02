import axiosInstance from "@/config/axios-config";

const POST_BASE_URL = "/api/v1/groups/author/posts";
const COMMENT_BASE_URL = "/api/v1/groups/author/comments";

export interface GroupPostCommentDTO {
  id: string;
  post_id: string;
  user_id: string;
  parent_comment_id?: string | null;
  user_email: string | null;
  text: string;
  created_at: string;
  updated_at?: string | null;
  like_count: number;
  liked_by_me: boolean;
}

export interface GroupPostCommentsResponse {
  comments: GroupPostCommentDTO[];
  skip: number;
  limit: number;
  total: number;
}

export interface LikePostResponse {
  post_id: string;
  user_id: string;
  liked: boolean;
  like_count: number;
  created_at: string;
  is_new: boolean;
}

export interface LikeCommentResponse {
  comment_id: string;
  user_id: string;
  liked: boolean;
  like_count: number;
  created_at: string;
  is_new: boolean;
}

export const likePost = async (postId: string): Promise<LikePostResponse> => {
  const { data } = await axiosInstance.post<LikePostResponse>(
    `${POST_BASE_URL}/${postId}/likes`,
  );
  return data;
};

export const unlikePost = async (postId: string): Promise<void> => {
  await axiosInstance.delete(`${POST_BASE_URL}/${postId}/likes`);
};

export const fetchPostComments = async (
  postId: string,
  skip = 0,
  limit = 100,
): Promise<GroupPostCommentsResponse> => {
  const { data } = await axiosInstance.get<GroupPostCommentsResponse>(
    `${POST_BASE_URL}/${postId}/comments`,
    { params: { skip, limit } },
  );
  return data;
};

export const createPostComment = async (
  postId: string,
  text: string,
  parentCommentId?: string,
): Promise<GroupPostCommentDTO> => {
  const { data } = await axiosInstance.post<GroupPostCommentDTO>(
    `${POST_BASE_URL}/${postId}/comments`,
    {
      text: text.trim(),
      ...(parentCommentId ? { parent_comment_id: parentCommentId } : {}),
    },
  );
  return data;
};

export const deletePostComment = async (commentId: string): Promise<void> => {
  await axiosInstance.delete(`${COMMENT_BASE_URL}/${commentId}`);
};

export const likeComment = async (
  commentId: string,
): Promise<LikeCommentResponse> => {
  const { data } = await axiosInstance.post<LikeCommentResponse>(
    `${COMMENT_BASE_URL}/${commentId}/likes`,
  );
  return data;
};

export const unlikeComment = async (commentId: string): Promise<void> => {
  await axiosInstance.delete(`${COMMENT_BASE_URL}/${commentId}/likes`);
};
