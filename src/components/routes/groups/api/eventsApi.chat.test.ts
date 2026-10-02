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

describe("buildCreateEventBody — chat_enabled", () => {
  it("enables the event chat by default", () => {
    const body = buildCreateEventBody(baseForm(), "group-1");
    expect(body.chat_enabled).toBe(true);
  });

  it("sends the switched-off value", () => {
    const body = buildCreateEventBody(
      { ...baseForm(), chat_enabled: false },
      "group-1",
    );
    expect(body.chat_enabled).toBe(false);
  });
});

describe("buildUpdateEventBody — chat_enabled", () => {
  it("omits chat_enabled when unchanged", () => {
    const original = baseForm();
    const body = buildUpdateEventBody({ ...original }, original);
    expect("chat_enabled" in body).toBe(false);
  });

  it("sends false when the chat is switched off", () => {
    const original = baseForm();
    const body = buildUpdateEventBody(
      { ...original, chat_enabled: false },
      original,
    );
    expect(body.chat_enabled).toBe(false);
  });

  it("sends true when the chat is switched back on", () => {
    const original = { ...baseForm(), chat_enabled: false };
    const body = buildUpdateEventBody(
      { ...original, chat_enabled: true },
      original,
    );
    expect(body.chat_enabled).toBe(true);
  });
});

describe("mapEventToFormData — chat_enabled", () => {
  it("reads chat_enabled from the event", () => {
    const form = mapEventToFormData({ ...baseEvent, chat_enabled: false });
    expect(form.chat_enabled).toBe(false);
  });

  it("treats an event from before the field existed as chat-enabled", () => {
    expect(mapEventToFormData(baseEvent).chat_enabled).toBe(true);
  });
});
