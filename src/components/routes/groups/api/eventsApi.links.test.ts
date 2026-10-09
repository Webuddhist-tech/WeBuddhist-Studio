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

describe("buildCreateEventBody — links/youtube", () => {
  it("includes language on each link", () => {
    const body = buildCreateEventBody(
      {
        ...baseForm(),
        links: [
          {
            type: "web",
            url: "https://example.com",
            label: "",
            language: "BO",
          },
        ],
      },
      "group-1",
    );
    expect(body.links).toEqual([
      {
        type: "web",
        url: "https://example.com",
        display_order: 1,
        language: "BO",
      },
    ]);
  });

  it("includes language on each youtube entry, with no type field", () => {
    const body = buildCreateEventBody(
      {
        ...baseForm(),
        youtube: [
          { url: "https://youtu.be/dQw4w9WgXcQ", label: "", language: "EN" },
        ],
      },
      "group-1",
    );
    expect(body.youtube).toEqual([
      { url: "https://youtu.be/dQw4w9WgXcQ", display_order: 1, language: "EN" },
    ]);
  });

  it("omits links and youtube entirely when both are empty", () => {
    const body = buildCreateEventBody(baseForm(), "group-1");
    expect("links" in body).toBe(false);
    expect("youtube" in body).toBe(false);
  });
});

describe("buildUpdateEventBody — links/youtube", () => {
  it("omits links when unchanged", () => {
    const original = {
      ...baseForm(),
      links: [
        { type: "web", url: "https://example.com", label: "", language: "EN" },
      ],
    };
    const body = buildUpdateEventBody({ ...original }, original);
    expect("links" in body).toBe(false);
  });

  it("sends links again when only the language changes", () => {
    const original = {
      ...baseForm(),
      links: [
        { type: "web", url: "https://example.com", label: "", language: "EN" },
      ],
    };
    const changed = {
      ...original,
      links: [{ ...original.links[0], language: "BO" }],
    };
    const body = buildUpdateEventBody(changed, original);
    expect(body.links?.[0].language).toBe("BO");
  });

  it("sends youtube again when only the language changes", () => {
    const original = {
      ...baseForm(),
      youtube: [
        { url: "https://youtu.be/dQw4w9WgXcQ", label: "", language: "EN" },
      ],
    };
    const changed = {
      ...original,
      youtube: [{ ...original.youtube[0], language: "BO" }],
    };
    const body = buildUpdateEventBody(changed, original);
    expect(body.youtube?.[0].language).toBe("BO");
  });
});

describe("mapEventToFormData — links/youtube", () => {
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

  it("carries the language through for links and youtube", () => {
    const form = mapEventToFormData({
      ...event,
      links: [
        {
          id: "l1",
          type: "web",
          url: "https://example.com",
          language: "BO",
          display_order: 1,
        },
      ],
      youtube: [
        {
          id: "y1",
          url: "https://youtu.be/dQw4w9WgXcQ",
          language: "ZH",
          display_order: 1,
        },
      ],
    });
    expect(form.links[0].language).toBe("BO");
    expect(form.youtube[0].language).toBe("ZH");
  });

  it("defaults an unparseable language to EN instead of dropping the row", () => {
    const form = mapEventToFormData({
      ...event,
      links: [
        {
          id: "l1",
          type: "web",
          url: "https://example.com",
          language: "",
          display_order: 1,
        },
      ],
    });
    expect(form.links).toHaveLength(1);
    expect(form.links[0].language).toBe("EN");
  });

  it("defaults links/youtube to empty arrays when absent", () => {
    const form = mapEventToFormData(event);
    expect(form.links).toEqual([]);
    expect(form.youtube).toEqual([]);
  });
});
