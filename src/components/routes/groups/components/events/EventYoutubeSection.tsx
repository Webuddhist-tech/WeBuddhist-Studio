import type { UseFormReturn } from "react-hook-form";
import { IoMdAdd } from "react-icons/io";
import { Pecha } from "@/components/ui/shadimport";
import { SortableList } from "@/components/ui/atoms/sortable";
import type { EventFormData } from "@/schema/EventSchema";
import EventYoutubeRow from "./EventYoutubeRow";

type EventYoutubeSectionProps = {
  form: UseFormReturn<EventFormData>;
  fields: { id: string }[];
  readOnly: boolean;
  /** The group's YouTube channel URL, if the group has one. */
  channelUrl?: string | null;
  onAdd: () => void;
  onRemove: (index: number) => void;
  onMove: (from: number, to: number) => void;
};

const EventYoutubeSection = ({
  form,
  fields,
  readOnly,
  channelUrl = null,
  onAdd,
  onRemove,
  onMove,
}: EventYoutubeSectionProps) => {
  const canReorder = !readOnly && fields.length > 1;

  const handleReorder = (activeId: string, overId: string) => {
    const from = fields.findIndex((f) => f.id === activeId);
    const to = fields.findIndex((f) => f.id === overId);
    if (from === -1 || to === -1) return;
    onMove(from, to);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold">YouTube (optional)</h3>
          <p className="text-xs text-muted-foreground">
            YouTube videos shown on the event.
            {channelUrl && !readOnly
              ? " Pick a live stream from the group's channel or paste a URL."
              : ""}
          </p>
        </div>
        {!readOnly ? (
          <Pecha.Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onAdd}
            className="gap-1"
          >
            <IoMdAdd className="h-4 w-4" /> Add YouTube link
          </Pecha.Button>
        ) : null}
      </div>

      {fields.length === 0 ? (
        <p className="text-sm text-muted-foreground">No YouTube links added.</p>
      ) : null}

      <SortableList
        items={fields.map((f) => f.id)}
        onReorder={handleReorder}
        disabled={!canReorder}
      >
        <div className="space-y-3">
          {fields.map((field, index) => (
            <EventYoutubeRow
              key={field.id}
              form={form}
              id={field.id}
              index={index}
              readOnly={readOnly}
              canReorder={canReorder}
              channelUrl={channelUrl}
              onRemove={onRemove}
            />
          ))}
        </div>
      </SortableList>
    </div>
  );
};

export default EventYoutubeSection;
