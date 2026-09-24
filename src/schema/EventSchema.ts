import { z } from "zod";
import type { LanguageCode } from "@/lib/languageCodes";
import { dateOnlyToDate, isPastDate } from "@/lib/utils";

export const DEFAULT_TIMEZONE = "Asia/Kolkata";
export const DEFAULT_START_TIME = "06:00";
export const DEFAULT_END_TIME = "23:59";

const TIME_HHMM_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

export type { LanguageCode };

export const RecurrenceFrequency = {
  YEARLY: "YEARLY",
  MONTHLY: "MONTHLY",
  WEEKLY: "WEEKLY",
} as const;

export type RecurrenceFrequency =
  (typeof RecurrenceFrequency)[keyof typeof RecurrenceFrequency];

export const RecurrenceDateSystem = {
  GREGORIAN: "GREGORIAN",
  TIBETAN_LUNAR: "TIBETAN_LUNAR",
} as const;

export type RecurrenceDateSystem =
  (typeof RecurrenceDateSystem)[keyof typeof RecurrenceDateSystem];

export const EVENT_FORMAT_OPTIONS = [
  { value: "offline", label: "In person" },
  { value: "online", label: "Live" },
  { value: "hybrid", label: "Hybrid" },
] as const;

export type EventFormat = (typeof EVENT_FORMAT_OPTIONS)[number]["value"];

const eventFormatValues = EVENT_FORMAT_OPTIONS.map(
  (option) => option.value,
) as [EventFormat, ...EventFormat[]];

export function eventFormatLabel(
  value: string | null | undefined,
): string | null {
  return (
    EVENT_FORMAT_OPTIONS.find((option) => option.value === value)?.label ?? null
  );
}

export function eventRecurrenceLabel(
  isRecurring?: boolean,
  frequency?: string | null,
): string {
  if (!isRecurring) return "One-time";
  switch (frequency) {
    case RecurrenceFrequency.WEEKLY:
      return "Weekly";
    case RecurrenceFrequency.MONTHLY:
      return "Monthly";
    case RecurrenceFrequency.YEARLY:
      return "Yearly";
    default:
      return "Recurring";
  }
}

export const eventMetadataRowSchema = z.object({
  language: z.string().trim().min(1, "Language is required"),
  name: z.string().trim().min(1, "Name is required"),
  description: z.string().trim(),
});

export type EventMetadataRow = z.infer<typeof eventMetadataRowSchema>;

export const eventLinkRowSchema = z.object({
  type: z
    .string()
    .trim()
    .min(1, "Type is required")
    .max(50, "Type must be at most 50 characters"),
  url: z
    .string()
    .trim()
    .min(1, "URL is required")
    .max(2000, "URL must be at most 2000 characters")
    .refine(
      (value) => /^https?:\/\/.+/i.test(value),
      "URL must start with http:// or https://",
    ),
  label: z.string().trim().max(255, "Label must be at most 255 characters"),
  language: z.string().trim().min(1, "Language is required"),
});

export type EventLinkRow = z.infer<typeof eventLinkRowSchema>;

function isYoutubeUrl(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    const host = hostname.startsWith("www.") ? hostname.slice(4) : hostname;
    return (
      host === "youtube.com" ||
      host.endsWith(".youtube.com") ||
      host === "youtu.be"
    );
  } catch {
    return false;
  }
}

export const eventYoutubeRowSchema = z.object({
  url: z
    .string()
    .trim()
    .min(1, "URL is required")
    .max(2000, "URL must be at most 2000 characters")
    .refine(
      (value) => /^https?:\/\/.+/i.test(value),
      "URL must start with http:// or https://",
    )
    .refine(isYoutubeUrl, "URL must be a youtube.com or youtu.be link"),
  label: z.string().trim().max(255, "Label must be at most 255 characters"),
  language: z.string().trim().min(1, "Language is required"),
});

export type EventYoutubeRow = z.infer<typeof eventYoutubeRowSchema>;

export const DAYS_OF_WEEK = [
  { value: 0, label: "Monday" },
  { value: 1, label: "Tuesday" },
  { value: 2, label: "Wednesday" },
  { value: 3, label: "Thursday" },
  { value: 4, label: "Friday" },
  { value: 5, label: "Saturday" },
  { value: 6, label: "Sunday" },
] as const;

export const recurrenceSchema = z
  .object({
    frequency: z.enum(["YEARLY", "MONTHLY", "WEEKLY"]),
    date_system: z.enum(["GREGORIAN", "TIBETAN_LUNAR"]),
    calendar_type: z.string().trim().max(10),
    month: z.number().int().min(1).max(12).nullable(),
    day: z.number().int().min(1).max(31).nullable(),
    day_of_week: z.number().int().min(0).max(6).nullable(),
    duration_days: z.number().int().min(1),
  })
  .superRefine((data, ctx) => {
    if (data.frequency === "WEEKLY") {
      if (data.day_of_week === null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Day of week is required for weekly recurrence",
          path: ["day_of_week"],
        });
      }
      if (data.date_system !== "GREGORIAN") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Weekly recurrence only supports the Gregorian calendar",
          path: ["date_system"],
        });
      }
      return;
    }

    if (data.day === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Day is required",
        path: ["day"],
      });
      return;
    }

    if (data.date_system === "TIBETAN_LUNAR") {
      if (!data.calendar_type || data.calendar_type.trim() === "") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Calendar type is required for Tibetan Lunar",
          path: ["calendar_type"],
        });
      } else if (!["phugpa", "tsurphu"].includes(data.calendar_type)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Calendar type must be 'phugpa' or 'tsurphu'",
          path: ["calendar_type"],
        });
      }
      if (data.day > 30) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Lunar day must be between 1 and 30",
          path: ["day"],
        });
      }
    }

    if (data.frequency === "YEARLY") {
      if (data.month === null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Month is required for yearly recurrence",
          path: ["month"],
        });
      }
    }
  });

