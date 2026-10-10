import { z } from "zod";
import type { LanguageCode } from "@/lib/languageCodes";
import { dateOnlyToDate, isPastDate } from "@/lib/utils";
import { tolgee } from "@/i18n/tolgee";

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
  {
    value: "offline",
    label: "In person",
    labelKey: "studio.ui.options.event_format.offline",
  },
  {
    value: "online",
    label: "Live",
    labelKey: "studio.ui.options.event_format.online",
  },
  {
    value: "hybrid",
    label: "Hybrid",
    labelKey: "studio.ui.options.event_format.hybrid",
  },
] as const;

export type EventFormat = (typeof EVENT_FORMAT_OPTIONS)[number]["value"];

const eventFormatValues = EVENT_FORMAT_OPTIONS.map(
  (option) => option.value,
) as [EventFormat, ...EventFormat[]];

export function eventFormatLabel(
  value: string | null | undefined,
): string | null {
  const option = EVENT_FORMAT_OPTIONS.find((o) => o.value === value);
  return option ? tolgee.t(option.labelKey) : null;
}

export function eventRecurrenceLabel(
  isRecurring?: boolean,
  frequency?: string | null,
): string {
  if (!isRecurring) return tolgee.t("studio.ui.options.recurrence.one_time");
  switch (frequency) {
    case RecurrenceFrequency.WEEKLY:
      return tolgee.t("studio.ui.options.recurrence.weekly");
    case RecurrenceFrequency.MONTHLY:
      return tolgee.t("studio.ui.options.recurrence.monthly");
    case RecurrenceFrequency.YEARLY:
      return tolgee.t("studio.ui.options.recurrence.yearly");
    default:
      return tolgee.t("studio.ui.options.recurrence.recurring");
  }
}

export const eventMetadataRowSchema = z.object({
  language: z.string().trim().min(1, "studio.validation.language_required"),
  name: z.string().trim().min(1, "studio.validation.name_required"),
  description: z.string().trim(),
});

export type EventMetadataRow = z.infer<typeof eventMetadataRowSchema>;

export const eventLinkRowSchema = z.object({
  type: z
    .string()
    .trim()
    .min(1, "studio.validation.type_required")
    .max(50, "studio.validation.type_max_50"),
  url: z
    .string()
    .trim()
    .min(1, "studio.validation.url_required")
    .max(2000, "studio.validation.url_max_2000")
    .refine(
      (value) => /^https?:\/\/.+/i.test(value),
      "studio.validation.url_http_prefix",
    ),
  label: z.string().trim().max(255, "studio.validation.label_max_255"),
  language: z.string().trim().min(1, "studio.validation.language_required"),
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
    .min(1, "studio.validation.url_required")
    .max(2000, "studio.validation.url_max_2000")
    .refine(
      (value) => /^https?:\/\/.+/i.test(value),
      "studio.validation.url_http_prefix",
    )
    .refine(isYoutubeUrl, "studio.validation.url_youtube"),
  label: z.string().trim().max(255, "studio.validation.label_max_255"),
  language: z.string().trim().min(1, "studio.validation.language_required"),
});

export type EventYoutubeRow = z.infer<typeof eventYoutubeRowSchema>;

export const DAYS_OF_WEEK = [
  {
    value: 0,
    label: "Monday",
    labelKey: "studio.ui.options.weekday.monday",
  },
  {
    value: 1,
    label: "Tuesday",
    labelKey: "studio.ui.options.weekday.tuesday",
  },
  {
    value: 2,
    label: "Wednesday",
    labelKey: "studio.ui.options.weekday.wednesday",
  },
  {
    value: 3,
    label: "Thursday",
    labelKey: "studio.ui.options.weekday.thursday",
  },
  {
    value: 4,
    label: "Friday",
    labelKey: "studio.ui.options.weekday.friday",
  },
  {
    value: 5,
    label: "Saturday",
    labelKey: "studio.ui.options.weekday.saturday",
  },
  {
    value: 6,
    label: "Sunday",
    labelKey: "studio.ui.options.weekday.sunday",
  },
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
          message: "studio.validation.recurrence_day_of_week_required",
          path: ["day_of_week"],
        });
      }
      if (data.date_system !== "GREGORIAN") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "studio.validation.recurrence_weekly_gregorian_only",
          path: ["date_system"],
        });
      }
      return;
    }

    if (data.day === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "studio.validation.recurrence_day_required",
        path: ["day"],
      });
      return;
    }

    if (data.date_system === "TIBETAN_LUNAR") {
      if (!data.calendar_type || data.calendar_type.trim() === "") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "studio.validation.recurrence_calendar_type_required",
          path: ["calendar_type"],
        });
      } else if (!["phugpa", "tsurphu"].includes(data.calendar_type)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "studio.validation.recurrence_calendar_type_invalid",
          path: ["calendar_type"],
        });
      }
      if (data.day > 30) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "studio.validation.recurrence_lunar_day_range",
          path: ["day"],
        });
      }
    }

    if (data.frequency === "YEARLY") {
      if (data.month === null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "studio.validation.recurrence_month_required",
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
  metadata: z
    .array(eventMetadataRowSchema)
    .min(1, "studio.validation.add_at_least_one_language"),
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
  intention_ids: z.array(z.string()),
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
        message: "studio.validation.start_date_required",
        path: ["start_date"],
      });
    }
    if (!data.end_date || data.end_date.trim() === "") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "studio.validation.end_date_required",
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
        message: "studio.validation.end_after_start_datetime",
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
        message: "studio.validation.end_time_after_start_time",
        path: ["end_time"],
      });
    }
  }

  const seen = new Set<string>();
  data.metadata.forEach((row, index) => {
    if (seen.has(row.language)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "studio.validation.language_duplicate",
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
        message: "studio.validation.start_date_in_past",
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
  event_format: "hybrid",
  chat_enabled: true,
  notifications_enabled: true,
  intention_ids: [],
});
