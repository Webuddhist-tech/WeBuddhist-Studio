import { useEffect, useState, Activity } from "react";
import { IoCalendarClearOutline } from "react-icons/io5";
import { MdExpandMore } from "react-icons/md";
import { BsThreeDots } from "react-icons/bs";
import { FiTrash } from "react-icons/fi";
import { Pecha } from "@/components/ui/shadimport";
import TaskDeleteDialog from "@/components/ui/molecules/modals/task-delete/TaskDeleteDialog";
import TaskSettingsDialog from "@/components/ui/molecules/modals/task-settings/TaskSettingsDialog";
import DayDeleteDialog from "@/components/ui/molecules/modals/day-delete/DayDeleteDialog";
import DayAudioDialog from "@/components/ui/molecules/modals/day-audio/DayAudioDialog";
import DayVideosDialog from "@/components/ui/molecules/modals/day-videos/DayVideosDialog";
import DayShareableImagesDialog from "@/components/ui/molecules/modals/day-shareable-images/DayShareableImagesDialog";
import DayCreateDialog from "@/components/ui/molecules/modals/day-create/DayCreateDialog";
import { useParams } from "react-router-dom";
import { SortableList, SortableItem } from "@/components/ui/atoms/sortable";
import { PiDotsSixVertical } from "react-icons/pi";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchPlanDetails } from "../../api/planApi";
import {
  usePlanMutations,
  PLAN_DAYS_OVERLAP_NEXT_PLAN_CODE,
} from "../../hooks/usePlanMutations";
import { useTaskReorder } from "../../hooks/useTaskReorder";
import { useDayReorder } from "../../hooks/useDayReorder";

interface SideBarProps {
  selectedDay: number;
  selectedDayId?: string;
  onDaySelect: (dayNumber: number) => void;
  onTaskClick?: (taskId: string) => void;
  onTaskDelete?: (taskId: string) => void;
  isEditable?: boolean;
}

