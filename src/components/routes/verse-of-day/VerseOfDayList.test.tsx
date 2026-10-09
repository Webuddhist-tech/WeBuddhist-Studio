import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import VerseOfDayList from "./VerseOfDayList";
import type { VerseOfDayItem } from "./api/verseOfDayApi";
import { fetchGroup } from "@/components/routes/groups/api/groupsApi";

vi.mock("@/components/routes/groups/api/groupsApi", async () => {
  const actual = await vi.importActual<
    typeof import("@/components/routes/groups/api/groupsApi")
  >("@/components/routes/groups/api/groupsApi");
  return { ...actual, fetchGroup: vi.fn() };
});

const verse = (overrides: Partial<VerseOfDayItem> = {}): VerseOfDayItem => ({
  id: "verse-1",
  verses: { en: "May all beings be happy." },
  verse: "May all beings be happy.",
  image_url: null,
  ref_id: "text-123",
  source: null,
  ref_type: "sutra",
  date: "2025-06-05",
  group_id: null,
  group_info: [],
  ...overrides,
});

const renderList = (verses: VerseOfDayItem[]) =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <VerseOfDayList
        verses={verses}
        sortOrder="desc"
        onToggleSort={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />
    </QueryClientProvider>,
  );

describe("VerseOfDayList — source", () => {
  it("renders the source under the verse text when present", () => {
    renderList([verse({ source: "Dhp 1.5" })]);

    expect(screen.getByText("May all beings be happy.")).toBeInTheDocument();
    expect(screen.getByText("Dhp 1.5")).toBeInTheDocument();
  });

  it("does not render a source line when the response omits it", () => {
    renderList([verse({ source: null })]);

    expect(screen.getByText("May all beings be happy.")).toBeInTheDocument();
    expect(screen.queryByText("Dhp 1.5")).not.toBeInTheDocument();
  });
});

describe("VerseOfDayList — page column", () => {
  it("names the column Page", () => {
    renderList([verse()]);

    expect(
      screen.getByRole("columnheader", { name: "Page" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("columnheader", { name: "Group" }),
    ).not.toBeInTheDocument();
  });

  it("shows a dash when no page is linked", () => {
    renderList([verse({ group_id: null })]);

    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("shows the page details in a popup on hover", async () => {
    vi.mocked(fetchGroup).mockResolvedValue({
      id: "page-1",
      status: "PUBLISHED",
      is_public: true,
      metadata: [
        {
          title: "Dhamma Daily",
          sub_title: "Everyday verses",
          description: "A page of short daily teachings.",
          language: "EN",
        },
      ],
      tags: [],
      follower_count: 12,
    } as never);
    renderList([
      verse({
        group_id: "page-1",
        group_info: [
          {
            id: "page-1",
            title: "Dhamma Daily",
            sub_title: "",
            description: "",
            language: "en",
          },
        ],
      }),
    ]);

    await userEvent.hover(screen.getByRole("button", { name: "Dhamma Daily" }));

    expect(
      await screen.findByText("A page of short daily teachings."),
    ).toBeInTheDocument();
    await waitFor(() => expect(fetchGroup).toHaveBeenCalledWith("page-1"));
    expect(screen.getByText("12 followers")).toBeInTheDocument();
  });
});
