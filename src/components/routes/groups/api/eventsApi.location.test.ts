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

const LOCATION_ID = "3f6c1b7e-0000-4000-8000-000000000001";

describe("buildCreateEventBody — location", () => {
  it("includes location_id when one is picked", () => {
    const body = buildCreateEventBody(
      { ...baseForm(), location_id: LOCATION_ID },
      "group-1",
    );
    expect(body.location_id).toBe(LOCATION_ID);
  });

  it("omits location_id entirely when none is picked", () => {
    const body = buildCreateEventBody(baseForm(), "group-1");
    expect("location_id" in body).toBe(false);
  });
});

describe("buildUpdateEventBody — location", () => {
  it("omits location_id when unchanged", () => {
    const original = { ...baseForm(), location_id: LOCATION_ID };
    const body = buildUpdateEventBody({ ...original }, original);
    expect("location_id" in body).toBe(false);
  });

  it("sends the id when a location is assigned", () => {
    const original = baseForm();
    const body = buildUpdateEventBody(
      { ...original, location_id: LOCATION_ID },
      original,
    );
    expect(body.location_id).toBe(LOCATION_ID);
  });

  it("sends null — never an empty string — when cleared", () => {
    const original = { ...baseForm(), location_id: LOCATION_ID };
    const body = buildUpdateEventBody(
      { ...original, location_id: "" },
      original,
    );
    expect(body.location_id).toBeNull();
    expect(body.location_id).not.toBe("");
  });
});

describe("mapEventToFormData — location", () => {
  const event = {
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

  it("reads location_id when the event has one", () => {
    const form = mapEventToFormData({ ...event, location_id: LOCATION_ID });
    expect(form.location_id).toBe(LOCATION_ID);
  });

  it("falls back to an empty string when the field is absent", () => {
    expect(mapEventToFormData(event).location_id).toBe("");
  });
});
