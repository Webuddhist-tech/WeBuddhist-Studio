import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import LiveControlPage from "./LiveControlPage";
import type { RecitationDetails } from "./api/liveControlApi";

const {
  fetchLiveControlEvent,
  fetchLiturgies,
  fetchTextEditions,
  fetchRecitationDetails,
  publishPosition,
  endRecitationSession,
  fetchEditionSections,
} = vi.hoisted(() => ({
  fetchLiveControlEvent: vi.fn(),
  fetchLiturgies: vi.fn(),
  fetchTextEditions: vi.fn(),
  fetchRecitationDetails: vi.fn(),
  publishPosition: vi.fn(
    async (): Promise<{ ok: boolean; message?: string }> => ({ ok: true }),
  ),
  endRecitationSession: vi.fn(
    async (): Promise<{ ok: boolean; message?: string }> => ({ ok: true }),
  ),
  fetchEditionSections: vi.fn(),
}));

vi.mock("./api/liveControlApi", async () => {
  const actual = await vi.importActual<typeof import("./api/liveControlApi")>(
    "./api/liveControlApi",
  );
  return {
    ...actual,
    fetchLiveControlEvent,
    fetchLiturgies,
    fetchTextEditions,
    fetchRecitationDetails,
    publishPosition,
    endRecitationSession,
  };
});

vi.mock("./api/libraryTocApi", () => ({ fetchEditionSections }));

vi.mock("react-router-dom", async () => {
  const actual =
    await vi.importActual<typeof import("react-router-dom")>(
      "react-router-dom",
    );
  return { ...actual, useParams: () => ({ eventId: "e1" }) };
});

/** A text of `count` lines, whose ids and content name the edition. */
const linesFor = (
  textId: string,
  language: string,
  count: number,
): RecitationDetails => ({
  text_id: textId,
  title: textId,
  segments: Array.from({ length: count }, (_, i) => ({
    recitation: {
      [language]: {
        id: `${textId}-s${i + 1}`,
        content: `${textId} line ${i + 1}`,
      },
    },
  })),
});

const renderPage = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <LiveControlPage />
    </QueryClientProvider>,
  );
};

const pressKey = async (code: string) => {
  await act(async () => {
    document.body.dispatchEvent(
      new KeyboardEvent("keydown", { code, bubbles: true, cancelable: true }),
    );
  });
};

