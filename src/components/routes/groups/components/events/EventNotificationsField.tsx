import type { UseFormReturn } from "react-hook-form";
import { Pecha } from "@/components/ui/shadimport";
import type { EventFormData } from "@/schema/EventSchema";

type EventNotificationsFieldProps = {
  form: UseFormReturn<EventFormData>;
  readOnly: boolean;
};

/**
 * Per-event kill switch for everything this event can push: the notice when
 * it is created, the reminders before it starts, and anything sent by hand
 * from here. Turning it off withdraws reminders that were already scheduled;
 * turning it back on schedules the ones still to come.
 *
 * Separate from what a participant can do for themselves - they can mute a
 * single event from the app without the organizer silencing it for everyone.
 */
const EventNotificationsField = ({
  form,
  readOnly,
}: EventNotificationsFieldProps) => {
  return (
    <Pecha.FormField
      control={form.control}
      name="notifications_enabled"
      render={({ field }) => (
        <Pecha.FormItem className="flex flex-row items-start gap-3 space-y-0 rounded-md border border-input bg-white p-4 dark:bg-[#262626]">
          <Pecha.FormControl>
            <Pecha.Checkbox
              checked={field.value}
              onCheckedChange={field.onChange}
              disabled={readOnly}
            />
          </Pecha.FormControl>
          <div className="space-y-1 leading-none">
            <Pecha.FormLabel className="text-sm font-medium">
              Send notifications for this event
            </Pecha.FormLabel>
            <p className="text-xs text-muted-foreground">
              Covers the notice when the event is published, the reminder before
              it starts, and anything you send by hand. Turn it off to keep the
              event silent.
            </p>
          </div>
          <Pecha.FormMessage />
        </Pecha.FormItem>
      )}
    />
  );
};

export default EventNotificationsField;
