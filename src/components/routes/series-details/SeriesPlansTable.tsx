import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { CSS } from "@dnd-kit/utilities";
import { Pecha } from "@/components/ui/shadimport";
import { useTranslate } from "@tolgee/react";
import { useNavigate } from "react-router-dom";
import defaultCover from "/default-image.webp";
import { PiDotsSixVertical } from "react-icons/pi";
import { ROUTES } from "@/routes/paths";
import {
  languageChip,
  statusChip,
} from "@/components/routes/dashboard/dashboardTableUi";
import type { AuthorGroupMemberRole } from "@/components/routes/groups/api/groupsApi";
import {
  canAccessPlanRoutes,
  shouldShowCmsActionsColumn,
  type PlatformRole,
} from "@/lib/platformAccess";
import type { SeriesPlanRow } from "./seriesDetailsTypes";
import { SeriesPlanRowActions } from "./SeriesPlanRowActions";

function SortablePlanRow({
  plan,
  seriesId,
  sourceGroupId,
  groupRole,
  platformRole,
  readOnly,
  onRemoveFromSeries,
  canReorder,
  showActionsColumn,
}: {
  readonly plan: SeriesPlanRow;
  readonly seriesId: string;
  readonly sourceGroupId?: string | null;
  readonly groupRole?: AuthorGroupMemberRole;
  readonly platformRole?: PlatformRole;
  readonly readOnly?: boolean;
  readonly onRemoveFromSeries: (planId: string) => void;
  readonly canReorder: boolean;
  readonly showActionsColumn: boolean;
}) {
  const navigate = useNavigate();
  const { t } = useTranslate();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: plan.id, disabled: !canReorder || readOnly });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const daysLabel =
    plan.total_days === 1
      ? t("studio.dashboard.days_count_one", { count: plan.total_days })
      : t("studio.dashboard.days_count_other", { count: plan.total_days });
  const canOpenPlan = canAccessPlanRoutes(platformRole);

  return (
    <Pecha.TableRow
      ref={setNodeRef}
      style={style}
      className="dark:bg-background"
      {...attributes}
    >
      <Pecha.TableCell className="w-10">
        <button
          type="button"
          className="shrink-0 rounded p-1 text-muted-foreground hover:text-foreground touch-none disabled:cursor-not-allowed disabled:opacity-30"
          aria-label={t("studio.series.plans.reorder_aria", {
            title: plan.title,
          })}
          disabled={!canReorder}
          {...listeners}
        >
          <PiDotsSixVertical className="h-4 w-4" />
        </button>
      </Pecha.TableCell>
      <Pecha.TableCell>
        {canOpenPlan ? (
          <button
            type="button"
            className="flex w-full items-center gap-3 text-left"
            onClick={() => navigate(ROUTES.plan(plan.id))}
          >
            <img
              src={plan.image_url || defaultCover}
              onError={(e) => {
                e.currentTarget.src = defaultCover;
              }}
              alt=""
              className="h-12 w-28 shrink-0 rounded border object-cover"
            />
            <div className="min-w-0">
              <div className="text-sm font-semibold">{plan.title}</div>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {languageChip(plan.language)}
                {statusChip(plan.status, t)}
                <span className="rounded-full bg-[#DEAD2D4D] px-2.5 py-0.5 text-xs font-medium text-[#020C1D] dark:bg-[#DEAD2D4D] dark:text-white">
                  {daysLabel}
                </span>
              </div>
            </div>
          </button>
        ) : (
          <div className="flex w-full items-center gap-3 text-left">
            <img
              src={plan.image_url || defaultCover}
              onError={(e) => {
                e.currentTarget.src = defaultCover;
              }}
              alt=""
              className="h-12 w-28 shrink-0 rounded border object-cover"
            />
            <div className="min-w-0">
              <div className="text-sm font-semibold">{plan.title}</div>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {languageChip(plan.language)}
                {statusChip(plan.status, t)}
                <span className="rounded-full bg-[#DEAD2D4D] px-2.5 py-0.5 text-xs font-medium text-[#020C1D] dark:bg-[#DEAD2D4D] dark:text-white">
                  {daysLabel}
                </span>
              </div>
            </div>
          </div>
        )}
      </Pecha.TableCell>

      {showActionsColumn ? (
        <Pecha.TableCell className="text-center">
          <SeriesPlanRowActions
            planId={plan.id}
            planTitle={plan.title}
            status={plan.status}
            seriesId={seriesId}
            sourceGroupId={sourceGroupId}
            groupRole={groupRole}
            platformRole={platformRole}
            readOnly={readOnly}
            onRemoveFromSeries={() => onRemoveFromSeries(plan.id)}
          />
        </Pecha.TableCell>
      ) : null}
    </Pecha.TableRow>
  );
}

type SeriesPlansTableProps = {
  readonly plans: SeriesPlanRow[];
  readonly seriesId: string;
  readonly sourceGroupId?: string | null;
  readonly groupRole?: AuthorGroupMemberRole;
  readonly platformRole?: PlatformRole;
  readonly readOnly?: boolean;
  readonly onReorder: (activeId: string, overId: string) => void;
  readonly onRemoveFromSeries: (planId: string) => void;
};

export function SeriesPlansTable({
  plans,
  seriesId,
  sourceGroupId,
  groupRole,
  platformRole,
  readOnly = false,
  onReorder,
  onRemoveFromSeries,
}: SeriesPlansTableProps) {
  const { t } = useTranslate();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );
  const canReorder = !readOnly && plans.length > 1;
  const showActionsColumn =
    !readOnly && shouldShowCmsActionsColumn(platformRole);
  const ids = plans.map((p) => p.id);

  const handleDragEnd = (event: DragEndEvent) => {
    if (!canReorder) return;
    const { active, over } = event;
    if (over && active.id !== over.id) {
      onReorder(String(active.id), String(over.id));
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
      modifiers={[restrictToVerticalAxis]}
    >
      <Pecha.Table className="bg-white dark:bg-[#181818]">
        <Pecha.TableHeader className="dark:bg-[#1d1d1f]">
          <Pecha.TableRow className="font-dynamic">
            <Pecha.TableHead className="w-10" />
            <Pecha.TableHead className="font-bold">
              {t("studio.common.title")}
            </Pecha.TableHead>

            {showActionsColumn ? (
              <Pecha.TableHead className="w-[100px] text-center font-bold">
                {t("studio.common.actions")}
              </Pecha.TableHead>
            ) : null}
          </Pecha.TableRow>
        </Pecha.TableHeader>
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          <Pecha.TableBody>
            {plans.map((plan) => (
              <SortablePlanRow
                key={plan.id}
                plan={plan}
                seriesId={seriesId}
                sourceGroupId={sourceGroupId}
                groupRole={groupRole}
                platformRole={platformRole}
                readOnly={readOnly}
                onRemoveFromSeries={onRemoveFromSeries}
                canReorder={canReorder}
                showActionsColumn={showActionsColumn}
              />
            ))}
          </Pecha.TableBody>
        </SortableContext>
      </Pecha.Table>
    </DndContext>
  );
}
