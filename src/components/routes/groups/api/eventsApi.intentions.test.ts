import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/routes/task/api/taskApi", () => ({
  uploadImageToS3: vi.fn(),
}));

import {
  buildCreateEventBody,
  buildUpdateEventBody,
  intentionIdsFromEventSlugs,
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

describe("buildCreateEventBody — intention_ids", () => {
  it("omits intention_ids when none selected", () => {
    const body = buildCreateEventBody(baseForm(), "group-1");
    expect("intention_ids" in body).toBe(false);
  });

  it("sends intention_ids when selected", () => {
    const body = buildCreateEventBody(
      { ...baseForm(), intention_ids: ["a", "b"] },
      "group-1",
    );
    expect(body.intention_ids).toEqual(["a", "b"]);
  });
});

describe("buildUpdateEventBody — intention_ids", () => {
  it("omits intention_ids when unchanged", () => {
    const original = { ...baseForm(), intention_ids: ["a"] };
    const body = buildUpdateEventBody({ ...original }, original);
    expect("intention_ids" in body).toBe(false);
  });

  it("sends intention_ids when the selection changes", () => {
    const original = { ...baseForm(), intention_ids: ["a"] };
    const body = buildUpdateEventBody(
      { ...original, intention_ids: ["a", "b"] },
      original,
    );
    expect(body.intention_ids).toEqual(["a", "b"]);
  });

  it("sends empty list when clearing the restriction", () => {
    const original = { ...baseForm(), intention_ids: ["a"] };
    const body = buildUpdateEventBody(
      { ...original, intention_ids: [] },
      original,
    );
    expect(body.intention_ids).toEqual([]);
  });
});

describe("intentionIdsFromEventSlugs", () => {
  it("maps event intention slugs to catalog ids", () => {
    const ids = intentionIdsFromEventSlugs(
      [
        {
          slug: "healing",
          label: "Healing",
          color: "#000",
          description: "",
          display_order: 0,
        },
      ],
      [
        { id: "id-healing", slug: "healing" },
        { id: "id-peace", slug: "peace" },
      ],
    );
    expect(ids).toEqual(["id-healing"]);
  });
});

describe("mapEventToFormData — intention_ids", () => {
  it("starts with an empty selection for slug sync on the form page", () => {
    const form = mapEventToFormData({
      ...baseEvent,
      intentions: [
        {
          slug: "healing",
          label: "Healing",
          color: "#000",
          description: "",
          display_order: 0,
        },
      ],
    });
    expect(form.intention_ids).toEqual([]);
  });
});