export type RecurrenceFormData = z.infer<typeof recurrenceSchema>;

const baseEventSchema = z.object({
  is_recurring: z.boolean(),
  start_date: z.string().trim(),
  end_date: z.string().trim(),
  start_time: z.string().regex(TIME_HHMM_REGEX).nullable().optional(),
  end_time: z.string().regex(TIME_HHMM_REGEX).nullable().optional(),
  timezone: z.string().trim().min(1),
  is_one_day: z.boolean(),
  recurrence: recurrenceSchema.nullable(),
  metadata: z.array(eventMetadataRowSchema).min(1, "Add at least one language"),
  links: z.array(eventLinkRowSchema),
  youtube: z.array(eventYoutubeRowSchema),
  image_url: z.string().trim(),
  plan_id: z.string().trim(),
  series_id: z.string().trim(),
  accumulator_id: z.string().trim(),
  group_accumulator_id: z.string().trim(),
  group_recitation_collection_id: z.string().trim(),
  location_id: z.string().trim(),
  event_format: z.enum(eventFormatValues),
  chat_enabled: z.boolean(),
  notifications_enabled: z.boolean(),
});

const commonValidation = (
  data: z.infer<typeof baseEventSchema>,
  ctx: z.RefinementCtx,
) => {
  // Either dates or recurrence required
  if (!data.is_recurring) {
    if (!data.start_date || data.start_date.trim() === "") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Start date is required",
        path: ["start_date"],
      });
    }
    if (!data.end_date || data.end_date.trim() === "") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "End date is required",
        path: ["end_date"],
      });
    }
    if (
      data.start_date &&
      data.end_date &&
      (data.end_date < data.start_date ||
        (data.end_date === data.start_date &&
          (data.end_time || DEFAULT_END_TIME) <
            (data.start_time || DEFAULT_START_TIME)))
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "End date and time must be on or after the start date and time",
        path: ["end_time"],
      });
    }
  } else if (data.recurrence && data.recurrence.duration_days === 1) {
    // Single-day occurrences: the same start/end time applies to every one,
    // so it must make sense as a same-day range like the one-time case does.
    if (
      (data.end_time || DEFAULT_END_TIME) <
      (data.start_time || DEFAULT_START_TIME)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "End time must be on or after the start time",
        path: ["end_time"],
      });
    }
  }

  const seen = new Set<string>();
  data.metadata.forEach((row, index) => {
    if (seen.has(row.language)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Each language can only be added once",
        path: ["metadata", index, "language"],
      });
    }
    seen.add(row.language);
  });
};

export const eventSchema = baseEventSchema.superRefine((data, ctx) => {
  commonValidation(data, ctx);

  // Compare calendar dates only (day granularity), matching the backend's
  // own past-date validation, which also only checks the calendar day and
  // not the exact wall-clock time.
  if (!data.is_recurring && data.start_date) {
    if (isPastDate(dateOnlyToDate(data.start_date))) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Start date cannot be in the past",
        path: ["start_date"],
      });
    }
  }
});

export const eventEditSchema = baseEventSchema.superRefine(commonValidation);

export type EventFormData = z.infer<typeof eventSchema>;

export const emptyMetadataRow = (language: LanguageCode): EventMetadataRow => ({
  language,
  name: "",
  description: "",
});

export const emptyLinkRow = (language: LanguageCode): EventLinkRow => ({
  type: "",
  url: "",
  label: "",
  language,
});

export const emptyYoutubeRow = (language: LanguageCode): EventYoutubeRow => ({
  url: "",
  label: "",
  language,
});

export const emptyRecurrence = (): RecurrenceFormData => ({
  frequency: "YEARLY",
  date_system: "GREGORIAN",
  calendar_type: "",
  month: 1,
  day: 1,
  day_of_week: null,
  duration_days: 1,
});

export const defaultEventFormValues = (): EventFormData => ({
  is_recurring: false,
  start_date: "",
  end_date: "",
  start_time: null,
  end_time: null,
  timezone: DEFAULT_TIMEZONE,
  is_one_day: false,
  recurrence: null,
  metadata: [emptyMetadataRow("EN")],
  links: [],
  youtube: [],
  image_url: "",
  plan_id: "",
  series_id: "",
  accumulator_id: "",
  group_accumulator_id: "",
  group_recitation_collection_id: "",
  location_id: "",
  event_format: "offline",
  chat_enabled: true,
  notifications_enabled: true,
});
