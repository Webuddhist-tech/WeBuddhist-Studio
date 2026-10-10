import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTranslate } from "@tolgee/react";
import { Pecha } from "@/components/ui/shadimport";
import { SortableList, SortableItem } from "@/components/ui/atoms/sortable";
import { FaYoutube } from "react-icons/fa";
import { FiLoader, FiPlus } from "react-icons/fi";
import { FaTrash } from "react-icons/fa6";
import { PiDotsSixVertical } from "react-icons/pi";
import {
  addPlanVideo,
  deletePlanVideo,
  fetchPlanVideos,
  reorderPlanVideos,
  type PlanVideoSummary,
} from "@/components/routes/task/api/planApi";
import { getApiErrorMessage } from "@/lib/apiErrors";
import {
  getYouTubeVideoId,
  getYouTubeShortsId,
  reorderArray,
} from "@/lib/utils";

interface PlanVideosSectionProps {
  planId: string;
  videos?: PlanVideoSummary[];
}

const isYouTubeUrl = (url: string) =>
  Boolean(getYouTubeVideoId(url) || getYouTubeShortsId(url));

const sortByOrder = (videos: PlanVideoSummary[]) =>
  [...videos].sort((a, b) => a.display_order - b.display_order);

const PlanVideosSection = ({ planId, videos }: PlanVideosSectionProps) => {
  const { t } = useTranslate();
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const queryClient = useQueryClient();

  const { data: serverVideos = [] } = useQuery<PlanVideoSummary[]>({
    queryKey: ["plan-videos", planId],
    queryFn: async () => (await fetchPlanVideos(planId)) ?? [],
    initialData: videos ?? [],
    refetchOnWindowFocus: false,
  });

  // Local copy so drag-reorder updates instantly before the server confirms.
  const [orderedVideos, setOrderedVideos] = useState<PlanVideoSummary[]>(
    sortByOrder(serverVideos),
  );

  useEffect(() => {
    setOrderedVideos(sortByOrder(serverVideos));
  }, [serverVideos]);

  const invalidateVideos = () =>
    queryClient.invalidateQueries({ queryKey: ["plan-videos", planId] });

  const addMutation = useMutation({
    mutationFn: (payload: { url: string; title?: string | null }) =>
      addPlanVideo(planId, payload),
    onSuccess: () => {
      setUrl("");
      setTitle("");
      toast.success(t("studio.plan.videos.added"));
      invalidateVideos();
    },
    onError: (error: unknown) => {
      toast.error(t("studio.plan.videos.add_failed"), {
        description: getApiErrorMessage(error),
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (videoId: string) => deletePlanVideo(planId, videoId),
    onSuccess: () => {
      toast.success(t("studio.plan.videos.removed"));
      invalidateVideos();
    },
    onError: (error: unknown) => {
      toast.error(t("studio.plan.videos.remove_failed"), {
        description: getApiErrorMessage(error),
      });
    },
  });

  const reorderMutation = useMutation({
    mutationFn: (payload: Array<{ id: string; display_order: number }>) =>
      reorderPlanVideos(planId, payload),
    onSuccess: (updated) => {
      queryClient.setQueryData(["plan-videos", planId], updated);
    },
    onError: (error: unknown) => {
      setOrderedVideos(sortByOrder(serverVideos)); // revert optimistic order
      toast.error(t("studio.plan.videos.reorder_failed"), {
        description: getApiErrorMessage(error),
      });
    },
  });

  const trimmedUrl = url.trim();
  const urlIsValid = isYouTubeUrl(trimmedUrl);
  const isBusy =
    addMutation.isPending ||
    deleteMutation.isPending ||
    reorderMutation.isPending;

  const handleAdd = () => {
    if (!trimmedUrl || !urlIsValid) return;
    const trimmedTitle = title.trim();
    addMutation.mutate({
      url: trimmedUrl,
      ...(trimmedTitle ? { title: trimmedTitle } : {}),
    });
  };

  const handleReorder = (activeId: string, overId: string) => {
    if (activeId === overId) return;
    const next = reorderArray(orderedVideos, activeId, overId);
    if (!next) return;
    setOrderedVideos(next);
    reorderMutation.mutate(
      next.map((video, index) => ({ id: video.id, display_order: index })),
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <FaYoutube className="w-4 h-4 text-[#A51C21]" />
        <h3 className="text-sm font-bold">{t("studio.plan.videos.title")}</h3>
        {orderedVideos.length > 0 && (
          <span className="text-xs text-muted-foreground">
            {orderedVideos.length}
          </span>
        )}
      </div>

      <div className="space-y-1">
        <div className="flex flex-col gap-2 sm:flex-row">
          <Pecha.Input
            type="url"
            placeholder={t("studio.plan.videos.url_placeholder")}
            value={url}
            disabled={isBusy}
            className="bg-white"
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAdd();
              }
            }}
          />
          <Pecha.Input
            type="text"
            placeholder={t("studio.plan.videos.title_placeholder")}
            value={title}
            disabled={isBusy}
            className="bg-white sm:max-w-[40%]"
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAdd();
              }
            }}
          />
          <Pecha.Button
            type="button"
            className="bg-[#A51C21] hover:bg-[#A51C21]/90 shrink-0"
            disabled={isBusy || !trimmedUrl || !urlIsValid}
            onClick={handleAdd}
          >
            {addMutation.isPending ? (
              <FiLoader className="w-4 h-4 animate-spin" />
            ) : (
              <FiPlus className="w-4 h-4" />
            )}
            {t("studio.common.add")}
          </Pecha.Button>
        </div>
        {trimmedUrl && !urlIsValid && (
          <p className="text-xs text-[#A51C21]">
            {t("studio.plan.videos.invalid_url")}
          </p>
        )}
      </div>

      <div className="max-h-[40vh] overflow-y-auto">
        {orderedVideos.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            {t("studio.plan.videos.empty")}
          </p>
        ) : (
          <SortableList
            items={orderedVideos.map((video) => ({ id: video.id }))}
            onReorder={handleReorder}
            disabled={isBusy}
          >
            <div className="space-y-3">
              {orderedVideos.map((video) => {
                const videoId =
                  video.video_id ||
                  getYouTubeVideoId(video.url) ||
                  getYouTubeShortsId(video.url);
                return (
                  <SortableItem
                    key={video.id}
                    id={video.id}
                    disabled={isBusy}
                    className="flex items-center gap-3 rounded-lg border border-dashed border-gray-300 dark:border-input p-2 bg-white dark:bg-[#161616]"
                  >
                    {({ listeners }: any) => (
                      <>
                        <PiDotsSixVertical
                          className="w-4 h-4 text-gray-400 dark:text-muted-foreground cursor-grab active:cursor-grabbing shrink-0"
                          {...listeners}
                        />
                        {videoId && (
                          <img
                            src={`https://img.youtube.com/vi/${videoId}/default.jpg`}
                            alt={
                              video.title ?? t("studio.plan.videos.video_alt")
                            }
                            className="w-20 h-14 object-cover rounded shrink-0"
                          />
                        )}
                        <div className="min-w-0 flex-1">
                          <a
                            href={video.url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-sm text-foreground hover:underline block truncate"
                            title={video.title ?? video.url}
                          >
                            {video.title || video.url}
                          </a>
                          <span className="text-xs text-muted-foreground truncate block">
                            {video.url}
                          </span>
                        </div>
                        <Pecha.Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="shrink-0 h-9 w-9"
                          disabled={isBusy}
                          title={t("studio.plan.videos.remove_video")}
                          onClick={() => deleteMutation.mutate(video.id)}
                        >
                          {deleteMutation.isPending &&
                          deleteMutation.variables === video.id ? (
                            <FiLoader className="w-4 h-4 animate-spin" />
                          ) : (
                            <FaTrash className="w-4 h-4" />
                          )}
                        </Pecha.Button>
                      </>
                    )}
                  </SortableItem>
                );
              })}
            </div>
          </SortableList>
        )}
      </div>
    </div>
  );
};

export default PlanVideosSection;
