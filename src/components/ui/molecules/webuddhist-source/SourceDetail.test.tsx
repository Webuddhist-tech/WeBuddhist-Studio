import { act, render, screen, fireEvent, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchTextDetails } from "@/components/api/searchApi";
import SelectedSourceDetail from "./SourceDetail";

vi.mock("@/components/api/searchApi", () => ({
  fetchTextDetails: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn() },
}));

const segment = (n: number) => ({
  segment_id: `seg-${n}`,
  pecha_segment_id: `pecha-${n}`,
  segment_number: n,
  content: `Segment ${n}`,
});

const selectedSource = { id: "text-1", title: "A Text" };

const renderDetail = (props: Record<string, unknown> = {}) =>
  render(
    <SelectedSourceDetail
      segments={[]}
      selectedSource={selectedSource}
      onAdd={vi.fn()}
      {...props}
    />,
  );

const rangeInput = () =>
  screen.getByPlaceholderText("1-10") as HTMLInputElement;
const selectAllCheckbox = () => screen.getByRole("checkbox");

describe("SelectedSourceDetail select all", () => {
  beforeEach(() => {
    vi.mocked(fetchTextDetails).mockReset();
  });

  it("fills the range from the text's total segment count, not the loaded pages", () => {
    // Only the first page is loaded, but the text is 1000 segments long.
    renderDetail({ segments: [segment(1), segment(2)], totalSegments: 1000 });

    fireEvent.click(selectAllCheckbox());

    expect(rangeInput().value).toBe("1-1000");
  });

  it("navigates to the whole-text range so nothing has to be scrolled", async () => {
    const onRangeNavigate = vi.fn();
    renderDetail({
      segments: [segment(1)],
      totalSegments: 300,
      onRangeNavigate,
    });

    fireEvent.click(selectAllCheckbox());

    await waitFor(() => expect(onRangeNavigate).toHaveBeenCalledWith(1, 300));
  });

  it("is disabled until the segment count is known", () => {
    renderDetail({ segments: [], totalSegments: 0 });

    expect(selectAllCheckbox()).toBeDisabled();
  });

  it("clears the selection when unchecked", () => {
    renderDetail({ segments: [segment(1)], totalSegments: 5 });

    fireEvent.click(selectAllCheckbox());
    expect(rangeInput().value).toBe("1-5");

    fireEvent.click(selectAllCheckbox());
    expect(rangeInput().value).toBe("");
  });

  it("adds every selected segment once the range has loaded", async () => {
    const onAdd = vi.fn();
    const segments = [segment(1), segment(2), segment(3)];
    renderDetail({ segments, totalSegments: 3, onAdd });

    fireEvent.click(selectAllCheckbox());

    // The button reads "Loading…" until the range input has settled.
    const addButton = screen.getByRole("button");
    await waitFor(() => expect(addButton).not.toBeDisabled());
    expect(addButton).toHaveTextContent("Add");

    fireEvent.click(addButton);

    expect(fetchTextDetails).not.toHaveBeenCalled();
    expect(onAdd).toHaveBeenCalledWith({
      content: "Segment 1\nSegment 2\nSegment 3",
      pecha_segment_id: "pecha-1",
      text_id: "text-1",
      segment_ids: ["seg-1", "seg-2", "seg-3"],
      segment_numbers: [1, 2, 3],
    });
  });

  it("adds a long selection in one request without the preview pages", async () => {
    const onAdd = vi.fn();
    vi.mocked(fetchTextDetails).mockResolvedValue({
      content: {
        sections: [
          {
            segments: [segment(1), segment(2), segment(3)],
          },
        ],
      },
    });

    // Only the first preview row is loaded; the text is longer than that page.
    renderDetail({ segments: [segment(1)], totalSegments: 3, onAdd });

    fireEvent.click(selectAllCheckbox());

    const addButton = screen.getByRole("button");
    await waitFor(() => expect(addButton).not.toBeDisabled());
    expect(addButton).toHaveTextContent("Add");

    fireEvent.click(addButton);

    await waitFor(() =>
      expect(fetchTextDetails).toHaveBeenCalledWith({
        textId: "text-1",
        start: 1,
        end: 3,
        size: 3,
      }),
    );
    await waitFor(() =>
      expect(onAdd).toHaveBeenCalledWith({
        content: "Segment 1\nSegment 2\nSegment 3",
        pecha_segment_id: "pecha-1",
        text_id: "text-1",
        segment_ids: ["seg-1", "seg-2", "seg-3"],
        segment_numbers: [1, 2, 3],
      }),
    );
  });

  it("numbers an unnumbered window from the range it was fetched for", async () => {
    const onAdd = vi.fn();
    // Some details responses carry no segment_number; the rows are still the
    // window that was asked for, so they start at 500 rather than at 1.
    const unnumbered = (n: number) => ({
      segment_id: `seg-${n}`,
      pecha_segment_id: `pecha-${n}`,
      content: `Segment ${n}`,
    });
    vi.mocked(fetchTextDetails).mockResolvedValue({
      content: {
        sections: [{ segments: [unnumbered(500), unnumbered(501)] }],
      },
    });

    renderDetail({ segments: [segment(1)], totalSegments: 1000, onAdd });

    fireEvent.change(rangeInput(), { target: { value: "500-501" } });
    const addButton = screen.getByRole("button");
    await waitFor(() => expect(addButton).not.toBeDisabled());

    fireEvent.click(addButton);

    await waitFor(() =>
      expect(fetchTextDetails).toHaveBeenCalledWith({
        textId: "text-1",
        start: 500,
        end: 501,
        size: 2,
      }),
    );
    await waitFor(() =>
      expect(onAdd).toHaveBeenCalledWith({
        content: "Segment 500\nSegment 501",
        pecha_segment_id: "pecha-500",
        text_id: "text-1",
        segment_ids: ["seg-500", "seg-501"],
        segment_numbers: [500, 501],
      }),
    );
  });

  it("does not add a select-all that was cleared while the request was in flight", async () => {
    const onAdd = vi.fn();
    let resolveDetails: (value: unknown) => void = () => {};
    vi.mocked(fetchTextDetails).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveDetails = resolve;
        }),
    );

    renderDetail({ segments: [segment(1)], totalSegments: 3, onAdd });
    fireEvent.click(selectAllCheckbox());

    const addButton = screen.getByRole("button");
    await waitFor(() => expect(addButton).not.toBeDisabled());
    fireEvent.click(addButton);
    await waitFor(() => expect(fetchTextDetails).toHaveBeenCalled());

    fireEvent.click(selectAllCheckbox());
    expect(rangeInput().value).toBe("");

    await act(async () => {
      resolveDetails({
        content: {
          sections: [{ segments: [segment(1), segment(2), segment(3)] }],
        },
      });
    });

    expect(onAdd).not.toHaveBeenCalled();
  });

  it("trims the preview list for a large whole-text selection", () => {
    const segments = Array.from({ length: 250 }, (_, i) => segment(i + 1));
    renderDetail({ segments, totalSegments: 250 });

    fireEvent.click(selectAllCheckbox());

    expect(screen.getByText("Segment 200")).toBeInTheDocument();
    expect(screen.queryByText("Segment 201")).not.toBeInTheDocument();
    expect(
      screen.getByText(/and 50 more selected segments not shown/),
    ).toBeInTheDocument();
  });
});
