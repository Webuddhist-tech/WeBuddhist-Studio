import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTranslate } from "@tolgee/react";
import { Pecha } from "@/components/ui/shadimport";
import { SortableList, SortableItem } from "@/components/ui/atoms/sortable";
import { FaYoutube } from "react-icons/fa";
import { FiLoader, FiPlus } from "react-icons/fi";
import { FaTrash } from "react-icons/fa6";
import { PiDotsSixVertical } from "react-icons/pi";
import {
  addDayVideo,
  deleteDayVideo,
  reorderDayVideos,
  type DayVideoSummary,
} from "@/components/routes/task/api/planApi";
import { getApiErrorMessage } from "@/lib/apiErrors";
import {
  getYouTubeVideoId,
  getYouTubeShortsId,
  reorderArray,
} from "@/lib/utils";

interface DayVideosDialogProps {
  planId: string;
  dayId: string;
  dayNumber: number;
  videos?: DayVideoSummary[];
  isEditable?: boolean;
}

const isYouTubeUrl = (url: string) =>
  Boolean(getYouTubeVideoId(url) || getYouTubeShortsId(url));

const sortByOrder = (videos: DayVideoSummary[]) =>
  [...videos].sort((a, b) => a.display_order - b.display_order);

const DayVideosDialog = ({
  planId,
  dayId,
  dayNumber,
  videos = [],
  isEditable,
}: DayVideosDialogProps) => {
  const { t } = useTranslate();
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  // Local copy so drag-reorder updates instantly before the server confirms.
  const [orderedVideos, setOrderedVideos] = useState<DayVideoSummary[]>(
    sortByOrder(videos),
  );
  const queryClient = useQueryClient();

  useEffect(() => {
    setOrderedVideos(sortByOrder(videos));
  }, [videos]);

  const invalidatePlan = () =>
    queryClient.invalidateQueries({ queryKey: ["planDetails", planId] });

  const addMutation = useMutation({
    mutationFn: (videoUrl: string) => addDayVideo(dayId, { url: videoUrl }),
    onSuccess: () => {
      setUrl("");
      toast.success(t("studio.modals.day_videos.added"));
      invalidatePlan();
    },
    onError: (error: unknown) => {
      toast.error(t("studio.modals.day_videos.add_failed"), {
        description: getApiErrorMessage(error),
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (videoId: string) => deleteDayVideo(dayId, videoId),
    onSuccess: () => {
      toast.success(t("studio.modals.day_videos.removed"));
      invalidatePlan();
    },
    onError: (error: unknown) => {
      toast.error(t("studio.modals.day_videos.remove_failed"), {
        description: getApiErrorMessage(error),
      });
    },
  });

  const reorderMutation = useMutation({
    mutationFn: (payload: Array<{ id: string; display_order: number }>) =>
      reorderDayVideos(dayId, payload),
    onSuccess: () => {
      invalidatePlan();
    },
    onError: (error: unknown) => {
      setOrderedVideos(sortByOrder(videos)); // revert optimistic order
      toast.error(t("studio.modals.day_videos.reorder_failed"), {
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
    addMutation.mutate(trimmedUrl);
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
    <>
      <span
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        className="flex items-center gap-2 cursor-pointer w-full"
      >
        <FaYoutube className="w-4 h-4" />{" "}
        {t("studio.modals.day_videos.menu_label")}
        {orderedVideos.length > 0 && (
          <span className="ml-auto text-xs text-muted-foreground">
            {orderedVideos.length}
          </span>
        )}
      </span>

      <Pecha.Dialog open={open} onOpenChange={setOpen}>
        <Pecha.DialogContent className="sm:max-w-lg">
          <Pecha.DialogHeader>
            <Pecha.DialogTitle>
              {t("studio.modals.day_videos.title", { day: dayNumber })}
            </Pecha.DialogTitle>
          </Pecha.DialogHeader>

          {isEditable && (
            <div className="space-y-1">
              <div className="flex gap-2">
                <Pecha.Input
                  type="url"
                  placeholder={t("studio.modals.day_videos.url_placeholder")}
                  value={url}
                  disabled={isBusy}
                  onChange={(e) => setUrl(e.target.value)}
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
                  {t("studio.modals.day_videos.invalid_url")}
                </p>
              )}
            </div>
          )}

          <div className="max-h-[50vh] overflow-y-auto">
            {orderedVideos.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                {t("studio.modals.day_videos.empty")}
              </p>
            ) : (
              <SortableList
                items={orderedVideos.map((video) => ({ id: video.id }))}
                onReorder={handleReorder}
                disabled={!isEditable || isBusy}
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
                        disabled={!isEditable || isBusy}
                        className="flex items-center gap-3 rounded-lg border border-dashed border-gray-300 dark:border-input p-2 bg-white dark:bg-[#161616]"
                      >
                        {({ listeners }: any) => (
                          <>
                            {isEditable && (
                              <PiDotsSixVertical
                                className="w-4 h-4 text-gray-400 dark:text-muted-foreground cursor-grab active:cursor-grabbing shrink-0"
                                {...listeners}
                              />
                            )}
                            {videoId && (
                              <img
                                src={`https://img.youtube.com/vi/${videoId}/default.jpg`}
                                alt={
                                  video.title ??
                                  t("studio.modals.day_videos.video_alt")
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
                            {isEditable && (
                              <Pecha.Button
                                type="button"
                                variant="outline"
                                size="icon"
                                className="shrink-0 h-9 w-9"
                                disabled={isBusy}
                                title={t("studio.modals.day_videos.remove")}
                                onClick={() => deleteMutation.mutate(video.id)}
                              >
                                {deleteMutation.isPending &&
                                deleteMutation.variables === video.id ? (
                                  <FiLoader className="w-4 h-4 animate-spin" />
                                ) : (
                                  <FaTrash className="w-4 h-4" />
                                )}
                              </Pecha.Button>
                            )}
                          </>
                        )}
                      </SortableItem>
                    );
                  })}
                </div>
              </SortableList>
            )}
          </div>
        </Pecha.DialogContent>
      </Pecha.Dialog>
    </>
  );
};

export default DayVideosDialog;
