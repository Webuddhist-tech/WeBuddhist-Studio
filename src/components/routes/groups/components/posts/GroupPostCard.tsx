import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  IoChatbubbleOutline,
  IoEllipsisHorizontal,
  IoHeart,
  IoHeartOutline,
  IoOpenOutline,
  IoPencilOutline,
  IoTrashOutline,
} from "react-icons/io5";
import { toast } from "sonner";
import { useTranslate } from "@tolgee/react";
import { Pecha } from "@/components/ui/shadimport";
import { getApiErrorMessage } from "@/lib/apiErrors";
import type { UserInfo } from "@/hooks/useUserInfo";
import type { GroupPostDTO } from "../../api/groupPostsApi";
import { likePost, unlikePost } from "../../api/groupPostInteractionsApi";
import { formatRelativeTime } from "../../lib/relativeTime";
import PostComments from "./PostComments";
import PostMediaGallery from "./PostMediaGallery";

type GroupPostCardProps = {
  post: GroupPostDTO;
  groupTitle: string;
  groupAvatarUrl?: string | null;
  currentUser: UserInfo | null | undefined;
  canWrite: boolean;
  interactionsAvailable: boolean;
  onEdit: () => void;
  onDelete: () => void;
};

const relativeTime = (value: string): string => formatRelativeTime(value);

