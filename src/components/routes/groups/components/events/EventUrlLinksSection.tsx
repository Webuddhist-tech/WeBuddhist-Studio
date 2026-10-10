import { useTranslate } from "@tolgee/react";
import type { UseFormReturn } from "react-hook-form";
import { IoMdAdd } from "react-icons/io";
import { IoWarningOutline } from "react-icons/io5";
import { Pecha } from "@/components/ui/shadimport";
import { SortableList } from "@/components/ui/atoms/sortable";
import type { EventFormData } from "@/schema/EventSchema";
import EventUrlLinkRow from "./EventUrlLinkRow";

type EventUrlLinksSectionProps = {
  form: UseFormReturn<EventFormData>;
  fields: { id: string }[];
  readOnly: boolean;
  onAdd: () => void;
  onRemove: (index: number) => void;
  onMove: (from: number, to: number) => void;
};

const EventUrlLinksSection = ({
  form,
  fields,
  readOnly,
  onAdd,
  onRemove,
  onMove,
}: EventUrlLinksSectionProps) => {
  const { t } = useTranslate();
  const canReorder = !readOnly && fields.length > 1;
  const eventFormat = form.watch("event_format");
  const showLiveLinkWarning = eventFormat === "online" && fields.length === 0;

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
          <h3 className="text-sm font-bold">
            {t("studio.groups.events.url_links.heading")}
          </h3>
          <p className="text-xs text-muted-foreground">
            {t("studio.groups.events.url_links.help")}
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
            <IoMdAdd className="h-4 w-4" />{" "}
            {t("studio.groups.events.url_links.add")}
          </Pecha.Button>
        ) : null}
      </div>

      {fields.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {t("studio.groups.events.url_links.empty")}
        </p>
      ) : null}

      {showLiveLinkWarning ? (
        <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 dark:border-amber-800/60 dark:bg-amber-950/40">
          <IoWarningOutline
            className="mt-0.5 h-4 w-4 shrink-0 text-amber-700 dark:text-amber-300"
            aria-hidden
          />
          <p className="text-xs text-amber-800 dark:text-amber-200/90">
            {t("studio.groups.events.url_links.live_no_links_warning")}
          </p>
        </div>
      ) : null}

      <SortableList
        items={fields.map((f) => f.id)}
        onReorder={handleReorder}
        disabled={!canReorder}
      >
        <div className="space-y-3">
          {fields.map((field, index) => (
            <EventUrlLinkRow
              key={field.id}
              form={form}
              id={field.id}
              index={index}
              readOnly={readOnly}
              canReorder={canReorder}
              onRemove={onRemove}
            />
          ))}
        </div>
      </SortableList>
    </div>
  );
};

export default EventUrlLinksSection;
