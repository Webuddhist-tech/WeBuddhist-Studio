import { useTranslate } from "@tolgee/react";
import { useQuery } from "@tanstack/react-query";
import type { UseFormReturn } from "react-hook-form";
import { Pecha } from "@/components/ui/shadimport";
import { fetchPrayerIntentions } from "@/components/routes/prayer-intentions/api/prayerIntentionsApi";
import type { EventFormData } from "@/schema/EventSchema";

type EventIntentionsFieldProps = {
  form: UseFormReturn<EventFormData>;
  readOnly: boolean;
};

const EventIntentionsField = ({
  form,
  readOnly,
}: EventIntentionsFieldProps) => {
  const { t } = useTranslate();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["cms-prayer-intentions"],
    queryFn: fetchPrayerIntentions,
    refetchOnWindowFocus: false,
    staleTime: 60_000,
  });

  const options = data?.intentions ?? [];
  const selectedIds = form.watch("intention_ids");

  const toggleId = (id: string, checked: boolean) => {
    const current = form.getValues("intention_ids");
    const next = checked
      ? [...current, id]
      : current.filter((value) => value !== id);
    form.setValue("intention_ids", next, { shouldDirty: true });
  };

  return (
    <Pecha.FormField
      control={form.control}
      name="intention_ids"
      render={() => (
        <Pecha.FormItem className="rounded-md border border-input bg-white p-4 dark:bg-[#262626]">
          <Pecha.FormLabel className="text-sm font-medium">
            {t("studio.groups.events.intentions.label")}
          </Pecha.FormLabel>
          <p className="text-xs text-muted-foreground mb-3">
            {t("studio.groups.events.intentions.help")}
          </p>
          {isLoading ? (
            <p className="text-xs text-muted-foreground">
              {t("studio.groups.events.intentions.loading")}
            </p>
          ) : null}
          {isError ? (
            <p className="text-xs text-destructive">
              {t("studio.groups.events.intentions.load_error")}
            </p>
          ) : null}
          {!isLoading && !isError && options.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              {t("studio.groups.events.intentions.empty")}
            </p>
          ) : null}
          <div className="flex flex-col gap-2">
            {options.map((intention) => {
              const checked = selectedIds.includes(intention.id);
              const checkboxId = `event-intention-${intention.id}`;
              return (
                <label
                  key={intention.id}
                  htmlFor={checkboxId}
                  className="flex cursor-pointer items-start gap-3 rounded-md border border-transparent px-1 py-1 hover:bg-muted/40"
                >
                  <Pecha.Checkbox
                    id={checkboxId}
                    checked={checked}
                    disabled={readOnly}
                    onCheckedChange={(value) =>
                      toggleId(intention.id, value === true)
                    }
                  />
                  <span className="flex flex-col gap-0.5 leading-none">
                    <span className="text-sm font-medium">
                      {intention.label}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {intention.slug}
                    </span>
                  </span>
                  <span
                    className="ml-auto h-4 w-4 shrink-0 rounded border border-input"
                    style={{ backgroundColor: intention.color }}
                    aria-hidden
                  />
                </label>
              );
            })}
          </div>
          <Pecha.FormMessage />
        </Pecha.FormItem>
      )}
    />
  );
};

export default EventIntentionsField;