const GroupPostCard = ({
  post,
  groupTitle,
  groupAvatarUrl,
  currentUser,
  canWrite,
  interactionsAvailable,
  onEdit,
  onDelete,
}: GroupPostCardProps) => {
  const { t } = useTranslate();
  const queryClient = useQueryClient();
  const [liked, setLiked] = useState(Boolean(post.liked_by_me));
  const [likeCount, setLikeCount] = useState(post.like_count ?? 0);
  const [commentCount, setCommentCount] = useState(post.comment_count ?? 0);
  const [commentsOpen, setCommentsOpen] = useState(false);

  useEffect(() => {
    setLiked(Boolean(post.liked_by_me));
    setLikeCount(post.like_count ?? 0);
    setCommentCount(post.comment_count ?? 0);
  }, [post.comment_count, post.like_count, post.liked_by_me]);

  const likeMutation = useMutation({
    mutationFn: async () => {
      if (liked) {
        await unlikePost(post.id);
        return { liked: false, likeCount: Math.max(0, likeCount - 1) };
      }
      const response = await likePost(post.id);
      return { liked: true, likeCount: response.like_count };
    },
    onMutate: () => {
      const previous = { liked, likeCount };
      setLiked(!liked);
      setLikeCount((current) => Math.max(0, current + (liked ? -1 : 1)));
      return previous;
    },
    onSuccess: (result) => {
      setLiked(result.liked);
      setLikeCount(result.likeCount);
      queryClient.invalidateQueries({ queryKey: ["cms-group-posts"] });
    },
    onError: (error, _variables, previous) => {
      if (previous) {
        setLiked(previous.liked);
        setLikeCount(previous.likeCount);
      }
      toast.error(
        getApiErrorMessage(error, t("studio.groups.posts.card.like_error")),
      );
    },
  });

  const authorName = post.creator_name?.trim() || groupTitle;
  const authorInitial = authorName.charAt(0).toUpperCase() || "G";
  const authorAvatar = post.creator_image_url || groupAvatarUrl;

  return (
    <article className="overflow-hidden rounded-xl border bg-card shadow-sm">
      <header className="flex items-center gap-3 px-4 py-3">
        <Pecha.Avatar className="size-10 shrink-0">
          <Pecha.AvatarImage src={authorAvatar ?? undefined} />
          <Pecha.AvatarFallback>{authorInitial}</Pecha.AvatarFallback>
        </Pecha.Avatar>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">{authorName}</div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{relativeTime(post.published_at || post.created_at)}</span>
            {post.status !== "PUBLISHED" ? (
              <>
                <span>·</span>
                <span className="font-medium">
                  {t("studio.groups.posts.card.hidden")}
                </span>
              </>
            ) : null}
          </div>
        </div>

        {canWrite ? (
          <Pecha.DropdownMenu>
            <Pecha.DropdownMenuTrigger asChild>
              <Pecha.Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label={t("studio.groups.posts.card.actions_aria")}
                className="size-9 p-0"
              >
                <IoEllipsisHorizontal className="size-5" />
              </Pecha.Button>
            </Pecha.DropdownMenuTrigger>
            <Pecha.DropdownMenuContent align="end">
              <Pecha.DropdownMenuItem onClick={onEdit}>
                <IoPencilOutline className="mr-2 size-4" />
                {t("studio.groups.posts.card.edit")}
              </Pecha.DropdownMenuItem>
              <Pecha.DropdownMenuSeparator />
              <Pecha.DropdownMenuItem
                onClick={onDelete}
                className="text-destructive focus:text-destructive"
              >
                <IoTrashOutline className="mr-2 size-4" />
                {t("studio.groups.posts.card.delete")}
              </Pecha.DropdownMenuItem>
            </Pecha.DropdownMenuContent>
          </Pecha.DropdownMenu>
        ) : null}
      </header>

      {post.caption?.trim() ? (
        <p className="whitespace-pre-wrap break-words px-4 pb-3 text-sm leading-6">
          {post.caption}
        </p>
      ) : null}

      <PostMediaGallery media={post.media} />

      {post.links.length > 0 ? (
        <div className="space-y-2 border-t px-4 py-3">
          {[...post.links]
            .sort((left, right) => left.display_order - right.display_order)
            .map((link) => (
              <a
                key={link.id}
                href={link.url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between rounded-lg border bg-muted/40 px-3 py-2 text-sm transition hover:bg-muted"
              >
                <span className="min-w-0 truncate font-medium">
                  {link.label?.trim() || link.url}
                </span>
                <IoOpenOutline className="ml-3 size-4 shrink-0" />
              </a>
            ))}
        </div>
      ) : null}

      <div className="px-4 py-3">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="font-medium">
            {likeCount === 1
              ? t("studio.groups.posts.card.likes_one")
              : t("studio.groups.posts.card.likes_other", { count: likeCount })}
          </span>
          <button
            type="button"
            disabled={!interactionsAvailable}
            onClick={() => setCommentsOpen((current) => !current)}
            className="text-muted-foreground hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
          >
            {commentCount === 1
              ? t("studio.groups.posts.card.comments_one")
              : t("studio.groups.posts.card.comments_other", {
                  count: commentCount,
                })}
          </button>
        </div>

        <div className="grid grid-cols-2 border-t pt-1">
          <button
            type="button"
            disabled={!interactionsAvailable || likeMutation.isPending}
            onClick={() => likeMutation.mutate()}
            className={`flex items-center justify-center gap-2 rounded-md py-2 text-sm font-medium transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50 ${
              liked ? "text-[#A51C21]" : "text-muted-foreground"
            }`}
          >
            {liked ? (
              <IoHeart className="size-5" />
            ) : (
              <IoHeartOutline className="size-5" />
            )}
            {t("studio.groups.posts.card.like")}
          </button>
          <button
            type="button"
            disabled={!interactionsAvailable}
            onClick={() => setCommentsOpen((current) => !current)}
            className="flex items-center justify-center gap-2 rounded-md py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
          >
            <IoChatbubbleOutline className="size-5" />
            {t("studio.groups.posts.card.comment")}
          </button>
        </div>

        {!interactionsAvailable ? (
          <p className="pt-2 text-center text-xs text-muted-foreground">
            {t("studio.groups.posts.card.interactions_unavailable")}
          </p>
        ) : null}
      </div>

      {commentsOpen && interactionsAvailable ? (
        <PostComments
          postId={post.id}
          currentUser={currentUser}
          onCommentCountChange={(delta) =>
            setCommentCount((current) => Math.max(0, current + delta))
          }
        />
      ) : null}
    </article>
  );
};

export default GroupPostCard;
