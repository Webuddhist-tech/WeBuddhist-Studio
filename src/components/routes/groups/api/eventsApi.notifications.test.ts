import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/routes/task/api/taskApi", () => ({
  uploadImageToS3: vi.fn(),
}));

import {
  buildCreateEventBody,
  buildUpdateEventBody,
  mapEventToFormData,
  type EventDTO,
} from "./eventsApi";
import { defaultEventFormValues } from "@/schema/EventSchema";

const baseForm = () => ({
  ...defaultEventFormValues(),
  start_date: "2026-01-01",
  end_date: "2026-01-01",
  metadata: [{ language: "EN" as const, name: "Teaching", description: "" }],
});

const baseEvent = {
  id: "e1",
  group_id: "group-1",
  start_date: "2026-01-01",
  end_date: "2026-01-01",
  is_one_day: true,
  featured: false,
  event_format: "hybrid",
  metadata: [{ id: "m1", name: "Teaching", language: "EN" }],
  created_at: "2026-01-01",
  created_by: "u1",
} satisfies EventDTO;

describe("buildCreateEventBody — notifications_enabled", () => {
  it("lets a new event notify by default", () => {
    const body = buildCreateEventBody(baseForm(), "group-1");
    expect(body.notifications_enabled).toBe(true);
  });

  it("can create an event that stays silent", () => {
    const body = buildCreateEventBody(
      { ...baseForm(), notifications_enabled: false },
      "group-1",
    );
    expect(body.notifications_enabled).toBe(false);
  });
});

describe("buildUpdateEventBody — notifications_enabled", () => {
  it("omits it when unchanged", () => {
    const original = baseForm();
    const body = buildUpdateEventBody({ ...original }, original);
    expect("notifications_enabled" in body).toBe(false);
  });

  it("sends false when the organizer switches notifications off", () => {
    const original = baseForm();
    const body = buildUpdateEventBody(
      { ...original, notifications_enabled: false },
      original,
    );
    expect(body.notifications_enabled).toBe(false);
  });

  it("sends true when they switch them back on", () => {
    const original = { ...baseForm(), notifications_enabled: false };
    const body = buildUpdateEventBody(
      { ...original, notifications_enabled: true },
      original,
    );
    expect(body.notifications_enabled).toBe(true);
  });
});

describe("mapEventToFormData — notifications_enabled", () => {
  it("reads the switch from the event", () => {
    const form = mapEventToFormData({
      ...baseEvent,
      notifications_enabled: false,
    });
    expect(form.notifications_enabled).toBe(false);
  });

  it("treats an event from before the field existed as notifying", () => {
    expect(mapEventToFormData(baseEvent).notifications_enabled).toBe(true);
  });
});