const SideBar = ({
  selectedDay,
  onDaySelect,
  onTaskClick,
  onTaskDelete,
  isEditable,
}: SideBarProps) => {
  const [expandedDay, setExpandedDay] = useState<number>(selectedDay);
  const { planId } = useParams<{ planId: string }>();
  const queryClient = useQueryClient();

  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedDayIds, setSelectedDayIds] = useState<Set<string>>(new Set());
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [seriesOverlapPrompt, setSeriesOverlapPrompt] = useState<{
    planId: string;
    request: { number_of_days?: number; source_day_id?: string };
    overflowDays: number;
    nextPlanStartDate: string;
  } | null>(null);

  // Discard any pending overlap confirmation if the author navigates to a
  // different plan before confirming — it must never fire against a plan
  // other than the one whose overlap was actually approved.
  useEffect(() => {
    setSeriesOverlapPrompt(null);
  }, [planId]);

  const { data: currentPlan, isLoading } = useQuery({
    queryKey: ["planDetails", planId],
    queryFn: () => fetchPlanDetails(planId!),
    enabled: !!planId,
    refetchOnWindowFocus: false,
  });
  const { deleteTask, deleteDay, createNewDay } = usePlanMutations(planId);
  const { handleTaskReorder, getDisplayTasks } = useTaskReorder(
    currentPlan,
    planId,
  );
  const { handleDayReorder, getDisplayDays } = useDayReorder(
    currentPlan,
    planId,
  );

  const displayDays = getDisplayDays();

  const handleDayClick = (dayNumber: number) => {
    if (isSelectMode) return;
    onDaySelect(dayNumber);
    setExpandedDay(dayNumber);
  };

  const handleDeleteTask = (task_id: string) => {
    deleteTask.mutate(task_id, {
      onSuccess: () => {
        onTaskDelete?.(task_id);
      },
    });
  };

  const handleDeleteDay = (day_id: string) => {
    deleteDay.mutate([day_id]);
  };

  const toggleDaySelection = (day_id: string) => {
    setSelectedDayIds((prev) => {
      const next = new Set(prev);
      if (next.has(day_id)) {
        next.delete(day_id);
      } else {
        next.add(day_id);
      }
      return next;
    });
  };

  const exitSelectMode = () => {
    setIsSelectMode(false);
    setSelectedDayIds(new Set());
  };

  const handleBulkDelete = () => {
    deleteDay.mutate(Array.from(selectedDayIds), {
      onSuccess: () => {
        exitSelectMode();
        queryClient.invalidateQueries({ queryKey: ["planDetails", planId] });
      },
    });
    setShowBulkDeleteConfirm(false);
  };

  const onDaysCreated = (newDays?: { day_number: number }[] | null) => {
    if (newDays && newDays.length > 0) {
      onDaySelect(newDays[0].day_number);
      setExpandedDay(newDays[0].day_number);
    }
    queryClient.invalidateQueries({ queryKey: ["planDetails", planId] });
  };

  const handleCreateDays = (req: {
    number_of_days?: number;
    source_day_id?: string;
  }) => {
    createNewDay.mutate(req, {
      onSuccess: onDaysCreated,
      onError: (error: any) => {
        const detail = error?.response?.data?.detail;
        if (detail?.code === PLAN_DAYS_OVERLAP_NEXT_PLAN_CODE && planId) {
          setSeriesOverlapPrompt({
            planId,
            request: req,
            overflowDays: detail.overflow_days,
            nextPlanStartDate: detail.next_plan_start_date,
          });
        }
      },
    });
  };

  const handleConfirmSeriesShift = () => {
    if (!seriesOverlapPrompt) return;
    const { planId: promptPlanId, request } = seriesOverlapPrompt;
    setSeriesOverlapPrompt(null);
    // The mutation binds to the plan currently in the route; if that plan
    // changed since the prompt was raised, drop the stale request instead of
    // shifting the wrong plan's series.
    if (promptPlanId !== planId) return;
    createNewDay.mutate(
      { ...request, cascade: true },
      { onSuccess: onDaysCreated },
    );
  };

  const canEnterSelectMode =
    isEditable && displayDays.length > 1 && !createNewDay.isPending;

  const deleteBtnLabel = (() => {
    if (deleteDay.isPending) return "Deleting…";
    if (selectedDayIds.size === 0) return "Select days to delete";
    const unit = selectedDayIds.size === 1 ? "Day" : "Days";
    return `Delete ${selectedDayIds.size} ${unit}`;
  })();

  return (
    <div className="w-full sm:w-80 lg:w-96 dark:bg-[#161616] border-r border-gray-200 dark:border-border h-screen flex flex-col">
      <div className="p-4 shrink-0">
        <div className="dark:text-[#bebebe] text-[#4d4d4d] text-md font-bold">
          Current Plan
        </div>
        <div className="text-sm text-black dark:text-white overflow-hidden text-ellipsis whitespace-nowrap">
          {isLoading ? (
            <Pecha.Skeleton className="h-6 w-full rounded" />
          ) : (
            currentPlan?.title
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col min-h-0">
        <div className="flex p-4 items-center border-b pb-3 gap-2 shrink-0">
          <IoCalendarClearOutline className="w-5 h-5 text-foreground" />
          <span className="text-sm text-foreground flex-1">Days</span>
          {canEnterSelectMode && !isSelectMode && (
            <button
              type="button"
              className="text-xs text-muted-foreground hover:text-foreground transition-colors px-1"
              onClick={() => setIsSelectMode(true)}
            >
              Select
            </button>
          )}
          {isSelectMode && (
            <button
              type="button"
              className="text-xs text-muted-foreground hover:text-foreground transition-colors px-1"
              onClick={exitSelectMode}
            >
              Cancel
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto min-h-0 space-y-1">
          {isLoading ? (
            <>
              {[1, 2, 3].map((index) => (
                <div key={index} className="px-4 py-2 border-b">
                  <Pecha.Skeleton className="h-8 w-full rounded" />
                </div>
              ))}
            </>
          ) : (
            <SortableList
              items={displayDays.map((day: any) => ({
                id: day.id,
                day_number: day.day_number,
              }))}
              onReorder={(activeId: any, overId: any) => {
                handleDayReorder(activeId, overId);
              }}
              disabled={!isEditable || isSelectMode}
            >
              {displayDays.map((day: any) => (
                <SortableItem key={day.id} id={day.id}>
                  {({ listeners }: any) => (
                    <div className="group space-y-2">
                      <div
                        className={`flex items-center justify-between px-4 py-2 border-b border-dashed transition-colors cursor-pointer hover:bg-[#f6f6f6] dark:hover:bg-[#000000]/10 ${
                          isSelectMode && selectedDayIds.has(day.id)
                            ? "bg-[#fdf2f2] dark:bg-[#AD1B21]/10"
                            : ""
                        }`}
                        onClick={() => {
                          if (isSelectMode) {
                            toggleDaySelection(day.id);
                          } else {
                            handleDayClick(day.day_number);
                          }
                        }}
                      >
                        <div className="flex items-center gap-3">
                          {isSelectMode ? (
                            <Pecha.Checkbox
                              checked={selectedDayIds.has(day.id)}
                              onCheckedChange={() => toggleDaySelection(day.id)}
                              onClick={(e) => e.stopPropagation()}
                              className="shrink-0"
                            />
                          ) : (
                            isEditable && (
                              <PiDotsSixVertical
                                className="w-4 h-4 text-gray-400 dark:text-muted-foreground cursor-grab active:cursor-grabbing"
                                {...listeners}
                                onClick={(e) => e.stopPropagation()}
                              />
                            )
                          )}
                          <div
                            className={`w-4 h-4 rounded-full ${
                              !isSelectMode && selectedDay === day.day_number
                                ? "bg-[#ba0909]"
                                : "bg-input"
                            }`}
                          />
                          <span
                            className={`text-sm ${
                              !isSelectMode && selectedDay === day.day_number
                                ? "text-zinc-900 dark:text-zinc-100"
                                : "text-zinc-400 dark:text-zinc-600"
                            }`}
                          >
                            Day {day.day_number}
                          </span>
                        </div>

                        {!isSelectMode && (
                          <Activity
                            mode={
                              selectedDay === day.day_number
                                ? "visible"
                                : "hidden"
                            }
                          >
                            <div className="flex items-center gap-2">
                              <Activity
                                mode={
                                  day.tasks.length > 0 ? "visible" : "hidden"
                                }
                              >
                                <MdExpandMore
                                  className={`w-4 h-4 text-gray-400 dark:text-muted-foreground cursor-pointer transition-transform ${
                                    expandedDay === day.day_number
                                      ? "rotate-180"
                                      : ""
                                  }`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setExpandedDay(
                                      expandedDay === day.day_number
                                        ? 0
                                        : day.day_number,
                                    );
                                  }}
                                />
                              </Activity>
                              {isEditable && currentPlan?.days.length > 1 && (
                                <Pecha.DropdownMenu>
                                  <Pecha.DropdownMenuTrigger asChild>
                                    <BsThreeDots className="w-3 h-3 text-gray-400 dark:text-muted-foreground cursor-pointer" />
                                  </Pecha.DropdownMenuTrigger>
                                  <Pecha.DropdownMenuContent side="right">
                                    <Pecha.DropdownMenuItem
                                      className="gap-2 cursor-pointer"
                                      onSelect={(e) => e.preventDefault()}
                                    >
                                      <DayAudioDialog
                                        planId={planId!}
                                        planTitle={currentPlan?.title}
                                        dayId={day.id}
                                        dayNumber={day.day_number}
                                        audioUrl={day.audio_url}
                                        audioDurationMs={day.audio_duration_ms}
                                        hasAudio={day.has_audio}
                                        isEditable={isEditable}
                                        language={currentPlan?.language}
                                      />
                                    </Pecha.DropdownMenuItem>
                                    <Pecha.DropdownMenuItem
                                      className="gap-2 cursor-pointer"
                                      onSelect={(e) => e.preventDefault()}
                                    >
                                      <DayVideosDialog
                                        planId={planId!}
                                        dayId={day.id}
                                        dayNumber={day.day_number}
                                        videos={day.videos}
                                        isEditable={isEditable}
                                      />
                                    </Pecha.DropdownMenuItem>
                                    <Pecha.DropdownMenuItem
                                      className="gap-2 cursor-pointer"
                                      onSelect={(e) => e.preventDefault()}
                                    >
                                      <DayShareableImagesDialog
                                        planId={planId!}
                                        dayId={day.id}
                                        dayNumber={day.day_number}
                                        thumbnailUrl={day.thumbnail_url}
                                        shareableImageUrl={
                                          day.shareable_image_url
                                        }
                                        isEditable={isEditable}
                                      />
                                    </Pecha.DropdownMenuItem>
                                    <Pecha.DropdownMenuItem className="gap-2 cursor-pointer">
                                      <DayDeleteDialog
                                        onDelete={() => handleDeleteDay(day.id)}
                                      />
                                    </Pecha.DropdownMenuItem>
                                  </Pecha.DropdownMenuContent>
                                </Pecha.DropdownMenu>
                              )}
                            </div>
                          </Activity>
                        )}
                      </div>

                      {!isSelectMode && (
                        <Activity
                          mode={
                            expandedDay === day.day_number &&
                            day.tasks.length > 0
                              ? "visible"
                              : "hidden"
                          }
                        >
                          <div className="mx-2 border h-44 overflow-y-auto dark:bg-accent/30 bg-[#F5F5F5]">
                            <SortableList
                              items={getDisplayTasks(day).map((task: any) => ({
                                id: task.id,
                                display_order: task.display_order,
                              }))}
                              onReorder={(activeId: any, overId: any) => {
                                handleTaskReorder(activeId, overId);
                              }}
                              disabled={!isEditable}
                            >
                              {getDisplayTasks(day).map((task: any) => (
                                <SortableItem
                                  key={task.id}
                                  id={task.id}
                                  className="flex items-center gap-x-2 bg-white dark:bg-[#161616] border-b border-gray-200 dark:border-input/40 justify-between py-2 pr-3 pl-1 text-sm text-foreground"
                                >
                                  {({ listeners }: any) => (
                                    <>
                                      {isEditable && (
                                        <PiDotsSixVertical
                                          className="w-4 h-4 text-gray-400 dark:text-muted-foreground cursor-grab active:cursor-grabbing"
                                          {...listeners}
                                        />
                                      )}
                                      <span
                                        className="cursor-pointer w-full"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          onTaskClick?.(task.id);
                                        }}
                                      >
                                        {task.title}
                                        {task.settings?.is_live && (
                                          <span className="ml-2 rounded-sm bg-[#A51C21] px-1.5 py-0.5 text-[10px] font-semibold uppercase leading-none text-white">
                                            Live
                                          </span>
                                        )}
                                      </span>
                                      {isEditable && (
                                        <Pecha.DropdownMenu>
                                          <Pecha.DropdownMenuTrigger asChild>
                                            <BsThreeDots
                                              className="w-3 h-3 text-gray-400 dark:text-muted-foreground cursor-pointer"
                                              onClick={(e) =>
                                                e.stopPropagation()
                                              }
                                            />
                                          </Pecha.DropdownMenuTrigger>
                                          <Pecha.DropdownMenuContent side="right">
                                            <Pecha.DropdownMenuItem
                                              className="gap-2 cursor-pointer"
                                              onSelect={(e) =>
                                                e.preventDefault()
                                              }
                                            >
                                              <TaskSettingsDialog
                                                planId={planId!}
                                                taskId={task.id}
                                                settings={task.settings}
                                                dayTasks={day.tasks}
                                              />
                                            </Pecha.DropdownMenuItem>
                                            <Pecha.DropdownMenuItem className="gap-2 cursor-pointer">
                                              <TaskDeleteDialog
                                                taskId={task.id}
                                                onDelete={handleDeleteTask}
                                              />
                                            </Pecha.DropdownMenuItem>
                                          </Pecha.DropdownMenuContent>
                                        </Pecha.DropdownMenu>
                                      )}
                                    </>
                                  )}
                                </SortableItem>
                              ))}
                            </SortableList>
                          </div>
                        </Activity>
                      )}
                    </div>
                  )}
                </SortableItem>
              ))}
            </SortableList>
          )}
        </div>

        {/* Footer */}
        <div className="px-2 py-2 border-t shrink-0 space-y-2">
          {isSelectMode ? (
            <>
              <Pecha.Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={exitSelectMode}
              >
                Cancel
              </Pecha.Button>
              <Pecha.Button
                type="button"
                disabled={selectedDayIds.size === 0 || deleteDay.isPending}
                className="w-full bg-[#AD1B21] dark:text-white hover:bg-[#AD1B21]/90 disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={() => setShowBulkDeleteConfirm(true)}
              >
                <FiTrash className="w-4 h-4" />
                <span className="text-sm font-medium">{deleteBtnLabel}</span>
              </Pecha.Button>
            </>
          ) : (
            <DayCreateDialog
              disabled={!isEditable}
              isPending={createNewDay.isPending}
              onSubmit={handleCreateDays}
            />
          )}
        </div>
      </div>

      {/* Bulk delete confirmation */}
      <Pecha.AlertDialog
        open={showBulkDeleteConfirm}
        onOpenChange={setShowBulkDeleteConfirm}
      >
        <Pecha.AlertDialogContent>
          <Pecha.AlertDialogHeader>
            <Pecha.AlertDialogTitle>
              Delete {selectedDayIds.size}{" "}
              {selectedDayIds.size === 1 ? "day" : "days"}?
            </Pecha.AlertDialogTitle>
            <Pecha.AlertDialogDescription>
              This action cannot be undone. All tasks inside the selected{" "}
              {selectedDayIds.size === 1 ? "day" : "days"} will be permanently
              deleted and remaining days will be renumbered.
            </Pecha.AlertDialogDescription>
          </Pecha.AlertDialogHeader>
          <Pecha.AlertDialogFooter>
            <Pecha.AlertDialogCancel
              onClick={() => setShowBulkDeleteConfirm(false)}
            >
              Cancel
            </Pecha.AlertDialogCancel>
            <Pecha.AlertDialogAction
              className="bg-[#AD1B21] dark:text-white hover:bg-[#AD1B21]/90"
              onClick={handleBulkDelete}
            >
              Delete
            </Pecha.AlertDialogAction>
          </Pecha.AlertDialogFooter>
        </Pecha.AlertDialogContent>
      </Pecha.AlertDialog>

      {/* Series overlap: offer to shift the rest of the series forward */}
      <Pecha.AlertDialog
        open={!!seriesOverlapPrompt}
        onOpenChange={(open) => !open && setSeriesOverlapPrompt(null)}
      >
        <Pecha.AlertDialogContent>
          <Pecha.AlertDialogHeader>
            <Pecha.AlertDialogTitle>
              Shift the rest of the series?
            </Pecha.AlertDialogTitle>
            <Pecha.AlertDialogDescription>
              Adding these days would push past the next plan in this series,
              which starts on {seriesOverlapPrompt?.nextPlanStartDate}. Shift
              that plan (and any plans after it) forward by{" "}
              {seriesOverlapPrompt?.overflowDays} day
              {seriesOverlapPrompt?.overflowDays === 1 ? "" : "s"} to make room?
            </Pecha.AlertDialogDescription>
          </Pecha.AlertDialogHeader>
          <Pecha.AlertDialogFooter>
            <Pecha.AlertDialogCancel
              onClick={() => setSeriesOverlapPrompt(null)}
            >
              Cancel
            </Pecha.AlertDialogCancel>
            <Pecha.AlertDialogAction onClick={handleConfirmSeriesShift}>
              Shift schedule &amp; add days
            </Pecha.AlertDialogAction>
          </Pecha.AlertDialogFooter>
        </Pecha.AlertDialogContent>
      </Pecha.AlertDialog>
    </div>
  );
};

export default SideBar;
