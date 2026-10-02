import { useMemo, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { IoHeart, IoHeartOutline, IoTrashOutline } from "react-icons/io5";
import { toast } from "sonner";
import { Pecha } from "@/components/ui/shadimport";
import { getApiErrorMessage } from "@/lib/apiErrors";
import type { UserInfo } from "@/hooks/useUserInfo";
import {
  createPostComment,
  deletePostComment,
  fetchPostComments,
  likeComment,
  unlikeComment,
  type GroupPostCommentDTO,
  type GroupPostCommentsResponse,
} from "../../api/groupPostInteractionsApi";

type PostCommentsProps = {
  postId: string;
  currentUser: UserInfo | null | undefined;
  onCommentCountChange: (delta: number) => void;
};

const commentQueryKey = (postId: string) =>
  ["group-post-comments", postId] as const;

const relativeTime = (value: string): string => {
  try {
    return formatDistanceToNow(new Date(value), { addSuffix: true });
  } catch {
    return "";
  }
};

const displayNameFromEmail = (email: string | null | undefined): string =>
  email?.split("@")[0] || "User";

const commentInitial = (email: string | null | undefined): string =>
  displayNameFromEmail(email).charAt(0).toUpperCase() || "U";

const PostComments = ({
  postId,
  currentUser,
  onCommentCountChange,
}: PostCommentsProps) => {
  const queryClient = useQueryClient();
  const [commentText, setCommentText] = useState("");
  const [replyingTo, setReplyingTo] = useState<GroupPostCommentDTO | null>(
    null,
  );

  const commentsQuery = useQuery({
    queryKey: commentQueryKey(postId),
    queryFn: () => fetchPostComments(postId),
    refetchOnWindowFocus: false,
  });

  const comments = useMemo(
    () => commentsQuery.data?.comments ?? [],
    [commentsQuery.data],
  );

  const rootComments = useMemo(() => {
    const commentIds = new Set(comments.map((comment) => comment.id));
    return comments.filter(
      (comment) =>
        !comment.parent_comment_id ||
        !commentIds.has(comment.parent_comment_id),
    );
  }, [comments]);

  const repliesByParent = useMemo(() => {
    const replies = new Map<string, GroupPostCommentDTO[]>();
    comments.forEach((comment) => {
      if (!comment.parent_comment_id) return;
      const existing = replies.get(comment.parent_comment_id) ?? [];
      existing.push(comment);
      replies.set(comment.parent_comment_id, existing);
    });
    return replies;
  }, [comments]);

  const createMutation = useMutation({
    mutationFn: () =>
      createPostComment(postId, commentText, replyingTo?.id ?? undefined),
    onSuccess: (created) => {
      queryClient.setQueryData<GroupPostCommentsResponse>(
        commentQueryKey(postId),
        (current) => ({
          comments: [created, ...(current?.comments ?? [])],
          skip: 0,
          limit: current?.limit ?? 100,
          total: (current?.total ?? 0) + 1,
        }),
      );
      setCommentText("");
      setReplyingTo(null);
      onCommentCountChange(1);
    },
    onError: (error) =>
      toast.error(getApiErrorMessage(error, "Could not add comment")),
  });

  const deleteMutation = useMutation({
    mutationFn: (commentId: string) => deletePostComment(commentId),
    onSuccess: (_, commentId) => {
      queryClient.setQueryData<GroupPostCommentsResponse>(
        commentQueryKey(postId),
        (current) =>
          current
            ? {
                ...current,
                comments: current.comments.filter(
                  (comment) => comment.id !== commentId,
                ),
                total: Math.max(0, current.total - 1),
              }
            : current,
      );
      onCommentCountChange(-1);
    },
    onError: (error) =>
      toast.error(getApiErrorMessage(error, "Could not delete comment")),
  });

  const toggleCommentLike = useMutation({
    mutationFn: async (comment: GroupPostCommentDTO) => {
      if (comment.liked_by_me) {
        await unlikeComment(comment.id);
        return { commentId: comment.id, liked: false };
      }
      const response = await likeComment(comment.id);
      return {
        commentId: comment.id,
        liked: true,
        likeCount: response.like_count,
      };
    },
    onMutate: async (comment) => {
      await queryClient.cancelQueries({ queryKey: commentQueryKey(postId) });
      const previous = queryClient.getQueryData<GroupPostCommentsResponse>(
        commentQueryKey(postId),
      );
      queryClient.setQueryData<GroupPostCommentsResponse>(
        commentQueryKey(postId),
        (current) =>
          current
            ? {
                ...current,
                comments: current.comments.map((item) =>
                  item.id === comment.id
                    ? {
                        ...item,
                        liked_by_me: !item.liked_by_me,
                        like_count: Math.max(
                          0,
                          item.like_count + (item.liked_by_me ? -1 : 1),
                        ),
                      }
                    : item,
                ),
              }
            : current,
      );
      return { previous };
    },
    onSuccess: (result) => {
      if (result.likeCount == null) return;
      queryClient.setQueryData<GroupPostCommentsResponse>(
        commentQueryKey(postId),
        (current) =>
          current
            ? {
                ...current,
                comments: current.comments.map((item) =>
                  item.id === result.commentId
                    ? { ...item, like_count: result.likeCount }
                    : item,
                ),
              }
            : current,
      );
    },
    onError: (error, _comment, context) => {
      if (context?.previous) {
        queryClient.setQueryData(commentQueryKey(postId), context.previous);
      }
      toast.error(getApiErrorMessage(error, "Could not update comment like"));
    },
  });

  const submitComment = () => {
    if (!commentText.trim() || createMutation.isPending) return;
    createMutation.mutate();
  };

  const renderComment = (comment: GroupPostCommentDTO, depth = 0) => {
    const replies = repliesByParent.get(comment.id) ?? [];
    const isOwnComment =
      Boolean(currentUser?.email && comment.user_email) &&
      currentUser?.email?.toLowerCase() === comment.user_email?.toLowerCase();

    return (
      <div key={comment.id} className={depth > 0 ? "ml-9 mt-3" : "mt-4"}>
        <div className="flex gap-2.5">
          <Pecha.Avatar className="size-8 shrink-0">
            <Pecha.AvatarFallback className="text-xs">
              {commentInitial(comment.user_email)}
            </Pecha.AvatarFallback>
          </Pecha.Avatar>
          <div className="min-w-0 flex-1">
            <div className="rounded-2xl bg-muted px-3 py-2">
              <div className="text-xs font-semibold">
                {displayNameFromEmail(comment.user_email)}
              </div>
              <p className="whitespace-pre-wrap break-words text-sm">
                {comment.text}
              </p>
            </div>
            <div className="mt-1 flex items-center gap-3 px-2 text-xs text-muted-foreground">
              <span>{relativeTime(comment.created_at)}</span>
              <button
                type="button"
                onClick={() => setReplyingTo(comment)}
                className="font-medium hover:text-foreground"
              >
                Reply
              </button>
              <button
                type="button"
                aria-label={
                  comment.liked_by_me ? "Unlike comment" : "Like comment"
                }
                onClick={() => toggleCommentLike.mutate(comment)}
                className={`inline-flex items-center gap-1 font-medium hover:text-foreground ${
                  comment.liked_by_me ? "text-[#A51C21]" : ""
                }`}
              >
                {comment.liked_by_me ? (
                  <IoHeart className="size-3.5" />
                ) : (
                  <IoHeartOutline className="size-3.5" />
                )}
                {comment.like_count > 0 ? comment.like_count : ""}
              </button>
              {isOwnComment ? (
                <button
                  type="button"
                  aria-label="Delete comment"
                  disabled={deleteMutation.isPending}
                  onClick={() => deleteMutation.mutate(comment.id)}
                  className="hover:text-destructive"
                >
                  <IoTrashOutline className="size-3.5" />
                </button>
              ) : null}
            </div>
          </div>
        </div>
        {replies.map((reply) => renderComment(reply, depth + 1))}
      </div>
    );
  };

  return (
    <div className="border-t px-4 pb-4">
      {commentsQuery.isLoading ? (
        <div className="space-y-3 pt-4">
          <Pecha.Skeleton className="h-12 w-full rounded-2xl" />
          <Pecha.Skeleton className="h-12 w-4/5 rounded-2xl" />
        </div>
      ) : commentsQuery.isError ? (
        <p className="py-4 text-sm text-destructive">
          {getApiErrorMessage(commentsQuery.error, "Could not load comments")}
        </p>
      ) : rootComments.length > 0 ? (
        <div>{rootComments.map((comment) => renderComment(comment))}</div>
      ) : (
        <p className="py-4 text-sm text-muted-foreground">
          No comments yet. Start the conversation.
        </p>
      )}

      {replyingTo ? (
        <div className="mt-4 flex items-center justify-between rounded-md bg-muted px-3 py-2 text-xs">
          <span>Replying to {displayNameFromEmail(replyingTo.user_email)}</span>
          <button
            type="button"
            onClick={() => setReplyingTo(null)}
            className="font-medium hover:text-foreground"
          >
            Cancel
          </button>
        </div>
      ) : null}

      <div className="mt-4 flex items-end gap-2">
        <Pecha.Avatar className="size-8 shrink-0">
          <Pecha.AvatarImage
            src={
              currentUser?.image?.thumbnail ??
              currentUser?.image_url ??
              undefined
            }
          />
          <Pecha.AvatarFallback className="text-xs">
            {currentUser?.firstname?.charAt(0) ??
              currentUser?.email?.charAt(0).toUpperCase() ??
              "U"}
          </Pecha.AvatarFallback>
        </Pecha.Avatar>
        <Pecha.Textarea
          value={commentText}
          onChange={(event) => setCommentText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              submitComment();
            }
          }}
          rows={1}
          maxLength={5000}
          placeholder={replyingTo ? "Write a reply…" : "Write a comment…"}
          className="min-h-10 resize-none rounded-2xl"
        />
        <Pecha.Button
          type="button"
          size="sm"
          disabled={!commentText.trim() || createMutation.isPending}
          onClick={submitComment}
          className="bg-[#A51C21] text-white hover:bg-[#A51C21]/90"
        >
          {createMutation.isPending ? "Posting…" : "Post"}
        </Pecha.Button>
      </div>
    </div>
  );
};

export default PostComments;
