import { useState, useEffect, useMemo, useCallback } from "react";

import { useParams, useNavigate, useSearchParams } from "react-router-dom";

import { useQuery } from "@tanstack/react-query";

import { SplitPane, Pane } from "react-split-pane";

import TaskForm from "./components/view/TaskForm";

import SideBar from "./components/sidebar-component/SideBar";

import TaskView from "./components/view/TaskView";

import MobileView from "./components/MobileView";

import MobilePreviewSplitDivider from "./components/MobilePreviewSplitDivider";

import NoDaysEmptyState from "./components/view/NoDaysEmptyState";

import { fetchPlanDetails } from "./api/planApi";
import { useUserInfo } from "@/hooks/useUserInfo";
import { fetchGroup } from "@/components/routes/groups/api/groupsApi";
import { getCurrentUserGroupRole } from "@/components/routes/groups/lib/groupPermissions";
import { canEditContent } from "@/lib/contentPermissions";
import { useIsMobile } from "@/hooks/useIsMobile";
import { IoChevronBack } from "react-icons/io5";

const PlanDetailsPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  const [editingTask, setEditingTask] = useState<any>(null);

  const [showMobilePreview, setShowMobilePreview] = useState<boolean>(true);

  const isMobile = useIsMobile();

  /** A phone has room for one pane: the day list, or the task it opened. */
  const [mobilePane, setMobilePane] = useState<"days" | "editor">("days");

  const { planId } = useParams<{ planId: string }>();

  const navigate = useNavigate();

  // Get selected day from URL params, default to day 1

  const selectedDay = useMemo(() => {
    const dayParam = searchParams.get("day");

    return dayParam ? Number.parseInt(dayParam, 10) : 1;
  }, [searchParams]);

  // Function to update search params

  const updateSearchParams = useCallback(
    (day: number) => {
      const newParams = new URLSearchParams(searchParams);

      if (day === 1) {
        // Remove day param if it's the default (day 1)

        newParams.delete("day");
      } else {
        newParams.set("day", day.toString());
      }

      setSearchParams(newParams, { replace: true });
    },

    [searchParams, setSearchParams],
  );

  // Use the specific plan ID from the URL or redirect if not provided

  useEffect(() => {
    if (!planId) {
      // If no planId in URL but we want to use the specific one from the WeBuddhist plan viewer

      const targetPlanId = "24e15ca6-ae54-4b5c-a12d-11355730158e";

      navigate(`/plans/${targetPlanId}`, { replace: true });
    }
  }, [planId, navigate]);

  // Clear selected task and editing task when day changes

  useEffect(() => {
    setSelectedTaskId(null);

    setEditingTask(null);
  }, [selectedDay]);

  const { data: userInfo } = useUserInfo();

  const { data: planDetails } = useQuery({
    queryKey: ["planDetails", planId],

    queryFn: () => fetchPlanDetails(planId!),

    enabled: !!planId,
  });

  const groupId = planDetails?.group_id as string | undefined;

  const { data: planGroup } = useQuery({
    queryKey: ["cms-group", groupId],
    queryFn: () => fetchGroup(groupId!),
    enabled: Boolean(groupId),
    refetchOnWindowFocus: false,
  });

  const groupRole = planGroup
    ? getCurrentUserGroupRole(planGroup.members ?? [], userInfo)
    : undefined;

  const isEditable = canEditContent(
    groupRole,
    planDetails?.status ?? "DRAFT",
    userInfo?.platform_role,
  );
  const isPlanPublished = planDetails?.status === "PUBLISHED";

  useEffect(() => {
    if (!isPlanPublished) {
      setShowMobilePreview(false);
    }
  }, [isPlanPublished]);

  const currentDayData = planDetails?.days?.find(
    (day: { day_number: number }) => day.day_number === selectedDay,
  );

  // Get the selected day ID for passing to MobileView

  const selectedDayId = currentDayData?.id;

  const handleDaySelect = (dayNumber: number) => {
    updateSearchParams(dayNumber);

    setSelectedTaskId(null);

    setEditingTask(null);
  };

  const handleEditTask = (task: any) => {
    if (!isEditable) {
      return;
    }

    setEditingTask(task);

    setSelectedTaskId(null);
  };

  const handleCancelTaskForm = (newlyCreatedTaskId?: string) => {
    setEditingTask(null);

    if (newlyCreatedTaskId) {
      setSelectedTaskId(newlyCreatedTaskId);
    } else {
      // Nothing left to show on a phone, so go back to the day list.
      setMobilePane("days");
    }
  };

  const openTaskOnMobile = (taskId: string) => {
    setSelectedTaskId(taskId);
    setMobilePane("editor");
  };

  const addTaskOnMobile = (dayNumber: number) => {
    if (dayNumber !== selectedDay) updateSearchParams(dayNumber);
    setSelectedTaskId(null);
    setEditingTask(null);
    setMobilePane("editor");
  };

  const handleTaskDelete = (taskId: string) => {
    if (selectedTaskId === taskId) {
      setSelectedTaskId(null);
      setMobilePane("days");
    }

    if (editingTask?.id === taskId) {
      setEditingTask(null);
    }
  };

  const toggleMobilePreview = useCallback(() => {
    setShowMobilePreview((visible) => !visible);
  }, []);

  // A plan with no days has nothing a task could be attached to, so the editor
  // is replaced by a prompt to create one.
  const hasNoDays = Boolean(planDetails) && !planDetails.days?.length;

  const editorContent = hasNoDays ? (
    <NoDaysEmptyState planId={planId} isEditable={isEditable} />
  ) : selectedTaskId ? (
    <TaskView
      taskId={selectedTaskId}
      onEditTask={handleEditTask}
      isEditable={isEditable}
      dayAudioUrl={currentDayData?.audio_url}
    />
  ) : (
    <TaskForm
      selectedDay={selectedDay}
      editingTask={editingTask}
      onCancel={handleCancelTaskForm}
      isEditable={isEditable}
    />
  );

  const renderMainArea = () => {
    if (isPlanPublished && showMobilePreview) {
      return (
        <SplitPane
          direction="horizontal"
          className="flex-1 min-h-0"
          divider={(dividerProps) => (
            <MobilePreviewSplitDivider
              {...dividerProps}
              showPreview={showMobilePreview}
              onToggle={toggleMobilePreview}
            />
          )}
        >
          <Pane defaultSize="60%" minSize="300px">
            <div className="h-full overflow-y-auto rounded-l-2xl pl-4">
              {editorContent}
            </div>
          </Pane>

          <Pane>
            <div className="h-full">
              <MobileView />
            </div>
          </Pane>
        </SplitPane>
      );
    }

    if (isPlanPublished && !showMobilePreview) {
      return (
        <div className="flex min-h-0 min-w-0 flex-1">
          <div className="min-w-0 flex-1 overflow-y-auto rounded-l-2xl pl-4">
            {editorContent}
          </div>

          <MobilePreviewSplitDivider
            showPreview={showMobilePreview}
            onToggle={toggleMobilePreview}
          />
        </div>
      );
    }

    return (
      <div className="flex-1 overflow-y-auto rounded-l-2xl pl-4">
        {editorContent}
      </div>
    );
  };

  if (isMobile) {
    return (
      <div className="flex h-full flex-col">
        {mobilePane === "days" || hasNoDays ? (
          <SideBar
            selectedDay={selectedDay}
            selectedDayId={selectedDayId}
            onDaySelect={handleDaySelect}
            onTaskClick={openTaskOnMobile}
            onTaskDelete={handleTaskDelete}
            onAddTask={isEditable ? addTaskOnMobile : undefined}
            isEditable={isEditable}
          />
        ) : (
          <>
            <div className="flex h-12 shrink-0 items-center gap-2 border-b border-gray-200 px-2 dark:border-border">
              <button
                type="button"
                onClick={() => {
                  setSelectedTaskId(null);
                  setEditingTask(null);
                  setMobilePane("days");
                }}
                className="flex min-h-10 items-center gap-1 rounded-md px-2 text-sm font-medium"
              >
                <IoChevronBack className="h-5 w-5" />
                Days
              </button>
              <span className="truncate text-sm text-muted-foreground">
                Day {selectedDay}
                {planDetails?.title ? ` · ${planDetails.title}` : ""}
              </span>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              {editorContent}
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="relative h-full">
      <div className="flex h-full">
        <SideBar
          selectedDay={selectedDay}
          selectedDayId={selectedDayId}
          onDaySelect={handleDaySelect}
          onTaskClick={(taskId) => {
            setSelectedTaskId(taskId);
          }}
          onTaskDelete={handleTaskDelete}
          isEditable={isEditable}
        />

        {renderMainArea()}
      </div>
    </div>
  );
};

export default PlanDetailsPage;
