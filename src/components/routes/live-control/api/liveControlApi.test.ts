import { beforeEach, describe, expect, it, vi } from "vitest";
import axiosInstance from "@/config/axios-config";
import {
  fetchLiturgies,
  fetchLiveControlEvent,
  fetchRecitationDetails,
  fetchTextEditions,
  toOperatorSegments,
  type RecitationSegmentRow,
} from "./liveControlApi";

vi.mock("@/config/axios-config", () => ({
  default: { post: vi.fn(), get: vi.fn() },
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
      // Falls back to the only recitation the row carries.
      { id: "seg-bo-2", content: "བོད་ ༢" },
    ]);
  });

  it("normalizes the language before matching", () => {
    expect(toOperatorSegments(details, " BO ")[0].id).toBe("seg-bo-1");
  });

  it("returns nothing for a text with no segments", () => {
    expect(toOperatorSegments({ segments: [] }, "bo")).toEqual([]);
  });
});

describe("fetchLiveControlEvent", () => {
  beforeEach(() => {
    vi.mocked(axiosInstance.get).mockReset();
  });

  it("prefers the English name and keeps the collection id", async () => {
    vi.mocked(axiosInstance.get).mockResolvedValue({
      data: {
        metadata: [
          { language: "bo", name: "སྒྲོལ་མ།" },
          { language: "en", name: "  Tara Puja  " },
        ],
        group_recitation_collection_id: "col-1",
      },
    });

    await expect(fetchLiveControlEvent("e1")).resolves.toEqual({
      title: "Tara Puja",
      collectionId: "col-1",
    });
    expect(axiosInstance.get).toHaveBeenCalledWith("/api/v1/events/e1");
  });

  it("takes a single metadata object, and an event with no collection", async () => {
    vi.mocked(axiosInstance.get).mockResolvedValue({
      data: { metadata: { language: "bo", name: "སྒྲོལ་མ།" } },
    });

    await expect(fetchLiveControlEvent("e1")).resolves.toEqual({
      title: "སྒྲོལ་མ།",
      collectionId: null,
    });
  });

  it("names an event whose metadata is empty", async () => {
    vi.mocked(axiosInstance.get).mockResolvedValue({ data: { metadata: [] } });

    await expect(fetchLiveControlEvent("e1")).resolves.toEqual({
      title: "Untitled event",
      collectionId: null,
    });
  });
});

describe("fetchTextEditions", () => {
  beforeEach(() => {
    vi.mocked(axiosInstance.get).mockReset();
  });

  it("returns the text first, then every translation of it", async () => {
    vi.mocked(axiosInstance.get).mockResolvedValue({
      data: {
        text: { id: "root", title: " Praise ", language: "BO" },
        versions: [
          { id: "root-en", title: "Praise (en)", language: "en" },
          { id: "root-zh", title: "Praise (zh)", language: "zh" },
        ],
      },
    });

    await expect(fetchTextEditions("root")).resolves.toEqual({
      text: { textId: "root", title: "Praise", language: "bo" },
      editions: [
        { textId: "root-en", title: "Praise (en)", language: "en" },
        { textId: "root-zh", title: "Praise (zh)", language: "zh" },
      ],
    });
    expect(axiosInstance.get).toHaveBeenCalledWith(
      "/api/v1/texts/root/versions",
      { params: { limit: 100 } },
    );
  });

  it("never lists the text as a translation of itself", async () => {
    vi.mocked(axiosInstance.get).mockResolvedValue({
      data: {
        text: { id: "root", title: "Praise", language: "bo" },
        // Upstream can echo the text back among its own versions.
        versions: [
          { id: "root", title: "Praise", language: "bo" },
          { id: "root-en", title: "Praise (en)", language: "en" },
        ],
      },
    });

    const { editions } = await fetchTextEditions("root");

    expect(editions).toEqual([
      { textId: "root-en", title: "Praise (en)", language: "en" },
    ]);
  });

  it("stands in for a text the library describes sparsely", async () => {
    vi.mocked(axiosInstance.get).mockResolvedValue({ data: {} });

    await expect(fetchTextEditions("root")).resolves.toEqual({
      text: { textId: "root", title: "root", language: "" },
      editions: [],
    });
  });
});

describe("fetchLiturgies", () => {
  beforeEach(() => {
    vi.mocked(axiosInstance.get).mockReset();
  });

  it("returns the liturgies in the order they are recited", async () => {
    vi.mocked(axiosInstance.get).mockResolvedValue({
      data: {
        items: [
          { text_id: "t2", title: "Second", display_order: 2 },
          { text_id: "t1", title: "First", display_order: 1 },
        ],
      },
    });

    await expect(fetchLiturgies("col-1")).resolves.toEqual([
      { textId: "t1", title: "First" },
      { textId: "t2", title: "Second" },
    ]);
    expect(axiosInstance.get).toHaveBeenCalledWith(
      "/api/v1/author/groups/recitation-collections/col-1",
    );
  });

  it("falls back to the text id when an item has no title", async () => {
    vi.mocked(axiosInstance.get).mockResolvedValue({
      data: { items: [{ text_id: "t1", display_order: 1 }] },
    });

    await expect(fetchLiturgies("col-1")).resolves.toEqual([
      { textId: "t1", title: "t1" },
    ]);
  });
});
