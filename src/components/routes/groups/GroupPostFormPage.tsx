import { useEffect, useRef } from "react";
import { useNavigate, useOutletContext, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTranslate } from "@tolgee/react";
import { Pecha } from "@/components/ui/shadimport";
import { getApiErrorMessage } from "@/lib/apiErrors";
import { ROUTES } from "@/routes/paths";
import { POST_STATUSES, type PostFormData } from "@/schema/PostSchema";
import type { GroupOutletContext } from "./GroupLayout";
import { usePostForm } from "./hooks/usePostForm";
import { canWritePosts } from "./lib/postPermissions";
import PostLinksSection from "./components/posts/PostLinksSection";
import PostMediaSection from "./components/posts/PostMediaSection";
import {
  buildCreatePostBody,
  createGroupPost,
  fetchGroupPost,
  mapPostToFormData,
  saveGroupPostEdit,
} from "./api/groupPostsApi";

const GroupPostFormPage = () => {
  const { t } = useTranslate();
  const { groupId, postId } = useParams<{
    groupId: string;
    postId?: string;
  }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { myRole, userInfo, readOnlyPlatform } =
    useOutletContext<GroupOutletContext>();

  const isNew = !postId;
  const canWrite =
    !readOnlyPlatform && canWritePosts(myRole, userInfo?.platform_role);
  const readOnly = !canWrite;

  const {
    form,
    linkRows,
    mediaRows,
    addLinkRow,
    removeLinkRow,
    moveLinkRow,
    addMediaRow,
    removeMediaRow,
    moveMediaRow,
    startMediaReplace,
    clearMedia,
  } = usePostForm();

  const postQuery = useQuery({
    queryKey: ["cms-group-post", groupId, postId],
    queryFn: () => fetchGroupPost(groupId ?? "", postId ?? ""),
    enabled: Boolean(groupId) && Boolean(postId) && !isNew,
    refetchOnWindowFocus: false,
  });
  const postData = postQuery.data;

  const originalRef = useRef<PostFormData | null>(null);
  const hydratedIdRef = useRef<string | null>(null);
  useEffect(() => {
    hydratedIdRef.current = null;
  }, [postId]);

  useEffect(() => {
    if (isNew || !postData) return;
    if (hydratedIdRef.current === postData.id) return;
    hydratedIdRef.current = postData.id;
    const formData = mapPostToFormData(postData);
    originalRef.current = formData;
    form.reset(formData);
  }, [isNew, postData, form]);

  const postsListPath = groupId ? ROUTES.groupPosts(groupId) : ROUTES.groups;

  const mutation = useMutation({
    mutationFn: async (data: PostFormData) => {
      if (isNew) {
        return createGroupPost(groupId ?? "", buildCreatePostBody(data));
      }
      const original = originalRef.current ?? mapPostToFormData(postData!);
      return saveGroupPostEdit({
        groupId: groupId ?? "",
        postId: postId ?? "",
        data,
        original,
      });
    },
    onSuccess: () => {
      toast.success(
        isNew
          ? t("studio.groups.pages.post_form.post_created")
          : t("studio.groups.pages.post_form.post_updated"),
      );
      queryClient.invalidateQueries({
        queryKey: ["cms-group-posts", groupId],
      });
      if (postId) {
        queryClient.invalidateQueries({
          queryKey: ["cms-group-post", groupId, postId],
        });
      }
      navigate(postsListPath);
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  const onSubmit = form.handleSubmit((data) => {
    if (readOnly) return;
    mutation.mutate(data);
  });

  if (!isNew && postQuery.isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-muted-foreground">
        {t("studio.groups.pages.post_form.loading")}
      </div>
    );
  }

  if (!isNew && postQuery.isError) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4">
        <p className="text-center text-destructive">
          {getApiErrorMessage(
            postQuery.error,
            t("studio.groups.pages.post_form.load_failed"),
          )}
        </p>
        <Pecha.Button variant="outline" onClick={() => navigate(postsListPath)}>
          {t("studio.groups.pages.post_form.back_to_posts")}
        </Pecha.Button>
      </div>
    );
  }

  const media = form.watch("media") ?? [];
  const mediaDirty = form.watch("media_dirty");

  const getSaveLabel = () => {
    if (mutation.isPending)
      return isNew ? t("studio.common.creating") : t("studio.common.saving");
    return isNew
      ? t("studio.groups.pages.post_form.create_post")
      : t("studio.groups.pages.post_form.save_changes");
  };

  const saveDisabled =
    readOnly || mutation.isPending || (!isNew && !form.formState.isDirty);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">
          {isNew
            ? t("studio.groups.pages.posts.new_post")
            : t("studio.groups.pages.post_form.edit_post")}
        </h1>
      </div>

      {readOnly ? (
        <p className="text-sm text-muted-foreground">
          {isNew
            ? t("studio.groups.pages.post_form.no_permission_create")
            : t("studio.groups.pages.post_form.no_permission_edit")}
        </p>
      ) : null}

      <Pecha.Form {...form}>
        <form onSubmit={onSubmit} className="space-y-8">
          <Pecha.FormField
            control={form.control}
            name="caption"
            render={({ field }) => (
              <Pecha.FormItem>
                <Pecha.FormLabel>
                  {t("studio.groups.pages.post_form.caption_label")}
                </Pecha.FormLabel>
                <Pecha.FormControl>
                  <Pecha.Textarea
                    {...field}
                    rows={5}
                    placeholder={t(
                      "studio.groups.pages.post_form.caption_placeholder",
                    )}
                    disabled={readOnly}
                    className="bg-white dark:bg-[#181818]"
                  />
                </Pecha.FormControl>
                <Pecha.FormMessage />
              </Pecha.FormItem>
            )}
          />

          <Pecha.FormField
            control={form.control}
            name="status"
            render={({ field }) => (
              <Pecha.FormItem className="max-w-xs">
                <Pecha.FormLabel>{t("studio.common.status")}</Pecha.FormLabel>
                <Pecha.Select
                  value={field.value}
                  onValueChange={field.onChange}
                  disabled={readOnly}
                >
                  <Pecha.FormControl>
                    <Pecha.SelectTrigger className="w-full bg-white dark:bg-[#181818]">
                      <Pecha.SelectValue />
                    </Pecha.SelectTrigger>
                  </Pecha.FormControl>
                  <Pecha.SelectContent>
                    {POST_STATUSES.map((status) => (
                      <Pecha.SelectItem key={status} value={status}>
                        {status === "PUBLISHED"
                          ? t("studio.common.published")
                          : t("studio.groups.pages.post_form.status_hidden")}
                      </Pecha.SelectItem>
                    ))}
                  </Pecha.SelectContent>
                </Pecha.Select>
                <Pecha.FormMessage />
              </Pecha.FormItem>
            )}
          />

          <PostMediaSection
            fields={mediaRows.fields}
            media={media}
            mediaDirty={mediaDirty}
            isNew={isNew}
            readOnly={readOnly}
            onAdd={addMediaRow}
            onRemove={removeMediaRow}
            onMove={moveMediaRow}
            onStartReplace={startMediaReplace}
            onClear={clearMedia}
          />

          <PostLinksSection
            form={form}
            fields={linkRows.fields}
            readOnly={readOnly}
            onAdd={addLinkRow}
            onRemove={removeLinkRow}
            onMove={moveLinkRow}
          />

          <div className="flex justify-end gap-3 border-t border-dashed border-border pt-6">
            <Pecha.Button
              type="button"
              variant="outline"
              onClick={() => navigate(postsListPath)}
            >
              {t("studio.common.cancel")}
            </Pecha.Button>
            {!readOnly ? (
              <Pecha.Button
                type="submit"
                disabled={saveDisabled}
                className="bg-[#A51C21] font-medium text-white hover:bg-[#A51C21]/90 disabled:opacity-50"
              >
                {getSaveLabel()}
              </Pecha.Button>
            ) : null}
          </div>
        </form>
      </Pecha.Form>
    </div>
  );
};

export default GroupPostFormPage;
