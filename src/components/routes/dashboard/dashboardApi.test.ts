import { describe, expect, it } from "vitest";
import {
  displayDashboardItemTitle,
  type DashboardApiItem,
} from "./dashboardApi";
import { fetchDashboardItems } from "./dashboardApi";
import axiosInstance from "@/config/axios-config";
import { vi } from "vitest";
import { resolveDashboardItemImageUrl } from "./dashboardTable";

describe("resolveDashboardItemImageUrl", () => {
  it("uses medium from nested image object", () => {
    expect(
      resolveDashboardItemImageUrl({
        image: {
          medium: "https://example.com/medium.jpg",
          original: "https://example.com/original.jpg",
        },
      }),
    ).toBe("https://example.com/medium.jpg");
  });

  it("prefers image_url over nested image", () => {
    expect(
      resolveDashboardItemImageUrl({
        image_url: "https://example.com/direct.jpg",
        image: { medium: "https://example.com/medium.jpg" },
      }),
    ).toBe("https://example.com/direct.jpg");
  });
});

describe("displayDashboardItemTitle", () => {
  it("uses plan title for plan rows", () => {
    const item: DashboardApiItem = {
      id: "p1",
      type: "plan",
      title: "7-Day Mindfulness",
      status: "PUBLISHED",
      featured: false,
      languages: ["EN"],
      enrolled_count: 0,
      created_at: "2026-01-01T00:00:00Z",
    };
    expect(displayDashboardItemTitle(item)).toBe("7-Day Mindfulness");
  });

  it("uses metadata title for the current UI locale", () => {
    const item: DashboardApiItem = {
      id: "s1",
      type: "series",
      metadata: [
        {
          id: "m1",
          title: "Foundations of Meditation",
          description: "Intro",
          language: "EN",
        },
        {
          id: "m2",
          title: "བོད་སྐད་",
          language: "BO",
        },
      ],
      status: "DRAFT",
      featured: true,
      languages: ["EN", "BO"],
      enrolled_count: 12,
      plans_count: 3,
      created_at: "2026-01-01T00:00:00Z",
    };
    expect(displayDashboardItemTitle(item, "bo-IN")).toBe("བོད་སྐད་");
    expect(displayDashboardItemTitle(item, "en")).toBe(
      "Foundations of Meditation",
    );
  });

  it("uses EN metadata title for series when locale is omitted", () => {
    const item: DashboardApiItem = {
      id: "s1",
      type: "series",
      metadata: [
        {
          id: "m1",
          title: "Foundations of Meditation",
          description: "Intro",
          language: "EN",
        },
        {
          id: "m2",
          title: "བོད་སྐད་",
          language: "BO",
        },
      ],
      status: "DRAFT",
      featured: true,
      languages: ["EN", "BO"],
      enrolled_count: 12,
      plans_count: 3,
      created_at: "2026-01-01T00:00:00Z",
    };
    expect(displayDashboardItemTitle(item)).toBe("Foundations of Meditation");
  });

  it("falls back to the first metadata title when locale title is missing", () => {
    const item: DashboardApiItem = {
      id: "s1",
      type: "series",
      metadata: [
        { id: "m1", title: "", language: "BO" },
        { id: "m2", title: "Only ZH title", language: "ZH" },
        { id: "m3", title: "English backup", language: "EN" },
      ],
      status: "DRAFT",
      featured: false,
      languages: ["BO", "ZH", "EN"],
      enrolled_count: 0,
      created_at: "2026-01-01T00:00:00Z",
    };
    expect(displayDashboardItemTitle(item, "bo-IN")).toBe("Only ZH title");
  });

  it("falls back when series has no metadata", () => {
    const item: DashboardApiItem = {
      id: "s1",
      type: "series",
      status: "DRAFT",
      featured: false,
      languages: ["EN"],
      enrolled_count: 0,
      created_at: "2026-01-01T00:00:00Z",
    };
    expect(displayDashboardItemTitle(item)).toBe(
      "Studio.dashboard.untitled_series",
    );
  });
});

describe("fetchDashboardItems", () => {
  it("maps series title from metadata in table rows", async () => {
    vi.spyOn(axiosInstance, "get").mockResolvedValue({
      data: {
        items: [
          {
            id: "series-1",
            type: "series",
            metadata: [
              {
                id: "meta-1",
                title: "Test Series",
                language: "EN",
              },
            ],
            image: {
              medium: "https://example.com/series-cover.jpg",
            },
            status: "PUBLISHED",
            featured: false,
            languages: ["EN"],
            enrolled_count: 0,
            plans_count: 2,
            created_at: "2026-01-01T00:00:00Z",
          },
        ],
        pagination: { page: 1, page_size: 10, total: 1, total_pages: 1 },
      },
    });

    const result = await fetchDashboardItems({
      tab: "series",
      page: 1,
    });

    expect(result.rows[0]?.title).toBe("Test Series");
    expect(result.rows[0]?.image_url).toBe(
      "https://example.com/series-cover.jpg",
    );
    vi.restoreAllMocks();
  });
});
