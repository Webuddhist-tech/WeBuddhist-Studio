import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchGroupAccumulators } from "@/components/routes/groups/api/groupAccumulatorsApi";
import { fetchChantCollections } from "@/components/routes/groups/api/chantsApi";
import { fetchCmsEvents } from "@/components/routes/groups/api/eventsApi";
import { fetchGroupPosts } from "@/components/routes/groups/api/groupPostsApi";
import {
  LINKED_CONTENT_TYPES,
  fetchLinkedContent,
  isLinkedContentType,
  supportsServerSearch,
} from "./linkedContent";

vi.mock("@/components/routes/groups/api/groupAccumulatorsApi", async (orig) => {
  const actual =
    await orig<
      typeof import("@/components/routes/groups/api/groupAccumulatorsApi")
    >();
  return { ...actual, fetchGroupAccumulators: vi.fn() };
});
vi.mock("@/components/routes/groups/api/chantsApi", async (orig) => {
  const actual =
    await orig<typeof import("@/components/routes/groups/api/chantsApi")>();
  return { ...actual, fetchChantCollections: vi.fn() };
});
vi.mock("@/components/routes/groups/api/eventsApi", async (orig) => {
  const actual =
    await orig<typeof import("@/components/routes/groups/api/eventsApi")>();
  return { ...actual, fetchCmsEvents: vi.fn() };
});
vi.mock("@/components/routes/groups/api/groupPostsApi", async (orig) => {
  const actual =
    await orig<typeof import("@/components/routes/groups/api/groupPostsApi")>();
  return { ...actual, fetchGroupPosts: vi.fn() };
});

const GROUP_ID = "group-1";
const PAGE = { groupId: GROUP_ID, skip: 0, limit: 10 };

beforeEach(() => {
  vi.mocked(fetchGroupAccumulators).mockReset();
  vi.mocked(fetchChantCollections).mockReset();
  vi.mocked(fetchCmsEvents).mockReset();
  vi.mocked(fetchGroupPosts).mockReset();
});

describe("linked content types", () => {
  it("covers the four group-scoped entities a subtask can link", () => {
    expect([...LINKED_CONTENT_TYPES]).toEqual([
      "GROUP_ACCUMULATION",
      "GROUP_COLLECTION",
      "EVENT",
      "POST",
    ]);
  });

  it("recognises linked types and rejects the inline ones", () => {
    expect(isLinkedContentType("EVENT")).toBe(true);
    expect(isLinkedContentType("POST")).toBe(true);
    expect(isLinkedContentType("TEXT")).toBe(false);
    expect(isLinkedContentType("SOURCE_REFERENCE")).toBe(false);
  });

  it("only claims server-side search for accumulations", () => {
    expect(supportsServerSearch("GROUP_ACCUMULATION")).toBe(true);
    expect(supportsServerSearch("GROUP_COLLECTION")).toBe(false);
    expect(supportsServerSearch("EVENT")).toBe(false);
    expect(supportsServerSearch("POST")).toBe(false);
  });
});

