import { describe, expect, it } from "vitest";
import {
  DEFAULT_TIMEZONE,
  defaultEventFormValues,
  emptyLinkRow,
  emptyMetadataRow,
  emptyYoutubeRow,
  eventFormatLabel,
  eventRecurrenceLabel,
  eventLinkRowSchema,
  eventYoutubeRowSchema,
  eventSchema,
  eventEditSchema,
  type EventFormData,
} from "./EventSchema";

const futureDate = (() => {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return d.toISOString().slice(0, 10);
})();

function baseValidData(overrides: Partial<EventFormData> = {}): EventFormData {
  return {
    ...defaultEventFormValues(),
    start_date: futureDate,
    end_date: futureDate,
    metadata: [emptyMetadataRow("EN")].map((m) => ({ ...m, name: "Event" })),
    ...overrides,
  };
}

describe("eventFormatLabel", () => {
  it("maps each backend value to its display label", () => {
    expect(eventFormatLabel("offline")).toBe("In person");
    expect(eventFormatLabel("online")).toBe("Live");
    expect(eventFormatLabel("hybrid")).toBe("Hybrid");
  });

  it("returns null for an unset or unrecognized value", () => {
    expect(eventFormatLabel(null)).toBeNull();
    expect(eventFormatLabel(undefined)).toBeNull();
    expect(eventFormatLabel("something-else")).toBeNull();
  });
});

describe("eventRecurrenceLabel", () => {
  it("labels a one-time event", () => {
    expect(eventRecurrenceLabel(false)).toBe("One-time");
    expect(eventRecurrenceLabel(undefined)).toBe("One-time");
  });

  it("labels known recurrence frequencies", () => {
    expect(eventRecurrenceLabel(true, "WEEKLY")).toBe("Weekly");
    expect(eventRecurrenceLabel(true, "MONTHLY")).toBe("Monthly");
    expect(eventRecurrenceLabel(true, "YEARLY")).toBe("Yearly");
  });

  it("falls back to Recurring when frequency is missing", () => {
    expect(eventRecurrenceLabel(true)).toBe("Recurring");
    expect(eventRecurrenceLabel(true, "DAILY")).toBe("Recurring");
  });
});

describe("defaultEventFormValues", () => {
  it("defaults start_time/end_time to null and timezone to Asia/Kolkata", () => {
    const defaults = defaultEventFormValues();
    expect(defaults.start_time).toBeNull();
    expect(defaults.end_time).toBeNull();
    expect(defaults.timezone).toBe("Asia/Kolkata");
    expect(DEFAULT_TIMEZONE).toBe("Asia/Kolkata");
  });
});

describe("eventSchema start_time/end_time validation", () => {
  it("accepts null start_time/end_time", () => {
    const result = eventSchema.safeParse(
      baseValidData({ start_time: null, end_time: null }),
    );
    expect(result.success).toBe(true);
  });

  it("accepts a valid HH:mm value", () => {
    const result = eventSchema.safeParse(
      baseValidData({ start_time: "06:00", end_time: "23:59" }),
    );
    expect(result.success).toBe(true);
  });

  it("accepts omitted start_time/end_time (optional)", () => {
    const data = baseValidData();
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { start_time, end_time, ...rest } = data;
    const result = eventSchema.safeParse(rest);
    expect(result.success).toBe(true);
  });

  it.each(["6:00", "24:00", "12:60", "abc", "12:5", ""])(
    "rejects an invalid HH:mm value %s",
    (value) => {
      const result = eventSchema.safeParse(
        baseValidData({ start_time: value }),
      );
      expect(result.success).toBe(false);
    },
  );

  it("rejects an empty timezone", () => {
    const result = eventSchema.safeParse(baseValidData({ timezone: "" }));
    expect(result.success).toBe(false);
  });

  it("rejects a whitespace-only timezone", () => {
    const result = eventSchema.safeParse(baseValidData({ timezone: "   " }));
    expect(result.success).toBe(false);
  });

  it("accepts a non-default IANA timezone", () => {
    const result = eventSchema.safeParse(
      baseValidData({ timezone: "America/New_York" }),
    );
    expect(result.success).toBe(true);
  });
});

describe("eventSchema past-date validation stays day-granularity only", () => {
  it("rejects a start_date that is a past calendar day", () => {
    const result = eventSchema.safeParse(
      baseValidData({ start_date: "2000-01-01", end_date: "2000-01-01" }),
    );
    expect(result.success).toBe(false);
  });

  it("accepts today's date regardless of start_time already having passed", () => {
    const today = new Date().toISOString().slice(0, 10);
    const result = eventSchema.safeParse(
      baseValidData({
        start_date: today,
        end_date: today,
        start_time: "00:01",
      }),
    );
    expect(result.success).toBe(true);
  });
});

describe("eventEditSchema", () => {
  it("does not apply the past-date check (edit mode)", () => {
    const result = eventEditSchema.safeParse(
      baseValidData({ start_date: "2000-01-01", end_date: "2000-01-01" }),
    );
    expect(result.success).toBe(true);
  });
});

describe("eventLinkRowSchema", () => {
  it("requires a language", () => {
    const result = eventLinkRowSchema.safeParse({
      type: "web",
      url: "https://example.com",
      label: "",
      language: "",
    });
    expect(result.success).toBe(false);
  });

  it("accepts a fully populated row", () => {
    const result = eventLinkRowSchema.safeParse({
      type: "web",
      url: "https://example.com",
      label: "Join here",
      language: "BO",
    });
    expect(result.success).toBe(true);
  });
});

describe("eventYoutubeRowSchema", () => {
  it.each([
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "https://youtube.com/watch?v=dQw4w9WgXcQ",
    "https://youtu.be/dQw4w9WgXcQ",
    "https://m.youtube.com/watch?v=dQw4w9WgXcQ",
  ])("accepts a youtube URL: %s", (url) => {
    const result = eventYoutubeRowSchema.safeParse({
      url,
      label: "",
      language: "EN",
    });
    expect(result.success).toBe(true);
  });

  it.each(["https://vimeo.com/12345", "https://example.com", "not-a-url"])(
    "rejects a non-youtube URL: %s",
    (url) => {
      const result = eventYoutubeRowSchema.safeParse({
        url,
        label: "",
        language: "EN",
      });
      expect(result.success).toBe(false);
    },
  );

  it("requires a language", () => {
    const result = eventYoutubeRowSchema.safeParse({
      url: "https://youtu.be/dQw4w9WgXcQ",
      label: "",
      language: "",
    });
    expect(result.success).toBe(false);
  });
});

describe("emptyLinkRow / emptyYoutubeRow", () => {
  it("stamps the given language onto a new link row", () => {
    expect(emptyLinkRow("BO")).toEqual({
      type: "",
      url: "",
      label: "",
      language: "BO",
    });
  });

  it("stamps the given language onto a new youtube row", () => {
    expect(emptyYoutubeRow("ZH")).toEqual({
      url: "",
      label: "",
      language: "ZH",
    });
  });
});
