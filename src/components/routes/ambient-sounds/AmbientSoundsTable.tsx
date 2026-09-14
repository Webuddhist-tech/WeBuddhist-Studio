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
import { IoMdCreate, IoMdTrash } from "react-icons/io";
import { PiDotsSixVertical } from "react-icons/pi";
import { Pecha } from "@/components/ui/shadimport";
import type { AmbientSound } from "./api/ambientSoundsApi";

function SortableAmbientSoundRow({
  sound,
  canManage,
  canReorder,
  onEdit,
  onDelete,
}: {
  readonly sound: AmbientSound;
  readonly canManage: boolean;
  readonly canReorder: boolean;
  readonly onEdit: (sound: AmbientSound) => void;
  readonly onDelete: (sound: AmbientSound) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: sound.id, disabled: !canReorder });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <Pecha.TableRow ref={setNodeRef} style={style} {...attributes}>
      {canManage ? (
        <Pecha.TableCell className="w-10">
          <button
            type="button"
            className="shrink-0 rounded p-1 text-muted-foreground hover:text-foreground touch-none disabled:cursor-not-allowed disabled:opacity-30"
            aria-label={`Reorder ${sound.name}`}
            disabled={!canReorder}
            {...listeners}
          >
            <PiDotsSixVertical className="h-4 w-4" />
          </button>
        </Pecha.TableCell>
      ) : null}
      <Pecha.TableCell className="font-medium">{sound.name}</Pecha.TableCell>
      <Pecha.TableCell>
        {sound.is_default ? (
          <span className="text-xs px-1.5 py-0.5 rounded bg-[#A51C21]/10 text-[#A51C21]">
            Default
          </span>
        ) : null}
      </Pecha.TableCell>
      {sound.url ? (
        <Pecha.TableCell>
          <audio
            controls
            preload="none"
            src={sound.url}
            className="h-8 max-w-[220px]"
          />
        </Pecha.TableCell>
      ) : (
        <Pecha.TableCell className="text-sm text-muted-foreground">
          —
        </Pecha.TableCell>
      )}
      {canManage ? (
        <Pecha.TableCell>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => onEdit(sound)}
              className="p-2 rounded-md border hover:bg-muted/50 transition-colors"
              aria-label={`Edit ${sound.name}`}
            >
              <IoMdCreate className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => onDelete(sound)}
              className="p-2 rounded-md border text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
              aria-label={`Delete ${sound.name}`}
            >
              <IoMdTrash className="w-4 h-4" />
            </button>
          </div>
        </Pecha.TableCell>
      ) : null}
    </Pecha.TableRow>
  );
}

interface AmbientSoundsTableProps {
  sounds: AmbientSound[];
  isLoading?: boolean;
  canManage: boolean;
  canReorder: boolean;
  onReorder: (activeId: string, overId: string) => void;
  onEdit: (sound: AmbientSound) => void;
  onDelete: (sound: AmbientSound) => void;
}

const AmbientSoundsTable = ({
  sounds,
  isLoading,
  canManage,
  canReorder,
  onReorder,
  onEdit,
  onDelete,
}: AmbientSoundsTableProps) => {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      onReorder(String(active.id), String(over.id));
    }
  };

  if (isLoading) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center">
        Loading ambient sounds...
      </p>
    );
  }

  return (
    <div className="w-full overflow-x-auto">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
        modifiers={[restrictToVerticalAxis]}
      >
        <Pecha.Table>
          <Pecha.TableHeader>
            <Pecha.TableRow>
              {canManage ? <Pecha.TableHead className="w-10" /> : null}
              <Pecha.TableHead>Name</Pecha.TableHead>
              <Pecha.TableHead>Default</Pecha.TableHead>
              <Pecha.TableHead>Preview</Pecha.TableHead>
              {canManage ? (
                <Pecha.TableHead className="w-28 text-right">
                  Actions
                </Pecha.TableHead>
              ) : null}
            </Pecha.TableRow>
          </Pecha.TableHeader>
          <SortableContext
            items={sounds.map((sound) => sound.id)}
            strategy={verticalListSortingStrategy}
          >
            <Pecha.TableBody>
              {sounds.map((sound) => (
                <SortableAmbientSoundRow
                  key={sound.id}
                  sound={sound}
                  canManage={canManage}
                  canReorder={canReorder}
                  onEdit={onEdit}
                  onDelete={onDelete}
                />
              ))}
            </Pecha.TableBody>
          </SortableContext>
        </Pecha.Table>
      </DndContext>
    </div>
  );
};

export default AmbientSoundsTable;
