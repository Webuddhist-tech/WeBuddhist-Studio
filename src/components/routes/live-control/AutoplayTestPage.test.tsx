import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AutoplayTestPage from "./AutoplayTestPage";
import type { RecitationDetails } from "./api/liveControlApi";

const {
  fetchLiveControlEvent,
  fetchTextEditions,
  fetchRecitationDetails,
  fetchEditionTitle,
  fetchSegmentPlayTimes,
  fetchEditionYigchungs,
} = vi.hoisted(() => ({
  fetchLiveControlEvent: vi.fn(),
  fetchTextEditions: vi.fn(),
  fetchRecitationDetails: vi.fn(),
  fetchEditionTitle: vi.fn(),
  fetchSegmentPlayTimes: vi.fn(),
  fetchEditionYigchungs: vi.fn(),
}));

vi.mock("./api/liveControlApi", async () => {
  const actual = await vi.importActual<typeof import("./api/liveControlApi")>(
    "./api/liveControlApi",
  );
  return {
    ...actual,
    fetchLiveControlEvent,
    fetchTextEditions,
    fetchRecitationDetails,
    fetchEditionTitle,
    fetchSegmentPlayTimes,
  };
});

vi.mock("./api/libraryTocApi", () => ({ fetchEditionYigchungs }));

/** A text of `count` lines, whose ids and content name it. */
const linesFor = (textId: string, count: number): RecitationDetails => ({
  text_id: textId,
  title: textId,
  segments: Array.from({ length: count }, (_, i) => ({
    recitation: {
      bo: { id: `${textId}-s${i + 1}`, content: `${textId} line ${i + 1}` },
    },
  })),
});

