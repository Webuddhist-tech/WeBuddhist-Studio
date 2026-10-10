import { useTranslate } from "@tolgee/react";
import type { UseFormReturn } from "react-hook-form";
import { Pecha } from "@/components/ui/shadimport";
import {
  DAYS_OF_WEEK,
  type EventFormData,
  type RecurrenceFormData,
} from "@/schema/EventSchema";

type EventRecurrenceSectionProps = {
  form: UseFormReturn<EventFormData>;
  readOnly: boolean;
  onRecurrenceChange: (recurrence: RecurrenceFormData) => void;
};

const GREGORIAN_MONTHS = [
  { value: 1, labelKey: "studio.groups.events.recurrence.month_january" },
  { value: 2, labelKey: "studio.groups.events.recurrence.month_february" },
  { value: 3, labelKey: "studio.groups.events.recurrence.month_march" },
  { value: 4, labelKey: "studio.groups.events.recurrence.month_april" },
  { value: 5, labelKey: "studio.groups.events.recurrence.month_may" },
  { value: 6, labelKey: "studio.groups.events.recurrence.month_june" },
  { value: 7, labelKey: "studio.groups.events.recurrence.month_july" },
  { value: 8, labelKey: "studio.groups.events.recurrence.month_august" },
  { value: 9, labelKey: "studio.groups.events.recurrence.month_september" },
  { value: 10, labelKey: "studio.groups.events.recurrence.month_october" },
  { value: 11, labelKey: "studio.groups.events.recurrence.month_november" },
  { value: 12, labelKey: "studio.groups.events.recurrence.month_december" },
];

const TIBETAN_MONTHS = [
  { value: 1, labelKey: "studio.groups.events.recurrence.tibetan_month_1" },
  { value: 2, labelKey: "studio.groups.events.recurrence.tibetan_month_2" },
  { value: 3, labelKey: "studio.groups.events.recurrence.tibetan_month_3" },
  { value: 4, labelKey: "studio.groups.events.recurrence.tibetan_month_4" },
  { value: 5, labelKey: "studio.groups.events.recurrence.tibetan_month_5" },
  { value: 6, labelKey: "studio.groups.events.recurrence.tibetan_month_6" },
  { value: 7, labelKey: "studio.groups.events.recurrence.tibetan_month_7" },
  { value: 8, labelKey: "studio.groups.events.recurrence.tibetan_month_8" },
  { value: 9, labelKey: "studio.groups.events.recurrence.tibetan_month_9" },
  { value: 10, labelKey: "studio.groups.events.recurrence.tibetan_month_10" },
  { value: 11, labelKey: "studio.groups.events.recurrence.tibetan_month_11" },
  { value: 12, labelKey: "studio.groups.events.recurrence.tibetan_month_12" },
];

