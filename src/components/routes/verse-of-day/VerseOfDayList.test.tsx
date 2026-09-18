import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import VerseOfDayList from "./VerseOfDayList";
import type { VerseOfDayItem } from "./api/verseOfDayApi";

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
    <VerseOfDayList
      verses={verses}
      sortOrder="desc"
      onToggleSort={vi.fn()}
      onEdit={vi.fn()}
      onDelete={vi.fn()}
    />,
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
