import type { UseFormReturn } from "react-hook-form";
import { IoMdClose } from "react-icons/io";
import { PiDotsSixVertical } from "react-icons/pi";
import { Pecha } from "@/components/ui/shadimport";
import { SortableItem } from "@/components/ui/atoms/sortable";
import { useLanguages } from "@/hooks/useLanguages";
import type { EventFormData } from "@/schema/EventSchema";
import { EVENT_LINK_TYPES } from "../../lib/eventLinkTypes";

type EventUrlLinkRowProps = {
  form: UseFormReturn<EventFormData>;
  id: string;
  index: number;
  readOnly: boolean;
  canReorder: boolean;
  onRemove: (index: number) => void;
};

const EventUrlLinkRow = ({
  form,
  id,
  index,
  readOnly,
  canReorder,
  onRemove,
}: EventUrlLinkRowProps) => {
  const { languageOptions } = useLanguages();

  const renderRow = ({ listeners }: { listeners: Record<string, unknown> }) => (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2 max-md:min-w-0 max-md:flex-1">
          {!readOnly ? (
            <button
              type="button"
              aria-label="Reorder link"
              disabled={!canReorder}
              className="mt-8 shrink-0 cursor-grab touch-none rounded p-1 text-muted-foreground hover:text-foreground active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-30"
              {...listeners}
            >
              <PiDotsSixVertical className="h-5 w-5" />
            </button>
          ) : null}

          <Pecha.FormField
            control={form.control}
            name={`links.${index}.type`}
            render={({ field: typeField }) => (
              <Pecha.FormItem className="w-48 max-md:min-w-0 max-md:flex-1">
                <Pecha.FormLabel>Type</Pecha.FormLabel>
                <Pecha.Select
                  value={typeField.value}
                  onValueChange={typeField.onChange}
                  disabled={readOnly}
                >
                  <Pecha.FormControl>
                    <Pecha.SelectTrigger className="w-full bg-white dark:bg-[#181818]">
                      <Pecha.SelectValue placeholder="Select a type" />
                    </Pecha.SelectTrigger>
                  </Pecha.FormControl>
                  <Pecha.SelectContent>
                    {EVENT_LINK_TYPES.map((option) => (
                      <Pecha.SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </Pecha.SelectItem>
                    ))}
                  </Pecha.SelectContent>
                </Pecha.Select>
                <Pecha.FormMessage />
              </Pecha.FormItem>
            )}
          />

          <Pecha.FormField
            control={form.control}
            name={`links.${index}.language`}
            render={({ field: langField }) => (
              <Pecha.FormItem className="w-40 max-md:min-w-0 max-md:flex-1">
                <Pecha.FormLabel>Language</Pecha.FormLabel>
                <Pecha.Select
                  value={langField.value}
                  onValueChange={langField.onChange}
                  disabled={readOnly}
                >
                  <Pecha.FormControl>
                    <Pecha.SelectTrigger className="w-full bg-white dark:bg-[#181818]">
                      <Pecha.SelectValue placeholder="Language" />
                    </Pecha.SelectTrigger>
                  </Pecha.FormControl>
                  <Pecha.SelectContent>
                    {languageOptions.map((lang) => (
                      <Pecha.SelectItem key={lang.value} value={lang.value}>
                        {lang.label}
                      </Pecha.SelectItem>
                    ))}
                  </Pecha.SelectContent>
                </Pecha.Select>
                <Pecha.FormMessage />
              </Pecha.FormItem>
            )}
          />
        </div>

        {!readOnly ? (
          <button
            type="button"
            aria-label="Remove link"
            onClick={() => onRemove(index)}
            className="mt-8 text-muted-foreground hover:text-destructive"
          >
            <IoMdClose className="h-5 w-5" />
          </button>
        ) : null}
      </div>

      <Pecha.FormField
        control={form.control}
        name={`links.${index}.url`}
        render={({ field: urlField }) => (
          <Pecha.FormItem>
            <Pecha.FormLabel>URL</Pecha.FormLabel>
            <Pecha.FormControl>
              <Pecha.Input
                {...urlField}
                type="url"
                inputMode="url"
                placeholder="https://example.com"
                disabled={readOnly}
                className="bg-white dark:bg-[#181818]"
              />
            </Pecha.FormControl>
            <Pecha.FormMessage />
          </Pecha.FormItem>
        )}
      />

      <Pecha.FormField
        control={form.control}
        name={`links.${index}.label`}
        render={({ field: labelField }) => (
          <Pecha.FormItem>
            <Pecha.FormLabel>Label (optional)</Pecha.FormLabel>
            <Pecha.FormControl>
              <Pecha.Input
                {...labelField}
                placeholder="Display text"
                disabled={readOnly}
                className="bg-white dark:bg-[#181818]"
              />
            </Pecha.FormControl>
            <Pecha.FormMessage />
          </Pecha.FormItem>
        )}
      />
    </>
  );

  return (
    <SortableItem
      id={id}
      disabled={!canReorder}
      className="space-y-3 rounded-lg border border-border bg-[#FAFAFA] p-4 dark:bg-[#262626]"
    >
      {renderRow}
    </SortableItem>
  );
};

export default EventUrlLinkRow;
