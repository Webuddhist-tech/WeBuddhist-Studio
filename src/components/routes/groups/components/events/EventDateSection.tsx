import { useState } from "react";
import type { UseFormReturn } from "react-hook-form";
import { IoCalendarClearOutline } from "react-icons/io5";
import { format } from "date-fns";
import { Pecha } from "@/components/ui/shadimport";
import { dateOnlyToDate, dateToDateOnly } from "@/lib/utils";
import type { EventFormData, RecurrenceFormData } from "@/schema/EventSchema";
import EventRecurrenceSection from "./EventRecurrenceSection";

// Curated shortlist (Pecha.Select has no search) covering India, the US,
// Europe, and a few APAC zones. Asia/Kolkata is pinned first as the default.
const TIMEZONE_OPTIONS: { value: string; label: string }[] = [
  { value: "Asia/Kolkata", label: "Asia/Kolkata (IST)" },
  { value: "UTC", label: "UTC" },
  { value: "America/Los_Angeles", label: "America/Los Angeles (PT)" },
  { value: "America/Denver", label: "America/Denver (MT)" },
  { value: "America/Chicago", label: "America/Chicago (CT)" },
  { value: "America/New_York", label: "America/New York (ET)" },
  { value: "Europe/London", label: "Europe/London (GMT/BST)" },
  { value: "Europe/Paris", label: "Europe/Paris (CET)" },
  { value: "Asia/Dubai", label: "Asia/Dubai (GST)" },
  { value: "Asia/Kathmandu", label: "Asia/Kathmandu (NPT)" },
  { value: "Asia/Bangkok", label: "Asia/Bangkok (ICT)" },
  { value: "Asia/Shanghai", label: "Asia/Shanghai (CST)" },
  { value: "Asia/Tokyo", label: "Asia/Tokyo (JST)" },
  { value: "Australia/Sydney", label: "Australia/Sydney (AEST/AEDT)" },
  { value: "Pacific/Auckland", label: "Pacific/Auckland (NZST/NZDT)" },
];

type EventDateSectionProps = {
  form: UseFormReturn<EventFormData>;
  isOneDay: boolean;
  readOnly: boolean;
  isNew?: boolean;
  onStartChange: (dateOnly: string) => void;
  onEndChange: (dateOnly: string) => void;
  onStartTimeChange: (hhmm: string | null) => void;
  onEndTimeChange: (hhmm: string | null) => void;
  onTimezoneChange: (timezone: string) => void;
  onOneDayChange: (oneDay: boolean) => void;
  onIsRecurringChange: (isRecurring: boolean) => void;
  onRecurrenceChange: (recurrence: RecurrenceFormData) => void;
};

const DatePickerButton = ({
  value,
  disabled,
  disablePastDates,
  onSelect,
}: {
  value: string;
  disabled?: boolean;
  disablePastDates?: boolean;
  onSelect: (dateOnly: string) => void;
}) => {
  const [open, setOpen] = useState(false);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return (
    <Pecha.Popover open={open} onOpenChange={setOpen}>
      <Pecha.PopoverTrigger asChild>
        <Pecha.Button
          type="button"
          variant="outline"
          disabled={disabled}
          className="h-12 w-full justify-start gap-2 px-3 font-normal rounded-md"
        >
          <IoCalendarClearOutline className="h-4 w-4 text-muted-foreground" />
          <span className={value ? "text-foreground" : "text-muted-foreground"}>
            {value
              ? format(dateOnlyToDate(value), "MMM d, yyyy")
              : "Choose date"}
          </span>
        </Pecha.Button>
      </Pecha.PopoverTrigger>
      <Pecha.PopoverContent className="w-auto p-0" align="start">
        <Pecha.Calendar
          className="cursor-pointer"
          mode="single"
          selected={value ? dateOnlyToDate(value) : undefined}
          disabled={disablePastDates ? (date) => date < today : undefined}
          onSelect={(d) => {
            setOpen(false);
            if (d) onSelect(dateToDateOnly(d));
          }}
        />
      </Pecha.PopoverContent>
    </Pecha.Popover>
  );
};

