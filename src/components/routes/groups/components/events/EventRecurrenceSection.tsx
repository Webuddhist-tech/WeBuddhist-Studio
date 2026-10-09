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
  { value: 1, label: "January" },
  { value: 2, label: "February" },
  { value: 3, label: "March" },
  { value: 4, label: "April" },
  { value: 5, label: "May" },
  { value: 6, label: "June" },
  { value: 7, label: "July" },
  { value: 8, label: "August" },
  { value: 9, label: "September" },
  { value: 10, label: "October" },
  { value: 11, label: "November" },
  { value: 12, label: "December" },
];

const TIBETAN_MONTHS = [
  { value: 1, label: "1st Month (Losar)" },
  { value: 2, label: "2nd Month" },
  { value: 3, label: "3rd Month" },
  { value: 4, label: "4th Month (Saga Dawa)" },
  { value: 5, label: "5th Month" },
  { value: 6, label: "6th Month" },
  { value: 7, label: "7th Month" },
  { value: 8, label: "8th Month" },
  { value: 9, label: "9th Month" },
  { value: 10, label: "10th Month" },
  { value: 11, label: "11th Month" },
  { value: 12, label: "12th Month" },
];

const EventRecurrenceSection = ({
  form,
  readOnly,
  onRecurrenceChange,
}: EventRecurrenceSectionProps) => {
  const recurrence = form.watch("recurrence");
  const { errors } = form.formState;

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
          <label className="text-sm font-medium">Frequency</label>
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
              <Pecha.SelectItem value="YEARLY">Yearly</Pecha.SelectItem>
              <Pecha.SelectItem value="MONTHLY">Monthly</Pecha.SelectItem>
              <Pecha.SelectItem value="WEEKLY">Weekly</Pecha.SelectItem>
            </Pecha.SelectContent>
          </Pecha.Select>
          {errors.recurrence?.frequency ? (
            <p className="text-sm text-destructive">
              {errors.recurrence.frequency.message}
            </p>
          ) : null}
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Date System</label>
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
              <Pecha.SelectItem value="GREGORIAN">Gregorian</Pecha.SelectItem>
              <Pecha.SelectItem value="TIBETAN_LUNAR" disabled={isWeekly}>
                Tibetan Lunar
              </Pecha.SelectItem>
            </Pecha.SelectContent>
          </Pecha.Select>
          {isWeekly ? (
            <p className="text-sm text-muted-foreground">
              Weekly recurrence only supports the Gregorian calendar.
            </p>
          ) : null}
          {errors.recurrence?.date_system ? (
            <p className="text-sm text-destructive">
              {errors.recurrence.date_system.message}
            </p>
          ) : null}
        </div>
      </div>

      {isLunar && !isWeekly ? (
        <div className="space-y-1">
          <label className="text-sm font-medium">Calendar Type</label>
          <Pecha.Select
            value={recurrence.calendar_type}
            disabled={readOnly}
            onValueChange={(value) => updateField("calendar_type", value)}
          >
            <Pecha.SelectTrigger className="h-12">
              <Pecha.SelectValue placeholder="Select calendar type" />
            </Pecha.SelectTrigger>
            <Pecha.SelectContent>
              <Pecha.SelectItem value="phugpa">Phugpa</Pecha.SelectItem>
              <Pecha.SelectItem value="tsurphu">Tsurphu</Pecha.SelectItem>
            </Pecha.SelectContent>
          </Pecha.Select>
          {errors.recurrence?.calendar_type ? (
            <p className="text-sm text-destructive">
              {errors.recurrence.calendar_type.message}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {isYearly ? (
          <div className="space-y-1">
            <label className="text-sm font-medium">Month</label>
            <Pecha.Select
              value={recurrence.month?.toString() ?? ""}
              disabled={readOnly}
              onValueChange={(value) =>
                updateField("month", value ? parseInt(value, 10) : null)
              }
            >
              <Pecha.SelectTrigger className="h-12">
                <Pecha.SelectValue placeholder="Select month" />
              </Pecha.SelectTrigger>
              <Pecha.SelectContent>
                {monthOptions.map((m) => (
                  <Pecha.SelectItem key={m.value} value={m.value.toString()}>
                    {m.label}
                  </Pecha.SelectItem>
                ))}
              </Pecha.SelectContent>
            </Pecha.Select>
            {errors.recurrence?.month ? (
              <p className="text-sm text-destructive">
                {errors.recurrence.month.message}
              </p>
            ) : null}
          </div>
        ) : null}

        {isWeekly ? (
          <div className="space-y-1">
            <label className="text-sm font-medium">Day of week</label>
            <Pecha.Select
              value={recurrence.day_of_week?.toString() ?? ""}
              disabled={readOnly}
              onValueChange={(value) =>
                updateField("day_of_week", value ? parseInt(value, 10) : null)
              }
            >
              <Pecha.SelectTrigger className="h-12">
                <Pecha.SelectValue placeholder="Select day of week" />
              </Pecha.SelectTrigger>
              <Pecha.SelectContent>
                {DAYS_OF_WEEK.map((d) => (
                  <Pecha.SelectItem key={d.value} value={d.value.toString()}>
                    {d.label}
                  </Pecha.SelectItem>
                ))}
              </Pecha.SelectContent>
            </Pecha.Select>
            {errors.recurrence?.day_of_week ? (
              <p className="text-sm text-destructive">
                {errors.recurrence.day_of_week.message}
              </p>
            ) : null}
          </div>
        ) : (
          <div className="space-y-1">
            <label className="text-sm font-medium">Start date</label>
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
                {errors.recurrence.day.message}
              </p>
            ) : null}
          </div>
        )}

        <div className="space-y-1">
          <label className="text-sm font-medium">Duration (days)</label>
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
              {errors.recurrence.duration_days.message}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default EventRecurrenceSection;
