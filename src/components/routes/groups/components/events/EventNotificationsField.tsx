import { useTranslate } from "@tolgee/react";
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
  const { t } = useTranslate();
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
              {t("studio.groups.events.notifications.enable_label")}
            </Pecha.FormLabel>
            <p className="text-xs text-muted-foreground">
              {t("studio.groups.events.notifications.enable_help")}
            </p>
          </div>
          <Pecha.FormMessage />
        </Pecha.FormItem>
      )}
    />
  );
};

export default EventNotificationsField;