describe("LiveControlPage", () => {
  beforeEach(() => {
    fetchLiveControlEvent.mockReset();
    fetchLiturgies.mockReset();
    fetchTextEditions.mockReset();
    fetchRecitationDetails.mockReset();
    publishPosition.mockClear();
    publishPosition.mockResolvedValue({ ok: true });
    endRecitationSession.mockClear();
    endRecitationSession.mockResolvedValue({ ok: true });
    fetchEditionSections.mockReset();
    fetchEditionSections.mockResolvedValue([]);
    localStorage.clear();
    Element.prototype.scrollIntoView = vi.fn();

    fetchLiveControlEvent.mockResolvedValue({
      title: "Tara Puja",
      collectionId: "col-1",
    });
    fetchLiturgies.mockResolvedValue([
      { textId: "root", title: "Praise to the 21 Tārās" },
      { textId: "other", title: "Refuge" },
    ]);
    // The work, plus the two translations the library holds of it.
    fetchTextEditions.mockImplementation(async (textId: string) =>
      textId === "root"
        ? {
            text: { textId: "root", title: "Praise (bo)", language: "bo" },
            editions: [
              { textId: "root-en", title: "Praise (en)", language: "en" },
              { textId: "root-zh", title: "Praise (zh)", language: "zh" },
            ],
          }
        : {
            text: { textId, title: `${textId} (bo)`, language: "bo" },
            editions: [],
          },
    );
    fetchRecitationDetails.mockImplementation(
      async (textId: string, language: string) => linesFor(textId, language, 3),
    );
  });

  it("opens the first liturgy and lists its translations to pick from", async () => {
    renderPage();

    expect(await screen.findByText("root line 1")).toBeInTheDocument();
    expect(fetchRecitationDetails).toHaveBeenCalledWith("root", "bo");
    expect(
      screen.getByRole("checkbox", { name: "Follow Praise (en)" }),
    ).not.toBeChecked();
    expect(
      screen.getByRole("checkbox", { name: "Follow Praise (zh)" }),
    ).toBeInTheDocument();
    // The edition being read is always published, so its tick is fixed on.
    const driver = screen.getByRole("checkbox", { name: "Follow Praise (bo)" });
    expect(driver).toBeChecked();
    expect(driver).toBeDisabled();
  });

  it("loads a pasted text id and its translations", async () => {
    const user = userEvent.setup();
    fetchLiveControlEvent.mockResolvedValue({
      title: "Tara Puja",
      collectionId: null,
    });
    renderPage();

    await user.type(await screen.findByLabelText("Text id"), "root");
    await user.click(screen.getByRole("button", { name: "Add" }));

    expect(await screen.findByText("root line 1")).toBeInTheDocument();
    expect(fetchTextEditions).toHaveBeenCalledWith("root");
    expect(
      screen.getByRole("checkbox", { name: "Follow Praise (en)" }),
    ).toBeInTheDocument();
  });

  it("fetches a ticked edition there and then, not when a line is picked", async () => {
    const user = userEvent.setup();
    localStorage.setItem("recitation_emit_token", "tok-123");
    renderPage();
    expect(await screen.findByText("root line 1")).toBeInTheDocument();

    await user.click(
      screen.getByRole("checkbox", { name: "Follow Praise (en)" }),
    );

    // Already loaded before any line is chosen.
    await waitFor(() =>
      expect(fetchRecitationDetails).toHaveBeenCalledWith("root-en", "en"),
    );
    expect(
      await screen.findByText(/1 more edition following/),
    ).toBeInTheDocument();

    fetchRecitationDetails.mockClear();
    await user.click(screen.getByRole("button", { name: /root line 2/ }));

    await waitFor(() => expect(publishPosition).toHaveBeenCalledTimes(2));
    expect(fetchRecitationDetails).not.toHaveBeenCalled();
  });

  it("moves every ticked edition with one press", async () => {
    const user = userEvent.setup();
    localStorage.setItem("recitation_emit_token", "tok-123");
    renderPage();
    expect(await screen.findByText("root line 1")).toBeInTheDocument();

    await user.click(
      screen.getByRole("checkbox", { name: "Follow Praise (en)" }),
    );
    await waitFor(() =>
      expect(fetchRecitationDetails).toHaveBeenCalledWith("root-en", "en"),
    );
    await user.click(
      screen.getByRole("checkbox", { name: "Follow Praise (zh)" }),
    );
    await waitFor(() =>
      expect(fetchRecitationDetails).toHaveBeenCalledWith("root-zh", "zh"),
    );
    publishPosition.mockClear();

    await pressKey("Space");

    // One position per edition: each is its own library text with its own ids.
    await waitFor(() => expect(publishPosition).toHaveBeenCalledTimes(3));
    expect(publishPosition).toHaveBeenCalledWith("e1", "tok-123", {
      textId: "root",
      segmentId: "root-s1",
      index: 0,
      roundNumber: 1,
    });
    expect(publishPosition).toHaveBeenCalledWith("e1", "tok-123", {
      textId: "root-en",
      segmentId: "root-en-s1",
      index: 0,
      roundNumber: 1,
    });
    expect(publishPosition).toHaveBeenCalledWith("e1", "tok-123", {
      textId: "root-zh",
      segmentId: "root-zh-s1",
      index: 0,
      roundNumber: 1,
    });
  });

  it("sends the followed editions together, then the one on screen last", async () => {
    const user = userEvent.setup();
    localStorage.setItem("recitation_emit_token", "tok-123");
    // The event holds one position, so the last post accepted is what the room
    // keeps: it has to be the edition being read, not a translation that
    // happened to answer last. The two followed ones still go out together -
    // both are in flight before either is released.
    const order: string[] = [];
    let inFlight = 0;
    let releaseFollowers: () => void = () => {};
    const bothInFlight = new Promise<void>((resolve) => {
      releaseFollowers = resolve;
    });
    publishPosition.mockImplementation(
      async (_eventId: string, _token: string, cue: { textId: string }) => {
        order.push(cue.textId);
        if (cue.textId === "root") return { ok: true };
        inFlight += 1;
        if (inFlight === 2) releaseFollowers();
        await bothInFlight;
        return { ok: true };
      },
    );

    renderPage();
    expect(await screen.findByText("root line 1")).toBeInTheDocument();
    await user.click(
      screen.getByRole("checkbox", { name: "Follow Praise (en)" }),
    );
    await waitFor(() =>
      expect(fetchRecitationDetails).toHaveBeenCalledWith("root-en", "en"),
    );
    await user.click(
      screen.getByRole("checkbox", { name: "Follow Praise (zh)" }),
    );
    await waitFor(() =>
      expect(fetchRecitationDetails).toHaveBeenCalledWith("root-zh", "zh"),
    );
    publishPosition.mockClear();
    order.length = 0;
    inFlight = 0;

    await pressKey("Space");

    await waitFor(() => expect(publishPosition).toHaveBeenCalledTimes(3));
    expect(inFlight).toBe(2);
    expect(order.slice(0, 2).sort()).toEqual(["root-en", "root-zh"]);
    expect(order[2]).toBe("root");
  });

  it("stops moving an edition once it is unticked", async () => {
    const user = userEvent.setup();
    localStorage.setItem("recitation_emit_token", "tok-123");
    renderPage();
    expect(await screen.findByText("root line 1")).toBeInTheDocument();

    const english = screen.getByRole("checkbox", {
      name: "Follow Praise (en)",
    });
    await user.click(english);
    await waitFor(() =>
      expect(fetchRecitationDetails).toHaveBeenCalledWith("root-en", "en"),
    );
    await user.click(english);
    expect(english).not.toBeChecked();
    publishPosition.mockClear();

    await pressKey("Space");

    await waitFor(() => expect(publishPosition).toHaveBeenCalledTimes(1));
    expect(publishPosition).toHaveBeenCalledWith(
      "e1",
      "tok-123",
      expect.objectContaining({ textId: "root" }),
    );
  });

  it("reads a translation instead when it is chosen, publishing its own ids", async () => {
    const user = userEvent.setup();
    localStorage.setItem("recitation_emit_token", "tok-123");
    renderPage();
    expect(await screen.findByText("root line 1")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Praise \(en\)/ }));
    expect(await screen.findByText("root-en line 1")).toBeInTheDocument();

    await pressKey("Space");

    await waitFor(() =>
      expect(publishPosition).toHaveBeenCalledWith("e1", "tok-123", {
        textId: "root-en",
        segmentId: "root-en-s1",
        index: 0,
        roundNumber: 1,
      }),
    );
  });

  it("drops the previous work's editions when another liturgy is picked", async () => {
    const user = userEvent.setup();
    localStorage.setItem("recitation_emit_token", "tok-123");
    renderPage();
    expect(await screen.findByText("root line 1")).toBeInTheDocument();
    await user.click(
      screen.getByRole("checkbox", { name: "Follow Praise (en)" }),
    );
    await waitFor(() =>
      expect(fetchRecitationDetails).toHaveBeenCalledWith("root-en", "en"),
    );

    await user.click(screen.getByRole("button", { name: "Refuge" }));
    expect(await screen.findByText("other line 1")).toBeInTheDocument();
    expect(
      screen.queryByRole("checkbox", { name: "Follow Praise (en)" }),
    ).not.toBeInTheDocument();
    publishPosition.mockClear();

    await pressKey("Space");

    await waitFor(() => expect(publishPosition).toHaveBeenCalledTimes(1));
    expect(publishPosition).toHaveBeenCalledWith(
      "e1",
      "tok-123",
      expect.objectContaining({ textId: "other", segmentId: "other-s1" }),
    );
  });

  it("moves a followed edition by recitation row, not by line number", async () => {
    const user = userEvent.setup();
    localStorage.setItem("recitation_emit_token", "tok-123");
    // This edition carries no recitation for the first row, so that row is not
    // one of its lines and every line after it sits one position earlier than
    // the same line of the text being read.
    fetchRecitationDetails.mockImplementation(
      async (textId: string, language: string) =>
        textId === "root-en"
          ? {
              text_id: "root-en",
              title: "root-en",
              segments: [
                {
                  translations: {
                    en: { id: "root-en-t1", content: "only a gloss" },
                  },
                },
                {
                  recitation: {
                    en: { id: "root-en-s2", content: "root-en line 2" },
                  },
                },
                {
                  recitation: {
                    en: { id: "root-en-s3", content: "root-en line 3" },
                  },
                },
              ],
            }
          : linesFor(textId, language, 3),
    );

    renderPage();
    expect(await screen.findByText("root line 1")).toBeInTheDocument();
    await user.click(
      screen.getByRole("checkbox", { name: "Follow Praise (en)" }),
    );
    await waitFor(() =>
      expect(fetchRecitationDetails).toHaveBeenCalledWith("root-en", "en"),
    );
    publishPosition.mockClear();

    await pressKey("Space");
    await pressKey("Space");

    // Second line of the text being read is the second row, which this edition
    // holds as its first line - not its second.
    await waitFor(() =>
      expect(publishPosition).toHaveBeenCalledWith("e1", "tok-123", {
        textId: "root-en",
        segmentId: "root-en-s2",
        index: 0,
        roundNumber: 1,
      }),
    );
    expect(publishPosition).not.toHaveBeenCalledWith(
      "e1",
      "tok-123",
      expect.objectContaining({ segmentId: "root-en-s3" }),
    );
  });

  it("publishes nothing for the liturgy just left while the next one loads", async () => {
    const user = userEvent.setup();
    localStorage.setItem("recitation_emit_token", "tok-123");
    // The second liturgy's editions never arrive, which is any moment before
    // they do: there is nothing to drive, so Next must not move the room.
    fetchTextEditions.mockImplementation(async (textId: string) => {
      if (textId === "root") {
        return {
          text: { textId: "root", title: "Praise (bo)", language: "bo" },
          editions: [],
        };
      }
      return new Promise(() => {});
    });

    renderPage();
    expect(await screen.findByText("root line 1")).toBeInTheDocument();
    await pressKey("Space");
    await waitFor(() => expect(publishPosition).toHaveBeenCalledTimes(1));

    await user.click(screen.getByText("Refuge"));
    await pressKey("Space");
    await pressKey("ArrowRight");

    expect(publishPosition).toHaveBeenCalledTimes(1);
    expect(publishPosition).not.toHaveBeenCalledWith(
      "e1",
      "tok-123",
      expect.objectContaining({ segmentId: "root-s2" }),
    );
  });

  it("drops a queued move when the session is ended", async () => {
    const user = userEvent.setup();
    localStorage.setItem("recitation_emit_token", "tok-123");
    const events: string[] = [];
    let releaseFirst: () => void = () => {};
    const firstHeld = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    let calls = 0;
    publishPosition.mockImplementation(
      async (_eventId: string, _token: string, cue: { segmentId: string }) => {
        calls += 1;
        events.push(`publish ${cue.segmentId}`);
        if (calls === 1) await firstHeld;
        return { ok: true };
      },
    );
    endRecitationSession.mockImplementation(async () => {
      events.push("end");
      return { ok: true };
    });

    renderPage();
    expect(await screen.findByText("root line 1")).toBeInTheDocument();

    await pressKey("Space"); // on the wire, held
    await pressKey("Space"); // queued behind it
    await user.click(screen.getByText("End session"));
    await act(async () => {
      releaseFirst();
    });

    await waitFor(() => expect(endRecitationSession).toHaveBeenCalled());
    // The queued line never goes out, and nothing is published after the end.
    expect(events).toEqual(["publish root-s1", "end"]);
    expect(
      screen.getByText("This recitation session has ended."),
    ).toBeInTheDocument();
  });

  it("says when a translation does not line up with what is being read", async () => {
    const user = userEvent.setup();
    fetchRecitationDetails.mockImplementation(
      async (textId: string, language: string) =>
        linesFor(textId, language, textId === "root-en" ? 2 : 3),
    );
    renderPage();
    expect(await screen.findByText("root line 1")).toBeInTheDocument();

    await user.click(
      screen.getByRole("checkbox", { name: "Follow Praise (en)" }),
    );

    expect(await screen.findByText(/does not line up/)).toBeInTheDocument();
  });

  it("publishes with the pasted token and remembers it for next time", async () => {
    const user = userEvent.setup();
    renderPage();
    expect(await screen.findByText("root line 1")).toBeInTheDocument();

    await user.type(await screen.findByLabelText("Emit token"), "tok-123");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(screen.queryByLabelText("Emit token")).not.toBeInTheDocument();
    expect(localStorage.getItem("recitation_emit_token")).toBe("tok-123");

    await user.click(screen.getByRole("button", { name: "Next →" }));

    await waitFor(() =>
      expect(publishPosition).toHaveBeenCalledWith("e1", "tok-123", {
        textId: "root",
        segmentId: "root-s1",
        index: 0,
        roundNumber: 1,
      }),
    );
  });

  it("refuses to drive the room before a token is pasted", async () => {
    const user = userEvent.setup();
    renderPage();
    expect(await screen.findByText("root line 1")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Next →" }));

    expect(publishPosition).not.toHaveBeenCalled();
    expect(
      await screen.findByText(/paste the emit token/i),
    ).toBeInTheDocument();
    expect(screen.getByTestId("publish-state")).toHaveTextContent(
      "no emit token",
    );
  });

  it("advances and steps back on the keyboard", async () => {
    const user = userEvent.setup();
    localStorage.setItem("recitation_emit_token", "tok-123");
    renderPage();
    expect(await screen.findByText("root line 1")).toBeInTheDocument();

    await pressKey("Space");
    await waitFor(() =>
      expect(publishPosition).toHaveBeenCalledWith(
        "e1",
        "tok-123",
        expect.objectContaining({ segmentId: "root-s1", index: 0 }),
      ),
    );

    await pressKey("ArrowRight");
    await waitFor(() =>
      expect(publishPosition).toHaveBeenCalledWith(
        "e1",
        "tok-123",
        expect.objectContaining({ segmentId: "root-s2", index: 1 }),
      ),
    );

    await pressKey("ArrowLeft");
    await waitFor(() =>
      expect(publishPosition).toHaveBeenCalledWith(
        "e1",
        "tok-123",
        expect.objectContaining({ segmentId: "root-s1", index: 0 }),
      ),
    );

    // Never before the first line.
    publishPosition.mockClear();
    await pressKey("ArrowLeft");
    expect(publishPosition).not.toHaveBeenCalled();

    // Space on a control does what that control does, not what the room does.
    const next = screen.getByRole("button", { name: "Next →" });
    next.focus();
    const notSwallowed = next.dispatchEvent(
      new KeyboardEvent("keydown", {
        code: "Space",
        bubbles: true,
        cancelable: true,
      }),
    );
    expect(notSwallowed).toBe(true);
    expect(publishPosition).not.toHaveBeenCalled();
    await user.click(next); // the page is still usable afterwards
  });

  it("keeps a refused position so the next move sends it again", async () => {
    const user = userEvent.setup();
    localStorage.setItem("recitation_emit_token", "tok-123");
    publishPosition.mockResolvedValue({
      ok: false,
      message: "That emit token was rejected.",
    });
    renderPage();
    expect(await screen.findByText("root line 1")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Next →" }));
    expect(
      await screen.findByText(/emit token was rejected/i),
    ).toBeInTheDocument();
    expect(screen.getByTestId("publish-state")).toHaveTextContent(
      "not publishing",
    );

    // The room never took line 1, so re-tapping it publishes again rather than
    // being skipped as already sent.
    publishPosition.mockClear();
    await user.click(screen.getByRole("button", { name: /root line 1/ }));
    await waitFor(() => expect(publishPosition).toHaveBeenCalledTimes(1));
  });

  it("publishes the round the operator sets", async () => {
    const user = userEvent.setup();
    localStorage.setItem("recitation_emit_token", "tok-123");
    renderPage();
    expect(await screen.findByText("root line 1")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Next round" }));
    await user.click(screen.getByRole("button", { name: "Next →" }));

    await waitFor(() =>
      expect(publishPosition).toHaveBeenCalledWith(
        "e1",
        "tok-123",
        expect.objectContaining({ roundNumber: 2 }),
      ),
    );
  });

  it("ends the session with the same token", async () => {
    const user = userEvent.setup();
    localStorage.setItem("recitation_emit_token", "tok-123");
    renderPage();
    expect(await screen.findByText("root line 1")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "End session" }));

    await waitFor(() =>
      expect(endRecitationSession).toHaveBeenCalledWith("e1", "tok-123"),
    );
    expect(await screen.findByText(/session has ended/i)).toBeInTheDocument();
  });

  describe("the outline of the edition on screen", () => {
    /** Two sections of the three-line text: the second starts at line 3. */
    const outline = [
      { id: "s1", title: "Going for Refuge", depth: 0, segmentId: "root-s1" },
      { id: "s2", title: "Praises", depth: 0, segmentId: "root-s3" },
    ];

    it("lists the sections of the edition being read", async () => {
      fetchEditionSections.mockResolvedValue(outline);
      renderPage();

      expect(
        await screen.findByRole("button", { name: "Praises" }),
      ).toBeInTheDocument();
      expect(fetchEditionSections).toHaveBeenCalledWith("root", "bo");
    });

    it("asks for the outline of a translation when that is read instead", async () => {
      const user = userEvent.setup();
      fetchEditionSections.mockResolvedValue(outline);
      renderPage();
      expect(await screen.findByText("root line 1")).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: /Praise \(en\)/ }));

      await waitFor(() =>
        expect(fetchEditionSections).toHaveBeenCalledWith("root-en", "en"),
      );
    });

    it("goes to the first segment of a section that is picked", async () => {
      const user = userEvent.setup();
      localStorage.setItem("recitation_emit_token", "tok-123");
      fetchEditionSections.mockResolvedValue(outline);
      renderPage();
      expect(await screen.findByText("root line 1")).toBeInTheDocument();

      await user.click(await screen.findByRole("button", { name: "Praises" }));

      await waitFor(() =>
        expect(publishPosition).toHaveBeenCalledWith("e1", "tok-123", {
          textId: "root",
          segmentId: "root-s3",
          index: 2,
          roundNumber: 1,
        }),
      );
      expect(screen.getByText(/line 3\/3/)).toBeInTheDocument();
    });

    it("marks the section the recitation has reached", async () => {
      const user = userEvent.setup();
      fetchEditionSections.mockResolvedValue(outline);
      renderPage();
      const praises = await screen.findByRole("button", { name: "Praises" });
      const refuge = screen.getByRole("button", { name: "Going for Refuge" });

      // Nothing is marked before the operator has a position at all.
      expect(refuge).toHaveAttribute("data-section-active", "false");

      await user.click(screen.getByRole("button", { name: /root line 2/ }));
      expect(refuge).toHaveAttribute("data-section-active", "true");
      expect(praises).toHaveAttribute("data-section-active", "false");

      await user.click(screen.getByRole("button", { name: "Next →" }));
      expect(praises).toHaveAttribute("data-section-active", "true");
      expect(refuge).toHaveAttribute("data-section-active", "false");
    });

    it("shows a section with nothing to go to but does not move for it", async () => {
      fetchEditionSections.mockResolvedValue([
        // Anchored to a segment this recitation does not carry.
        { id: "s3", title: "Colophon", depth: 0, segmentId: "root-s9" },
      ]);
      renderPage();

      expect(
        await screen.findByRole("button", { name: "Colophon" }),
      ).toBeDisabled();
    });

    it("draws no section list for an edition with no outline", async () => {
      renderPage();

      expect(await screen.findByText("root line 1")).toBeInTheDocument();
      expect(screen.queryByText("Sections")).not.toBeInTheDocument();
    });
  });
});