describe("fetchLinkedContent", () => {
  it("maps group accumulations and forwards the search term", async () => {
    vi.mocked(fetchGroupAccumulators).mockResolvedValueOnce({
      accumulators: [
        {
          id: "a1",
          title: "Mani",
          target_count: 100000,
          image: { thumbnail: "t", medium: "m", original: "o" },
        },
      ],
      total: 1,
      skip: 0,
      limit: 10,
    } as any);

    const page = await fetchLinkedContent("GROUP_ACCUMULATION", {
      ...PAGE,
      search: "mani",
    });

    expect(fetchGroupAccumulators).toHaveBeenCalledWith(GROUP_ID, {
      skip: 0,
      limit: 10,
      search: "mani",
    });
    expect(page.total).toBe(1);
    expect(page.items[0]).toMatchObject({
      id: "a1",
      title: "Mani",
      subtitle: "Target 100,000",
      imageUrl: "m",
    });
  });

  it("falls back to a placeholder title for an untitled accumulation", async () => {
    vi.mocked(fetchGroupAccumulators).mockResolvedValueOnce({
      accumulators: [
        { id: "a1", title: null, target_count: null, image: null },
      ],
      total: 1,
      skip: 0,
      limit: 10,
    } as any);

    const page = await fetchLinkedContent("GROUP_ACCUMULATION", PAGE);

    expect(page.items[0].title).toBe("Untitled accumulation");
    expect(page.items[0].subtitle).toBeNull();
    expect(page.items[0].imageUrl).toBeNull();
  });

  it("maps chant collections with their item count", async () => {
    vi.mocked(fetchChantCollections).mockResolvedValueOnce({
      collections: [
        { id: "c1", name: "Morning", img_url: "img", item_count: 1 },
        { id: "c2", name: "Evening", item_count: 4 },
      ],
      total: 2,
      skip: 0,
      limit: 10,
    } as any);

    const page = await fetchLinkedContent("GROUP_COLLECTION", PAGE);

    expect(fetchChantCollections).toHaveBeenCalledWith(GROUP_ID, 0, 10);
    expect(page.items[0]).toMatchObject({
      id: "c1",
      title: "Morning",
      subtitle: "1 chant",
    });
    expect(page.items[1].subtitle).toBe("4 chants");
  });

  it("scopes events to the group and names them from metadata", async () => {
    vi.mocked(fetchCmsEvents).mockResolvedValueOnce({
      events: [
        {
          id: "e1",
          start_date: "2026-01-02T00:00:00Z",
          end_date: "2026-01-02T00:00:00Z",
          metadata: [{ id: "m1", name: "Losar", language: "EN" }],
          image: null,
        },
      ],
      total: 1,
      skip: 0,
      limit: 10,
    } as any);

    const page = await fetchLinkedContent("EVENT", PAGE);

    expect(fetchCmsEvents).toHaveBeenCalledWith({
      group_id: GROUP_ID,
      skip: 0,
      limit: 10,
    });
    expect(page.items[0].id).toBe("e1");
    expect(page.items[0].title).toBe("Losar");
    // Same start and end collapse to a single date rather than a range.
    expect(page.items[0].subtitle).not.toContain("–");
  });

  it("uses a post's caption as its title and its first media as the thumbnail", async () => {
    vi.mocked(fetchGroupPosts).mockResolvedValueOnce({
      posts: [
        {
          id: "p1",
          caption: "  A  post   caption  ",
          published_at: "2026-01-02T00:00:00Z",
          media: [{ url: "full", thumbnail_url: "thumb" }],
        },
        {
          id: "p2",
          caption: null,
          published_at: "2026-01-03T00:00:00Z",
          media: [],
        },
      ],
      total: 2,
      skip: 0,
      limit: 10,
    } as any);

    const page = await fetchLinkedContent("POST", PAGE);

    // Hidden posts are not referenceable, so the picker must ask for published only.
    expect(fetchGroupPosts).toHaveBeenCalledWith(GROUP_ID, 0, 10, "PUBLISHED");
    expect(page.items[0].title).toBe("A post caption");
    expect(page.items[0].imageUrl).toBe("thumb");
    expect(page.items[1].title).toBe("Untitled post");
    expect(page.items[1].imageUrl).toBeNull();
  });

  it("truncates a long post caption", async () => {
    vi.mocked(fetchGroupPosts).mockResolvedValueOnce({
      posts: [
        {
          id: "p1",
          caption: "x".repeat(200),
          published_at: "2026-01-02T00:00:00Z",
          media: [],
        },
      ],
      total: 1,
      skip: 0,
      limit: 10,
    } as any);

    const page = await fetchLinkedContent("POST", PAGE);

    expect(page.items[0].title).toHaveLength(90);
    expect(page.items[0].title.endsWith("...")).toBe(true);
  });
});