const EventDateSection = ({
  form,
  isOneDay,
  readOnly,
  isNew = true,
  onStartChange,
  onEndChange,
  onStartTimeChange,
  onEndTimeChange,
  onTimezoneChange,
  onOneDayChange,
  onIsRecurringChange,
  onRecurrenceChange,
}: EventDateSectionProps) => {
  const startDate = form.watch("start_date");
  const endDate = form.watch("end_date");
  const startTime = form.watch("start_time");
  const endTime = form.watch("end_time");
  const timezone = form.watch("timezone");
  const isRecurring = form.watch("is_recurring");
  const { errors } = form.formState;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold">Event Type</h3>
      </div>

      <div className="flex gap-4">
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <Pecha.Checkbox
            checked={!isRecurring}
            disabled={readOnly}
            onCheckedChange={(checked) => {
              if (checked) onIsRecurringChange(false);
            }}
          />
          One-time event
        </label>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <Pecha.Checkbox
            checked={isRecurring}
            disabled={readOnly}
            onCheckedChange={(checked) => {
              if (checked) onIsRecurringChange(true);
            }}
          />
          Recurring event
        </label>
      </div>

      <div className="space-y-1">
        <span className="text-sm font-medium">Timezone</span>
        <Pecha.Select
          value={timezone}
          disabled={readOnly}
          onValueChange={onTimezoneChange}
        >
          <Pecha.SelectTrigger className="h-12">
            <Pecha.SelectValue placeholder="Select timezone" />
          </Pecha.SelectTrigger>
          <Pecha.SelectContent>
            {TIMEZONE_OPTIONS.map((tz) => (
              <Pecha.SelectItem key={tz.value} value={tz.value}>
                {tz.label}
              </Pecha.SelectItem>
            ))}
          </Pecha.SelectContent>
        </Pecha.Select>
        {errors.timezone ? (
          <p className="text-sm text-destructive">{errors.timezone.message}</p>
        ) : null}
      </div>

      {!isRecurring ? (
        <>
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold">Dates</h3>
            <label className="flex items-center gap-2 text-sm">
              <Pecha.Checkbox
                checked={isOneDay}
                disabled={readOnly}
                onCheckedChange={(checked) => onOneDayChange(checked === true)}
              />
              One-day event
            </label>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <span className="text-sm font-medium">Start date</span>
              <DatePickerButton
                value={startDate}
                disabled={readOnly}
                disablePastDates={isNew}
                onSelect={onStartChange}
              />
              {errors.start_date ? (
                <p className="text-sm text-destructive">
                  {errors.start_date.message}
                </p>
              ) : null}
            </div>

            <div className="space-y-1">
              <span className="text-sm font-medium">End date</span>
              <DatePickerButton
                value={endDate}
                disabled={readOnly || isOneDay}
                disablePastDates={isNew}
                onSelect={onEndChange}
              />
              {errors.end_date ? (
                <p className="text-sm text-destructive">
                  {errors.end_date.message}
                </p>
              ) : null}
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold">Recurrence Settings</h3>
          </div>
          <EventRecurrenceSection
            form={form}
            readOnly={readOnly}
            onRecurrenceChange={onRecurrenceChange}
          />
        </>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <span className="text-sm font-medium">Start time</span>
          <Pecha.Input
            type="time"
            step="60"
            className="h-12"
            disabled={readOnly}
            value={startTime ?? ""}
            onChange={(e) => onStartTimeChange(e.target.value || null)}
          />
          <p className="text-xs text-muted-foreground">
            {isRecurring
              ? "Applies to every occurrence. Defaults to 6:00 AM if left blank."
              : "Defaults to 6:00 AM if left blank."}
          </p>
          {errors.start_time ? (
            <p className="text-sm text-destructive">
              {errors.start_time.message}
            </p>
          ) : null}
        </div>

        <div className="space-y-1">
          <span className="text-sm font-medium">End time</span>
          <Pecha.Input
            type="time"
            step="60"
            className="h-12"
            disabled={readOnly}
            value={endTime ?? ""}
            onChange={(e) => onEndTimeChange(e.target.value || null)}
          />
          <p className="text-xs text-muted-foreground">
            {isRecurring
              ? "Applies to every occurrence. Defaults to 11:59 PM if left blank."
              : "Defaults to 11:59 PM if left blank."}
          </p>
          {errors.end_time ? (
            <p className="text-sm text-destructive">
              {errors.end_time.message}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default EventDateSection;