const renderPage = (search = "") => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/live/e1/autoplay-test${search}`]}>
        <Routes>
          <Route
            path="/live/:eventId/autoplay-test"
            element={<AutoplayTestPage />}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

/** The line the dry run is on, by its number on the page (1-based). */
const activeLine = () =>
  document.querySelector('[aria-current="true"]')?.getAttribute("data-line");

/** Opens the "root" text straight from the link, with its lines on screen. */
const openRoot = async () => {
  const user = userEvent.setup();
  renderPage("?text=root");
  expect(await screen.findByText("root line 1")).toBeInTheDocument();
  return user;
};

describe("AutoplayTestPage", () => {
  beforeEach(() => {
    Element.prototype.scrollTo = vi.fn();
    fetchLiveControlEvent.mockReset();
    localStorage.clear();
    // Opened in the controller in this browser before.
    localStorage.setItem(
      "live-control-recent-texts",
      JSON.stringify([{ textId: "root", title: "Praise" }]),
    );
    fetchTextEditions.mockReset();
    fetchTextEditions.mockImplementation(async (textId: string) => ({
      text: { textId, title: textId, language: "bo" },
      editions: [],
    }));
    fetchRecitationDetails.mockReset();
    fetchRecitationDetails.mockImplementation(async (textId: string) =>
      linesFor(textId, 3),
    );
    fetchEditionTitle.mockReset();
    fetchEditionTitle.mockImplementation(
      async (textId: string) => `Title of ${textId}`,
    );
    fetchSegmentPlayTimes.mockReset();
    fetchSegmentPlayTimes.mockResolvedValue({});
    fetchEditionYigchungs.mockReset();
    fetchEditionYigchungs.mockResolvedValue({});
  });

  it("opens on the texts to choose from, and opens the one chosen", async () => {
    const user = userEvent.setup();
    renderPage();

    expect(
      await screen.findByRole("heading", { name: "Choose a text" }),
    ).toBeInTheDocument();
    expect(
      await screen.findByText("Title of Zt5c0fe1OMJI1Kh8rp2FM"),
    ).toBeInTheDocument();
    await user.click(await screen.findByRole("button", { name: /Praise/ }));

    expect(await screen.findByText("root line 1")).toBeInTheDocument();
    expect(screen.queryByText("Choose a text")).not.toBeInTheDocument();
  });

  it("offers the texts opened in the controller, and never reads the event", async () => {
    renderPage();

    expect(
      await screen.findByRole("heading", { name: "Choose a text" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Opened in the controller")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Praise/ })).toBeInTheDocument();
    // The event's record needs a session this page does not have.
    expect(fetchLiveControlEvent).not.toHaveBeenCalled();
  });

  it("offers the suggested texts when nothing was opened here", async () => {
    localStorage.clear();
    renderPage();

    expect(
      await screen.findByText("Title of Zt5c0fe1OMJI1Kh8rp2FM"),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Opened in the controller"),
    ).not.toBeInTheDocument();
  });

  it("plays each line for its recorded time, then stops at the end", async () => {
    fetchSegmentPlayTimes.mockResolvedValue({
      "root-s1": 60,
      "root-s2": 60,
      "root-s3": 60,
    });
    const user = await openRoot();

    await user.click(await screen.findByRole("button", { name: "Play" }));

    await waitFor(() => expect(activeLine()).toBe("0"));
    await waitFor(() => expect(activeLine()).toBe("1"));
    await waitFor(() => expect(activeLine()).toBe("2"));
    expect(
      await screen.findByText("Reached the end of the text."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Play" })).toBeInTheDocument();
  });

  it("stops at a line with no recorded time", async () => {
    fetchSegmentPlayTimes.mockResolvedValue({ "root-s1": 40 });
    const user = await openRoot();

    await user.click(await screen.findByRole("button", { name: "Play" }));

    expect(
      await screen.findByText(
        /Stopped at line 2: it has no recorded play time/,
      ),
    ).toBeInTheDocument();
    expect(activeLine()).toBe("1");
  });

  it("waits for the instruction marks before choosing the first line", async () => {
    fetchSegmentPlayTimes.mockResolvedValue({
      "root-s2": 5000,
      "root-s3": 5000,
    });
    let releaseMarks = () => {};
    fetchEditionYigchungs.mockImplementation(
      () =>
        new Promise((resolve) => {
          releaseMarks = () =>
            resolve({ "root-s1": { full: true, ranges: [], length: 11 } });
        }),
    );
    const user = await openRoot();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Play" })).toBeEnabled(),
    );

    await user.click(screen.getByRole("button", { name: "Play" }));
    await new Promise((resolve) => setTimeout(resolve, 100));
    // Line 1 might be an instruction: nothing is chosen until that is known.
    expect(activeLine()).toBeUndefined();
    expect(screen.getByRole("button", { name: "Next line" })).toBeDisabled();

    await act(async () => releaseMarks());
    // It is one, so the dry run starts on line 2, as live autoplay would.
    await waitFor(() => expect(activeLine()).toBe("1"));
  });

  it("waits for fresh play times before judging a line untimed", async () => {
    let fresh = false;
    fetchSegmentPlayTimes.mockImplementation(async () =>
      fresh ? { "root-s1": 40, "root-s2": 40, "root-s3": 40 } : {},
    );
    const user = await openRoot();
    await waitFor(() => expect(fetchSegmentPlayTimes).toHaveBeenCalled());

    fresh = true;
    await user.click(await screen.findByRole("button", { name: "Play" }));

    expect(
      await screen.findByText("Reached the end of the text."),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Stopped at line/)).not.toBeInTheDocument();
  });

  it("counts no time for the instruction lines it skips", async () => {
    fetchSegmentPlayTimes.mockResolvedValue({
      "root-s1": 1000,
      "root-s2": 2000,
      "root-s3": 3000,
    });
    fetchEditionYigchungs.mockResolvedValue({
      "root-s2": { full: true, ranges: [], length: 11 },
    });
    await openRoot();

    expect(
      await screen.findByText(/2\/2 lines timed · total 4\.0s/),
    ).toBeInTheDocument();
  });
});
