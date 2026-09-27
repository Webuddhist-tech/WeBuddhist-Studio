import { beforeEach, describe, expect, it, vi } from "vitest";
import axiosInstance from "@/config/axios-config";
import {
  buildRecitationSocketUrl,
  fetchRecitationDetails,
  toOperatorSegments,
  type RecitationSegmentRow,
} from "./recitationLiveApi";

vi.mock("@/config/axios-config", () => ({
  default: { post: vi.fn() },
}));

describe("fetchRecitationDetails", () => {
  beforeEach(() => {
    vi.mocked(axiosInstance.post).mockReset();
    vi.mocked(axiosInstance.post).mockResolvedValue({
      data: { text_id: "t1", title: "Tara", segments: [] },
    });
  });

  it("asks for the chosen language in lowercase", async () => {
    await fetchRecitationDetails("t1", "BO");

    expect(axiosInstance.post).toHaveBeenCalledWith("/api/v1/recitations/t1", {
      language: "bo",
      recitation: ["bo"],
      translations: [],
    });
  });

  it("encodes a text id that needs it", async () => {
    await fetchRecitationDetails("a/b c", "en");

    expect(axiosInstance.post).toHaveBeenCalledWith(
      "/api/v1/recitations/a%2Fb%20c",
      expect.anything(),
    );
  });
});

describe("toOperatorSegments", () => {
  const details: { segments: RecitationSegmentRow[] } = {
    segments: [
      {
        recitation: {
          bo: { id: "seg-bo-1", content: "བོད་ ༡" },
          en: { id: "seg-en-1", content: "Line 1" },
        },
      },
      {
        recitation: { bo: { id: "seg-bo-2", content: "བོད་ ༢" } },
      },
      // No recitation bucket at all: nothing to publish, so it is dropped.
      { translations: { en: { id: "tr-3", content: "only a translation" } } },
    ],
  };

  it("takes the chosen language's segment id and content", () => {
    expect(toOperatorSegments(details, "en")).toEqual([
      { id: "seg-en-1", content: "Line 1" },
      // Falls back to what the row actually carries.
      { id: "seg-bo-2", content: "བོད་ ༢" },
    ]);
  });

  it("normalizes the language before matching", () => {
    expect(toOperatorSegments(details, "BO")[0].id).toBe("seg-bo-1");
  });

  it("returns nothing for a text with no segments", () => {
    expect(toOperatorSegments({ segments: [] }, "en")).toEqual([]);
  });
});

describe("buildRecitationSocketUrl", () => {
  it("builds a wss url from an https api base", () => {
    const url = buildRecitationSocketUrl(
      "event-1",
      "tok en",
      "https://api.example.com",
    );

    expect(url).toBe(
      "wss://api.example.com/api/v1/events/event-1/recitation/live?token=tok+en",
    );
  });

  it("uses ws for a plain http api base", () => {
    const url = buildRecitationSocketUrl("event-1", "t", "http://localhost:8000");

    expect(url).toBe(
      "ws://localhost:8000/api/v1/events/event-1/recitation/live?token=t",
    );
  });

  it("falls back to the page origin when no api base is configured", () => {
    const url = buildRecitationSocketUrl("event-1", "t", "");

    expect(url).toContain("/api/v1/events/event-1/recitation/live?token=t");
    expect(url.startsWith("ws://") || url.startsWith("wss://")).toBe(true);
  });

  it("keeps the path when the api base carries a trailing slash", () => {
    const url = buildRecitationSocketUrl(
      "event-1",
      "t",
      "https://api.example.com/",
    );

    expect(url).toBe(
      "wss://api.example.com/api/v1/events/event-1/recitation/live?token=t",
    );
  });
});
