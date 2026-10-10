import { useTranslate } from "@tolgee/react";
import type { UseFormReturn } from "react-hook-form";
import { Pecha } from "@/components/ui/shadimport";
import type { EventFormData } from "@/schema/EventSchema";

type EventChatFieldProps = {
  form: UseFormReturn<EventFormData>;
  readOnly: boolean;
};

/**
 * Per-event kill switch for the event's chat room. Turning it off closes the
 * room to new messages and drops any live connections; the conversation and
 * its prayer requests are kept, and turning it back on restores access.
 */
const EventChatField = ({ form, readOnly }: EventChatFieldProps) => {
  const { t } = useTranslate();
  return (
    <Pecha.FormField
      control={form.control}
      name="chat_enabled"
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
              {t("studio.groups.events.chat.enable_label")}
            </Pecha.FormLabel>
            <p className="text-xs text-muted-foreground">
              {t("studio.groups.events.chat.enable_help")}
            </p>
          </div>
          <Pecha.FormMessage />
        </Pecha.FormItem>
      )}
    />
  );
};

export default EventChatField;
