import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/routes/task/api/taskApi", () => ({
  uploadImageToS3: vi.fn(),
}));

import { buildCreateEventBody, buildUpdateEventBody } from "./eventsApi";
import { defaultEventFormValues, emptyRecurrence } from "@/schema/EventSchema";

const recurringForm = () => ({
  ...defaultEventFormValues(),
  is_recurring: true,
  recurrence: { ...emptyRecurrence(), frequency: "MONTHLY" as const, day: 10 },
  start_time: "09:30",
  end_time: "17:00",
  timezone: "UTC",
  metadata: [
    { language: "EN" as const, name: "Monthly Tsok", description: "" },
  ],
});

describe("buildCreateEventBody — recurring event time-of-day", () => {
  it("sends start_date/end_date carrying the chosen time alongside the recurrence rule", () => {
    const body = buildCreateEventBody(recurringForm(), "group-1");

    expect(body.recurrence).toBeTruthy();
    expect(body.start_date).toBeDefined();
    expect(body.end_date).toBeDefined();
    expect(body.start_date).toMatch(/T09:30:00/);
    expect(body.end_date).toMatch(/T17:00:00/);
  });

  it("falls back to the default start/end time when left blank", () => {
    const form = { ...recurringForm(), start_time: null, end_time: null };
    const body = buildCreateEventBody(form, "group-1");

    expect(body.start_date).toMatch(/T06:00:00/);
    expect(body.end_date).toMatch(/T23:59:00/);
  });
});

describe("buildCreateEventBody — weekly recurrence", () => {
  it("sends the day_of_week rule for a weekly recurring event", () => {
    const form = {
      ...recurringForm(),
      recurrence: {
        ...emptyRecurrence(),
        frequency: "WEEKLY" as const,
        day: null,
        day_of_week: 4,
      },
    };

    const body = buildCreateEventBody(form, "group-1");

    expect(body.recurrence).toMatchObject({
      frequency: "WEEKLY",
      day_of_week: 4,
    });
  });
});

describe("buildUpdateEventBody — recurring event time-of-day", () => {
  it("sends the new times when only start_time/end_time change while staying recurring", () => {
    const original = recurringForm();
    const updated = { ...original, start_time: "10:00", end_time: "18:00" };

    const body = buildUpdateEventBody(updated, original);

    expect(body.recurrence).toBeUndefined(); // rule itself didn't change
    expect(body.start_date).toMatch(/T10:00:00/);
    expect(body.end_date).toMatch(/T18:00:00/);
  });

  it("sends start_date/end_date when switching from one-time to recurring", () => {
    const original = {
      ...defaultEventFormValues(),
      timezone: "UTC",
      start_date: "2026-01-01",
      end_date: "2026-01-01",
      start_time: "08:00",
      end_time: "09:00",
    };
    const updated = {
      ...original,
      is_recurring: true,
      recurrence: emptyRecurrence(),
    };

    const body = buildUpdateEventBody(updated, original);

    expect(body.recurrence).toBeTruthy();
    expect(body.start_date).toMatch(/T08:00:00/);
    expect(body.end_date).toMatch(/T09:00:00/);
  });

  it("omits start_date/end_date when nothing about the time changed", () => {
    const original = recurringForm();
    const updated = { ...original };

    const body = buildUpdateEventBody(updated, original);

    expect(body.start_date).toBeUndefined();
    expect(body.end_date).toBeUndefined();
  });

  it("sends recurrence: null and the chosen dates when converting to one-time", () => {
    const original = recurringForm();
    const updated = {
      ...original,
      is_recurring: false,
      recurrence: null,
      start_date: "2026-10-01",
      end_date: "2026-10-01",
      start_time: "09:30",
      end_time: "17:00",
    };

    const body = buildUpdateEventBody(updated, original);

    expect(body.recurrence).toBeNull();
    expect(body.start_date).toMatch(/T09:30:00/);
    expect(body.end_date).toMatch(/T17:00:00/);
  });
});
