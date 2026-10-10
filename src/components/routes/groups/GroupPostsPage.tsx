import { useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { IoMdAdd } from "react-icons/io";
import { toast } from "sonner";
import { useTranslate } from "@tolgee/react";
import { Pecha } from "@/components/ui/shadimport";
import { Pagination } from "@/components/ui/molecules/pagination/Pagination";
import { getApiErrorMessage } from "@/lib/apiErrors";
import { ROUTES } from "@/routes/paths";
import type { GroupOutletContext } from "./GroupLayout";
import { canWritePosts } from "./lib/postPermissions";
import GroupPostCard from "./components/posts/GroupPostCard";
import {
  deleteGroupPost,
  fetchGroupPosts,
  postCaptionPreview,
  type GroupPostDTO,
} from "./api/groupPostsApi";
import { pickGroupTitle, resolveGroupAvatarUrl } from "./api/groupsApi";

const PAGE_SIZE = 10;

const GroupPostsPage = () => {
  const { t } = useTranslate();
  const { group, groupId, myRole, userInfo, readOnlyPlatform } =
    useOutletContext<GroupOutletContext>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [pendingDelete, setPendingDelete] = useState<GroupPostDTO | null>(null);

  const canWrite =
    !readOnlyPlatform && canWritePosts(myRole, userInfo?.platform_role);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["cms-group-posts", groupId, page],
    queryFn: () => fetchGroupPosts(groupId, (page - 1) * PAGE_SIZE, PAGE_SIZE),
    enabled: Boolean(groupId),
    refetchOnWindowFocus: false,
  });

  const posts = data?.posts ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const groupTitle = pickGroupTitle(group.metadata);
  const groupAvatarUrl = resolveGroupAvatarUrl(group);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteGroupPost(groupId, id),
    onSuccess: () => {
      toast.success(t("studio.groups.pages.posts.deleted"));
      setPendingDelete(null);
      queryClient.invalidateQueries({ queryKey: ["cms-group-posts", groupId] });
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  const renderFeed = () => {
    if (isLoading) {
      return (
        <div className="space-y-5">
          {[0, 1].map((item) => (
            <div key={item} className="space-y-3 rounded-xl border p-4">
              <div className="flex items-center gap-3">
                <Pecha.Skeleton className="size-10 rounded-full" />
                <div className="space-y-2">
                  <Pecha.Skeleton className="h-4 w-32" />
                  <Pecha.Skeleton className="h-3 w-20" />
                </div>
              </div>
              <Pecha.Skeleton className="h-4 w-4/5" />
              <Pecha.Skeleton className="aspect-square w-full rounded-lg" />
            </div>
          ))}
        </div>
      );
    }

    if (isError) {
      return (
        <div className="rounded-xl border p-6 text-center text-destructive">
          {getApiErrorMessage(
            error,
            t("studio.groups.pages.posts.load_failed"),
          )}
        </div>
      );
    }

    if (posts.length === 0) {
      return (
        <div className="rounded-xl border border-dashed px-6 py-16 text-center">
          <p className="font-medium">{t("studio.groups.pages.posts.empty")}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {canWrite
              ? t("studio.groups.pages.posts.empty_hint_writer")
              : t("studio.groups.pages.posts.empty_hint_reader")}
          </p>
        </div>
      );
    }

    return (
      <div className="space-y-5">
        {posts.map((post) => (
          <GroupPostCard
            key={post.id}
            post={post}
            groupTitle={groupTitle}
            groupAvatarUrl={groupAvatarUrl}
            currentUser={userInfo}
            canWrite={canWrite}
            interactionsAvailable={
              group.is_public && post.status === "PUBLISHED"
            }
            onEdit={() => navigate(ROUTES.groupPostEdit(groupId, post.id))}
            onDelete={() => setPendingDelete(post)}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold">
            {t("studio.groups.pages.posts.title")}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t("studio.groups.pages.posts.subtitle")}
          </p>
        </div>
        {canWrite ? (
          <Pecha.Button
            className="gap-1 bg-[#A51C21] text-white hover:bg-[#A51C21]/90"
            onClick={() => navigate(ROUTES.groupPostNew(groupId))}
          >
            <IoMdAdd className="h-4 w-4" />{" "}
            {t("studio.groups.pages.posts.new_post")}
          </Pecha.Button>
        ) : null}
      </div>

      {renderFeed()}

      {totalPages > 1 ? (
        <div className="rounded-xl border bg-card py-2">
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            onPageChange={setPage}
          />
        </div>
      ) : null}

      <Pecha.AlertDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
      >
        <Pecha.AlertDialogContent>
          <Pecha.AlertDialogHeader>
            <Pecha.AlertDialogTitle>
              {t("studio.groups.pages.posts.delete_title")}
            </Pecha.AlertDialogTitle>
            <Pecha.AlertDialogDescription>
              {t("studio.groups.pages.posts.delete_description", {
                caption: pendingDelete ? postCaptionPreview(pendingDelete) : "",
              })}
            </Pecha.AlertDialogDescription>
          </Pecha.AlertDialogHeader>
          <Pecha.AlertDialogFooter>
            <Pecha.AlertDialogCancel disabled={deleteMutation.isPending}>
              {t("studio.common.cancel")}
            </Pecha.AlertDialogCancel>
            <Pecha.AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteMutation.isPending}
              onClick={(e) => {
                e.preventDefault();
                if (pendingDelete) deleteMutation.mutate(pendingDelete.id);
              }}
            >
              {deleteMutation.isPending
                ? t("studio.common.deleting")
                : t("studio.common.delete")}
            </Pecha.AlertDialogAction>
          </Pecha.AlertDialogFooter>
        </Pecha.AlertDialogContent>
      </Pecha.AlertDialog>
    </div>
  );
};

export default GroupPostsPage;
