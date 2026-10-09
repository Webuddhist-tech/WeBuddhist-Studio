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
import { IoMdAdd, IoMdTrash } from "react-icons/io";
import {
  IoLinkOutline,
  IoLogoFacebook,
  IoLogoInstagram,
  IoLogoSoundcloud,
  IoLogoTiktok,
  IoLogoVimeo,
  IoLogoYoutube,
} from "react-icons/io5";
import { PiDotsSixVertical } from "react-icons/pi";
import { Pecha } from "@/components/ui/shadimport";
import { Button } from "@/components/ui/atoms/button";
import { cn, reorderArray } from "@/lib/utils";
import {
  detectLinkPlatform,
  newLinkRow,
  parseYoutubeVideoId,
  PLATFORM_LABEL,
  type AccumulatorLinkRow,
  type LinkPlatform,
} from "./accumulatorLinkRows";

const PLATFORM_ICON: Record<LinkPlatform, typeof IoLinkOutline> = {
  YOUTUBE: IoLogoYoutube,
  VIMEO: IoLogoVimeo,
  FACEBOOK: IoLogoFacebook,
  INSTAGRAM: IoLogoInstagram,
  TIKTOK: IoLogoTiktok,
  SOUNDCLOUD: IoLogoSoundcloud,
  OTHER: IoLinkOutline,
};

const PLATFORM_ICON_COLOR: Record<LinkPlatform, string> = {
  YOUTUBE: "text-[#FF0000]",
  VIMEO: "text-[#1AB7EA]",
  FACEBOOK: "text-[#1877F2]",
  INSTAGRAM: "text-[#E4405F]",
  TIKTOK: "text-foreground",
  SOUNDCLOUD: "text-[#FF5500]",
  OTHER: "text-muted-foreground",
};

function SortableLinkRow({
  row,
  index,
  canReorder,
  error,
  onChange,
  onRemove,
}: {
  readonly row: AccumulatorLinkRow;
  readonly index: number;
  readonly canReorder: boolean;
  readonly error?: string;
  readonly onChange: (patch: Partial<AccumulatorLinkRow>) => void;
  readonly onRemove: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: row.id, disabled: !canReorder });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  // Preview the resolved type while typing; the server has the final say.
  const videoId = parseYoutubeVideoId(row.url);
  const platform =
    detectLinkPlatform(row.url) ??
    (row.link_type === "YOUTUBE" ? "YOUTUBE" : null);
  const hasUrl = row.url.trim().length > 0;
  const PlatformIcon = PLATFORM_ICON[platform ?? "OTHER"];

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "rounded-md border bg-white dark:bg-[#262626]",
        isDragging && "z-50 shadow-lg",
        error && "border-destructive",
      )}
      {...attributes}
    >
      <div className="flex items-start gap-2 p-2">
        <button
          type="button"
          className="mt-2.5 shrink-0 cursor-grab rounded p-1 text-muted-foreground hover:text-foreground touch-none active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-30"
          aria-label={`Reorder link ${index + 1}`}
          disabled={!canReorder}
          {...listeners}
        >
          <PiDotsSixVertical className="h-4 w-4" />
        </button>

        {/* YouTube shows a real thumbnail; others show their platform icon. */}
        <div className="mt-0.5 shrink-0">
          {videoId ? (
            <img
              src={`https://img.youtube.com/vi/${videoId}/default.jpg`}
              alt=""
              className="h-11 w-16 rounded border object-cover"
            />
          ) : (
            <div className="flex h-11 w-16 items-center justify-center rounded border bg-muted">
              <PlatformIcon
                className={cn(
                  "h-5 w-5",
                  PLATFORM_ICON_COLOR[platform ?? "OTHER"],
                )}
              />
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-1.5">
          <Pecha.Input
            value={row.url}
            onChange={(e) => onChange({ url: e.target.value })}
            placeholder="https://www.youtube.com/watch?v=…"
            aria-label={`Link ${index + 1} URL`}
            aria-invalid={error ? true : undefined}
            className="h-9 bg-white dark:bg-[#262626]"
          />
          <Pecha.Input
            value={row.title}
            onChange={(e) => onChange({ title: e.target.value })}
            placeholder="Title (optional)"
            aria-label={`Link ${index + 1} title`}
            className="h-9 bg-white dark:bg-[#262626]"
          />
          {error ? (
            <p className="text-xs text-destructive">{error}</p>
          ) : hasUrl && platform ? (
            <p className="text-xs text-muted-foreground">
              {PLATFORM_LABEL[platform]}
            </p>
          ) : null}
        </div>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="mt-0.5 shrink-0 text-muted-foreground hover:text-destructive"
          onClick={onRemove}
          aria-label={`Remove link ${index + 1}`}
        >
          <IoMdTrash className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

type AccumulatorLinksFieldProps = {
  readonly rows: AccumulatorLinkRow[];
  readonly errors: Record<string, string>;
  readonly onChange: (rows: AccumulatorLinkRow[]) => void;
};

const AccumulatorLinksField = ({
  rows,
  errors,
  onChange,
}: AccumulatorLinksFieldProps) => {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );
  const canReorder = rows.length > 1;

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const next = reorderArray(rows, String(active.id), String(over.id));
    if (next) onChange(next);
  };

  const updateRow = (id: string, patch: Partial<AccumulatorLinkRow>) => {
    onChange(
      rows.map((row) =>
        row.id === id
          ? // Editing the URL invalidates the server-derived type until resaved.
            { ...row, ...patch, ...("url" in patch ? { link_type: null } : {}) }
          : row,
      ),
    );
  };

  const addRow = () => onChange([...rows, newLinkRow()]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-sm font-bold">Links</p>
          <p className="text-xs text-muted-foreground">
            {canReorder ? "Drag to reorder" : "Videos and other links"}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="shrink-0"
          onClick={addRow}
        >
          <IoMdAdd className="h-4 w-4" /> Add link
        </Button>
      </div>

      {rows.length === 0 ? (
        <button
          type="button"
          onClick={addRow}
          className="w-full rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
        >
          Add a video or link
        </button>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
          modifiers={[restrictToVerticalAxis]}
        >
          <SortableContext
            items={rows.map((row) => row.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-2">
              {rows.map((row, index) => (
                <SortableLinkRow
                  key={row.id}
                  row={row}
                  index={index}
                  canReorder={canReorder}
                  error={errors[row.id]}
                  onChange={(patch) => updateRow(row.id, patch)}
                  onRemove={() =>
                    onChange(rows.filter((item) => item.id !== row.id))
                  }
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
};

export default AccumulatorLinksField;
