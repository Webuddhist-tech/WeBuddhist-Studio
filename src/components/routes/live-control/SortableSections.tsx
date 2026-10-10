import type { ReactNode } from "react";
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { CSS } from "@dnd-kit/utilities";
import { MdDragIndicator } from "react-icons/md";

/**
 * The section list, reordered by dragging a section's handle. Only the handle
 * drags, so a tap on a title still goes to it and the list still scrolls under
 * a finger; the handle also moves by keyboard - Space to pick up, arrows, Space.
 */
export const SortableSectionList = ({
  ids,
  onMove,
  children,
}: {
  ids: string[];
  onMove: (activeId: string, overId: string) => void;
  children: ReactNode;
}) => {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (over && active.id !== over.id)
      onMove(String(active.id), String(over.id));
  };
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[restrictToVerticalAxis]}
      onDragEnd={onDragEnd}
    >
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        {children}
      </SortableContext>
    </DndContext>
  );
};

export const SortableSectionRow = ({
  id,
  handleLabel,
  children,
}: {
  id: string;
  /** Names the handle for a screen reader: which section it moves. */
  handleLabel: string;
  children: ReactNode;
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });
  return (
    <div
      ref={setNodeRef}
      data-section-row={id}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`mb-0.5 flex items-center gap-1 ${
        isDragging ? "relative z-10 rounded-[7px] bg-[#1c1c1e] opacity-80" : ""
      }`}
    >
      <button
        type="button"
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        aria-label={handleLabel}
        className="shrink-0 cursor-grab touch-none self-stretch rounded-md px-0.5 text-[#5a5a5f] hover:bg-[#1a1a1c] hover:text-[#8e8e93] active:cursor-grabbing"
      >
        <MdDragIndicator aria-hidden="true" className="size-4" />
      </button>
      {children}
    </div>
  );
};