const EventRecurrenceSection = ({
  form,
  readOnly,
  onRecurrenceChange,
}: EventRecurrenceSectionProps) => {
  const recurrence = form.watch("recurrence");
  const { errors } = form.formState;
  const { t } = useTranslate();

  if (!recurrence) return null;

  const updateField = <K extends keyof RecurrenceFormData>(
    field: K,
    value: RecurrenceFormData[K],
  ) => {
    onRecurrenceChange({ ...recurrence, [field]: value });
  };

  const isLunar = recurrence.date_system === "TIBETAN_LUNAR";
  const isYearly = recurrence.frequency === "YEARLY";
  const isWeekly = recurrence.frequency === "WEEKLY";
  const monthOptions = isLunar ? TIBETAN_MONTHS : GREGORIAN_MONTHS;
  const maxDay = isLunar ? 30 : 31;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <label className="text-sm font-medium">
            {t("studio.groups.events.recurrence.frequency")}
          </label>
          <Pecha.Select
            value={recurrence.frequency}
            disabled={readOnly}
            onValueChange={(value) => {
              const frequency = value as "YEARLY" | "MONTHLY" | "WEEKLY";
              if (frequency === "WEEKLY") {
                // Weekly recurrence only supports the Gregorian calendar.
                onRecurrenceChange({
                  ...recurrence,
                  frequency,
                  date_system: "GREGORIAN",
                  calendar_type: "",
                });
              } else {
                updateField("frequency", frequency);
              }
            }}
          >
            <Pecha.SelectTrigger className="h-12">
              <Pecha.SelectValue />
            </Pecha.SelectTrigger>
            <Pecha.SelectContent>
              <Pecha.SelectItem value="YEARLY">
                {t("studio.groups.events.recurrence.frequency_yearly")}
              </Pecha.SelectItem>
              <Pecha.SelectItem value="MONTHLY">
                {t("studio.groups.events.recurrence.frequency_monthly")}
              </Pecha.SelectItem>
              <Pecha.SelectItem value="WEEKLY">
                {t("studio.groups.events.recurrence.frequency_weekly")}
              </Pecha.SelectItem>
            </Pecha.SelectContent>
          </Pecha.Select>
          {errors.recurrence?.frequency ? (
            <p className="text-sm text-destructive">
              {t(String(errors.recurrence.frequency.message))}
            </p>
          ) : null}
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">
            {t("studio.groups.events.recurrence.date_system")}
          </label>
          <Pecha.Select
            value={recurrence.date_system}
            disabled={readOnly || isWeekly}
            onValueChange={(value) =>
              updateField("date_system", value as "GREGORIAN" | "TIBETAN_LUNAR")
            }
          >
            <Pecha.SelectTrigger className="h-12">
              <Pecha.SelectValue />
            </Pecha.SelectTrigger>
            <Pecha.SelectContent>
              <Pecha.SelectItem value="GREGORIAN">
                {t("studio.groups.events.recurrence.date_system_gregorian")}
              </Pecha.SelectItem>
              <Pecha.SelectItem value="TIBETAN_LUNAR" disabled={isWeekly}>
                {t("studio.groups.events.recurrence.date_system_tibetan_lunar")}
              </Pecha.SelectItem>
            </Pecha.SelectContent>
          </Pecha.Select>
          {isWeekly ? (
            <p className="text-sm text-muted-foreground">
              {t("studio.groups.events.recurrence.weekly_gregorian_only")}
            </p>
          ) : null}
          {errors.recurrence?.date_system ? (
            <p className="text-sm text-destructive">
              {t(String(errors.recurrence.date_system.message))}
            </p>
          ) : null}
        </div>
      </div>

      {isLunar && !isWeekly ? (
        <div className="space-y-1">
          <label className="text-sm font-medium">
            {t("studio.groups.events.recurrence.calendar_type")}
          </label>
          <Pecha.Select
            value={recurrence.calendar_type}
            disabled={readOnly}
            onValueChange={(value) => updateField("calendar_type", value)}
          >
            <Pecha.SelectTrigger className="h-12">
              <Pecha.SelectValue
                placeholder={t(
                  "studio.groups.events.recurrence.calendar_type_placeholder",
                )}
              />
            </Pecha.SelectTrigger>
            <Pecha.SelectContent>
              <Pecha.SelectItem value="phugpa">
                {t("studio.groups.events.recurrence.calendar_phugpa")}
              </Pecha.SelectItem>
              <Pecha.SelectItem value="tsurphu">
                {t("studio.groups.events.recurrence.calendar_tsurphu")}
              </Pecha.SelectItem>
            </Pecha.SelectContent>
          </Pecha.Select>
          {errors.recurrence?.calendar_type ? (
            <p className="text-sm text-destructive">
              {t(String(errors.recurrence.calendar_type.message))}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {isYearly ? (
          <div className="space-y-1">
            <label className="text-sm font-medium">
              {t("studio.groups.events.recurrence.month")}
            </label>
            <Pecha.Select
              value={recurrence.month?.toString() ?? ""}
              disabled={readOnly}
              onValueChange={(value) =>
                updateField("month", value ? parseInt(value, 10) : null)
              }
            >
              <Pecha.SelectTrigger className="h-12">
                <Pecha.SelectValue
                  placeholder={t(
                    "studio.groups.events.recurrence.month_placeholder",
                  )}
                />
              </Pecha.SelectTrigger>
              <Pecha.SelectContent>
                {monthOptions.map((m) => (
                  <Pecha.SelectItem key={m.value} value={m.value.toString()}>
                    {t(m.labelKey)}
                  </Pecha.SelectItem>
                ))}
              </Pecha.SelectContent>
            </Pecha.Select>
            {errors.recurrence?.month ? (
              <p className="text-sm text-destructive">
                {t(String(errors.recurrence.month.message))}
              </p>
            ) : null}
          </div>
        ) : null}

        {isWeekly ? (
          <div className="space-y-1">
            <label className="text-sm font-medium">
              {t("studio.groups.events.recurrence.day_of_week")}
            </label>
            <Pecha.Select
              value={recurrence.day_of_week?.toString() ?? ""}
              disabled={readOnly}
              onValueChange={(value) =>
                updateField("day_of_week", value ? parseInt(value, 10) : null)
              }
            >
              <Pecha.SelectTrigger className="h-12">
                <Pecha.SelectValue
                  placeholder={t(
                    "studio.groups.events.recurrence.day_of_week_placeholder",
                  )}
                />
              </Pecha.SelectTrigger>
              <Pecha.SelectContent>
                {DAYS_OF_WEEK.map((d) => (
                  <Pecha.SelectItem key={d.value} value={d.value.toString()}>
                    {t(`studio.groups.events.recurrence.weekday_${d.value}`)}
                  </Pecha.SelectItem>
                ))}
              </Pecha.SelectContent>
            </Pecha.Select>
            {errors.recurrence?.day_of_week ? (
              <p className="text-sm text-destructive">
                {t(String(errors.recurrence.day_of_week.message))}
              </p>
            ) : null}
          </div>
        ) : (
          <div className="space-y-1">
            <label className="text-sm font-medium">
              {t("studio.groups.events.recurrence.start_day")}
            </label>
            <Pecha.Input
              type="number"
              min={1}
              max={maxDay}
              value={recurrence.day ?? ""}
              disabled={readOnly}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                if (!isNaN(val)) updateField("day", val);
              }}
              className="h-12"
            />
            {errors.recurrence?.day ? (
              <p className="text-sm text-destructive">
                {t(String(errors.recurrence.day.message))}
              </p>
            ) : null}
          </div>
        )}

        <div className="space-y-1">
          <label className="text-sm font-medium">
            {t("studio.groups.events.recurrence.duration_days")}
          </label>
          <Pecha.Input
            type="number"
            min={1}
            value={recurrence.duration_days}
            disabled={readOnly}
            onChange={(e) => {
              const val = parseInt(e.target.value, 10);
              if (!isNaN(val) && val >= 1) updateField("duration_days", val);
            }}
            className="h-12"
          />
          {errors.recurrence?.duration_days ? (
            <p className="text-sm text-destructive">
              {t(String(errors.recurrence.duration_days.message))}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default EventRecurrenceSection;
