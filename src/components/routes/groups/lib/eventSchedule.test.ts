import { describe, expect, it } from "vitest";
import { formatEventSchedule, formatEventScheduleRange } from "./eventSchedule";

describe("formatEventScheduleRange", () => {
  it("returns labeled start and end date-times", () => {
    expect(
      formatEventScheduleRange({
        start_date: "2026-09-11T00:30:00.000Z",
        end_date: "2026-09-11T12:30:00.000Z",
        timezone: "UTC",
      }),
    ).toEqual({
      start: "Sep 11, 2026 · 12:30 AM",
      end: "Sep 11, 2026 · 12:30 PM",
    });
  });

  it("keeps both calendar days for a multi-day event", () => {
    expect(
      formatEventScheduleRange({
        start_date: "2026-09-11T06:00:00.000Z",
        end_date: "2026-09-13T18:00:00.000Z",
        timezone: "UTC",
      }),
    ).toEqual({
      start: "Sep 11, 2026 · 6:00 AM",
      end: "Sep 13, 2026 · 6:00 PM",
    });
  });
});

describe("formatEventSchedule", () => {
  it("joins start and end when they differ", () => {
    expect(
      formatEventSchedule({
        start_date: "2026-09-11T06:00:00.000Z",
        end_date: "2026-09-11T18:00:00.000Z",
        timezone: "UTC",
      }),
    ).toBe("Sep 11, 2026 · 6:00 AM – Sep 11, 2026 · 6:00 PM");
  });

  it("returns an em dash when the start date is missing", () => {
    expect(formatEventSchedule({ start_date: "", end_date: "" })).toBe("—");
  });
});
