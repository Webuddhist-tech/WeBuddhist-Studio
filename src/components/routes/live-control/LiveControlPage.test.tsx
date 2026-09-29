import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, onTestFinished, vi } from "vitest";
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
  searchTextsByTitle,
  fetchEditionTitle,
} = vi.hoisted(() => ({
  searchTextsByTitle: vi.fn(),
  fetchEditionTitle: vi.fn(),
  fetchLiveControlEvent: vi.fn(),
  fetchLiturgies: vi.fn(),
  fetchTextEditions: vi.fn(),
  fetchRecitationDetails: vi.fn(),
  // Typed as the api is called, so a test can read the cue it was given.
  publishPosition: vi.fn<
    (
      eventId: string,
      token: string,
      position: {
        textId: string;
        segmentId: string;
        index: number;
        roundNumber: number;
      },
    ) => Promise<{ ok: boolean; message?: string }>
  >(async () => ({ ok: true })),
  endRecitationSession: vi.fn<
    (
      eventId: string,
      token: string,
    ) => Promise<{ ok: boolean; message?: string }>
  >(async () => ({ ok: true })),
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
    searchTextsByTitle,
    fetchEditionTitle,
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

/** The titles panel, by the state it carries rather than by the classes the
 * stylesheet turns into the fold: jsdom loads no stylesheet, so a phone's
 * folding itself is only ever seen on a phone. */
const titlesPanel = () => screen.getByRole("complementary");
const setupPanel = () => {
  const panel = titlesPanel().querySelector("[data-setup]");
  if (!panel) throw new Error("no setup panel in the titles");
  return panel;
};

/** Unticks every translation, for a test about the edition on screen alone:
 * a new work follows all of its translations from the start. */
const followNone = async (user: ReturnType<typeof userEvent.setup>) => {
  for (const name of ["Follow Praise (en)", "Follow Praise (zh)"]) {
    const box = await screen.findByRole("checkbox", { name });
    if ((box as HTMLInputElement).checked) await user.click(box);
  }
};

/** Finds a text by name and opens the first match, as an operator would. */
const openTextByName = async (
  user: ReturnType<typeof userEvent.setup>,
  name: string,
) => {
  await user.type(await screen.findByLabelText("Search texts"), name);
  await user.click(
    await screen.findByRole("option", { name: "Praise to the 21 Taras" }),
  );
};

/** The sizes the page draws its lines, and its titles, at. */
const textScaleOnPage = () =>
  document.querySelector("[data-text-scale]")?.getAttribute("data-text-scale");
const titlesScaleOnPage = () =>
  document
    .querySelector("[data-titles-scale]")
    ?.getAttribute("data-titles-scale");

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
    searchTextsByTitle.mockReset();
    searchTextsByTitle.mockResolvedValue([
      { textId: "root", title: "Praise to the 21 Taras" },
    ]);
    fetchEditionTitle.mockReset();
    fetchEditionTitle.mockImplementation(
      async (textId: string) => `Title of ${textId}`,
    );
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

  it("opens the first liturgy and follows every translation of it", async () => {
    renderPage();

    expect(await screen.findByText("root line 1")).toBeInTheDocument();
    expect(fetchRecitationDetails).toHaveBeenCalledWith("root", "bo");
    // Every edition moves with the room unless the operator unticks it.
    expect(
      screen.getByRole("checkbox", { name: "Follow Praise (en)" }),
    ).toBeChecked();
    expect(
      screen.getByRole("checkbox", { name: "Follow Praise (zh)" }),
    ).toBeChecked();
    // The edition being read is always published, so its tick is fixed on.
    const driver = screen.getByRole("checkbox", { name: "Follow Praise (bo)" });
    expect(driver).toBeChecked();
    expect(driver).toBeDisabled();
  });

  it("follows only the Tibetan, English and Chinese editions by default", async () => {
    fetchTextEditions.mockResolvedValue({
      text: { textId: "root", title: "Praise (bo)", language: "bo" },
      editions: [
        { textId: "root-en", title: "Praise (en)", language: "en" },
        { textId: "root-fr", title: "Praise (fr)", language: "fr" },
        { textId: "root-zh", title: "Praise (zh)", language: "zh-hans" },
      ],
    });
    renderPage();
    expect(await screen.findByText("root line 1")).toBeInTheDocument();

    expect(
      screen.getByRole("checkbox", { name: "Follow Praise (en)" }),
    ).toBeChecked();
    expect(
      screen.getByRole("checkbox", { name: "Follow Praise (zh)" }),
    ).toBeChecked();
    expect(
      screen.getByRole("checkbox", { name: "Follow Praise (fr)" }),
    ).not.toBeChecked();
    // An edition nobody follows is not fetched until it is ticked.
    expect(fetchRecitationDetails).not.toHaveBeenCalledWith("root-fr", "fr");
  });

  it("sizes the lines and remembers the size in this browser", async () => {
    const user = userEvent.setup();
    renderPage();
    expect(
      await screen.findByRole("button", { name: "Refuge" }),
    ).toBeInTheDocument();
    expect(textScaleOnPage()).toBe("1");

    const picker = screen.getByRole("combobox", { name: "Text size" });
    await user.selectOptions(picker, "120%");
    expect(textScaleOnPage()).toBe("1.2");
    expect(localStorage.getItem("live-control-text-scale")).toBe("1.2");

    await user.selectOptions(picker, "30%");
    expect(localStorage.getItem("live-control-text-scale")).toBe("0.3");
    expect(picker).toHaveValue("0.3");
    // Nothing smaller than 30% or larger than 150% is offered.
    const offered = Array.from(
      picker.querySelectorAll("option"),
      (option) => option.textContent,
    );
    expect(offered[0]).toBe("30%");
    expect(offered[offered.length - 1]).toBe("150%");
    expect(offered).toHaveLength(13);
  });

  it("sizes the titles on their own, remembered apart from the text", async () => {
    const user = userEvent.setup();
    renderPage();
    expect(
      await screen.findByRole("button", { name: "Refuge" }),
    ).toBeInTheDocument();

    await user.selectOptions(
      screen.getByRole("combobox", { name: "Title size" }),
      "150%",
    );

    expect(titlesScaleOnPage()).toBe("1.5");
    expect(textScaleOnPage()).toBe("1");
    expect(localStorage.getItem("live-control-titles-scale")).toBe("1.5");
    expect(localStorage.getItem("live-control-text-scale")).toBeNull();

    await user.selectOptions(
      screen.getByRole("combobox", { name: "Text size" }),
      "80%",
    );
    expect(titlesScaleOnPage()).toBe("1.5");
    expect(textScaleOnPage()).toBe("0.8");
  });

  it("moves a size saved from the older steps onto the nearest one", async () => {
    localStorage.setItem("live-control-text-scale", "1.75");
    localStorage.setItem("live-control-titles-scale", "0.85");
    renderPage();
    expect(
      await screen.findByRole("button", { name: "Refuge" }),
    ).toBeInTheDocument();

    expect(textScaleOnPage()).toBe("1.5");
    expect(["0.8", "0.9"]).toContain(titlesScaleOnPage());
  });

  it("opens with each pane at the size saved in this browser", async () => {
    localStorage.setItem("live-control-text-scale", "1.3");
    localStorage.setItem("live-control-titles-scale", "0.4");
    renderPage();
    expect(
      await screen.findByRole("button", { name: "Refuge" }),
    ).toBeInTheDocument();

    expect(screen.getByRole("combobox", { name: "Text size" })).toHaveValue(
      "1.3",
    );
    expect(screen.getByRole("combobox", { name: "Title size" })).toHaveValue(
      "0.4",
    );
  });

  it("keeps a titles size saved under the earlier key", async () => {
    localStorage.setItem("live-control-title-scale", "1.3");
    renderPage();
    expect(
      await screen.findByRole("button", { name: "Refuge" }),
    ).toBeInTheDocument();

    expect(titlesScaleOnPage()).toBe("1.3");
  });

  it("opens with the text size saved in this browser", async () => {
    localStorage.setItem("live-control-text-scale", "1.5");
    renderPage();
    expect(
      await screen.findByRole("button", { name: "Refuge" }),
    ).toBeInTheDocument();
    expect(textScaleOnPage()).toBe("1.5");
    expect(screen.getByRole("combobox", { name: "Text size" })).toHaveValue(
      "1.5",
    );
  });

  it("loads a pasted text id and its translations", async () => {
    const user = userEvent.setup();
    fetchLiveControlEvent.mockResolvedValue({
      title: "Tara Puja",
      collectionId: null,
    });
    renderPage();

    await openTextByName(user, "Praise");

    expect(await screen.findByText("root line 1")).toBeInTheDocument();
    expect(fetchTextEditions).toHaveBeenCalledWith("root");
    expect(
      screen.getByRole("checkbox", { name: "Follow Praise (en)" }),
    ).toBeInTheDocument();
  });

  it("finds a text by name and opens it by its edition id", async () => {
    const user = userEvent.setup();
    fetchLiveControlEvent.mockResolvedValue({
      title: "Tara Puja",
      collectionId: null,
    });
    renderPage();

    await openTextByName(user, "Praise");

    expect(searchTextsByTitle).toHaveBeenCalledWith("Praise");
    expect(await screen.findByText("root line 1")).toBeInTheDocument();
    expect(fetchTextEditions).toHaveBeenCalledWith("root");
    // The search closes once a text is picked.
    expect(screen.getByLabelText("Search texts")).toHaveValue("");
  });

  it("does not open an earlier search's result on Enter", async () => {
    const user = userEvent.setup();
    fetchLiveControlEvent.mockResolvedValue({
      title: "Tara Puja",
      collectionId: null,
    });
    renderPage();

    const box = await screen.findByLabelText("Search texts");
    await user.type(box, "Praise");
    expect(
      await screen.findByRole("option", { name: "Praise to the 21 Taras" }),
    ).toBeInTheDocument();

    // Changed and entered before the new search has run.
    await user.type(box, "x{Enter}");

    expect(fetchTextEditions).not.toHaveBeenCalled();
    expect(
      screen.queryByRole("option", { name: "Praise to the 21 Taras" }),
    ).not.toBeInTheDocument();
  });

  it("searches a long run-together title rather than opening it as an id", async () => {
    const user = userEvent.setup();
    fetchLiveControlEvent.mockResolvedValue({
      title: "Tara Puja",
      collectionId: null,
    });
    renderPage();

    const box = await screen.findByLabelText("Search texts");
    await user.type(box, "RefugePrayerTextAbcde");
    expect(
      screen.queryByRole("option", { name: /^Open id/ }),
    ).not.toBeInTheDocument();
    expect(
      await screen.findByRole("option", { name: "Praise to the 21 Taras" }),
    ).toBeInTheDocument();
    await user.type(box, "{Enter}");

    await waitFor(() => expect(fetchTextEditions).toHaveBeenCalledWith("root"));
    expect(fetchTextEditions).not.toHaveBeenCalledWith("RefugePrayerTextAbcde");
  });

  it("still opens a pasted edition id as it is", async () => {
    const user = userEvent.setup();
    fetchLiveControlEvent.mockResolvedValue({
      title: "Tara Puja",
      collectionId: null,
    });
    renderPage();

    await user.type(
      await screen.findByLabelText("Search texts"),
      "Zt5c0fe1OMJI1Kh8rp2FM{Enter}",
    );

    await waitFor(() =>
      expect(fetchTextEditions).toHaveBeenCalledWith("Zt5c0fe1OMJI1Kh8rp2FM"),
    );
  });

  it("does not open an id-shaped query when the title search fails", async () => {
    const user = userEvent.setup();
    fetchLiveControlEvent.mockResolvedValue({
      title: "Tara Puja",
      collectionId: null,
    });
    searchTextsByTitle.mockRejectedValue(new Error("offline"));
    renderPage();

    const box = await screen.findByLabelText("Search texts");
    await user.type(box, "ZtAcBfeXOMJIaKhYrpQFM");
    await waitFor(() =>
      expect(searchTextsByTitle).toHaveBeenCalledWith("ZtAcBfeXOMJIaKhYrpQFM"),
    );
    await waitFor(() => expect(box).not.toHaveAttribute("aria-busy", "true"));
    await new Promise((resolve) => setTimeout(resolve, 50));
    await user.type(box, "{Enter}");

    expect(fetchTextEditions).not.toHaveBeenCalled();
  });

  it("opens an edition id without a digit once no title matches it", async () => {
    const user = userEvent.setup();
    fetchLiveControlEvent.mockResolvedValue({
      title: "Tara Puja",
      collectionId: null,
    });
    searchTextsByTitle.mockResolvedValue([]);
    renderPage();

    const box = await screen.findByLabelText("Search texts");
    await user.type(box, "ZtAcBfeXOMJIaKhYrpQFM");
    await waitFor(() =>
      expect(searchTextsByTitle).toHaveBeenCalledWith("ZtAcBfeXOMJIaKhYrpQFM"),
    );
    await user.type(box, "{Enter}");

    await waitFor(() =>
      expect(fetchTextEditions).toHaveBeenCalledWith("ZtAcBfeXOMJIaKhYrpQFM"),
    );
  });

  it("names the suggested texts instead of showing their ids", async () => {
    fetchLiveControlEvent.mockResolvedValue({
      title: "Tara Puja",
      collectionId: null,
    });
    renderPage();

    expect(
      await screen.findByRole("button", {
        name: "Open Title of Zt5c0fe1OMJI1Kh8rp2FM",
      }),
    ).toHaveTextContent("Title of Zt5c0fe1OMJI1Kh8rp2FM");
    expect(
      await screen.findByRole("button", {
        name: "Open Title of lEmYv8BrRQkOMPY9ymQpS",
      }),
    ).toBeInTheDocument();
  });

  it("remembers a pasted text id in this browser, under its title", async () => {
    const user = userEvent.setup();
    fetchLiveControlEvent.mockResolvedValue({
      title: "Tara Puja",
      collectionId: null,
    });
    renderPage();

    await openTextByName(user, "Praise");
    expect(await screen.findByText("root line 1")).toBeInTheDocument();

    await waitFor(() =>
      expect(
        JSON.parse(localStorage.getItem("live-control-recent-texts") ?? "[]"),
      ).toEqual([{ textId: "root", title: "Praise (bo)" }]),
    );
    expect(
      screen.getByRole("button", { name: "Open Praise (bo)" }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("offers remembered and suggested texts to open with one tap", async () => {
    const user = userEvent.setup();
    localStorage.setItem(
      "live-control-recent-texts",
      JSON.stringify([{ textId: "root", title: "Praise (bo)" }]),
    );
    fetchLiveControlEvent.mockResolvedValue({
      title: "Tara Puja",
      collectionId: null,
    });
    renderPage();

    expect(
      await screen.findByRole("button", {
        name: "Open Title of Zt5c0fe1OMJI1Kh8rp2FM",
      }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Open Praise (bo)" }));

    expect(await screen.findByText("root line 1")).toBeInTheDocument();
    expect(fetchTextEditions).toHaveBeenCalledWith("root");
  });

  it("fetches every edition when the work opens, not when a line is picked", async () => {
    const user = userEvent.setup();
    localStorage.setItem("recitation_emit_token", "tok-123");
    renderPage();
    expect(await screen.findByText("root line 1")).toBeInTheDocument();

    // Already loaded before any line is chosen.
    await waitFor(() =>
      expect(fetchRecitationDetails).toHaveBeenCalledWith("root-en", "en"),
    );
    expect(fetchRecitationDetails).toHaveBeenCalledWith("root-zh", "zh");
    expect(
      await screen.findByText(/2 more editions following/),
    ).toBeInTheDocument();

    fetchRecitationDetails.mockClear();
    await user.click(screen.getByRole("button", { name: /root line 2/ }));

    await waitFor(() => expect(publishPosition).toHaveBeenCalledTimes(3));
    expect(fetchRecitationDetails).not.toHaveBeenCalled();
  });

  it("moves every ticked edition with one press", async () => {
    localStorage.setItem("recitation_emit_token", "tok-123");
    renderPage();
    expect(await screen.findByText("root line 1")).toBeInTheDocument();

    await screen.findByText(/2 more editions following/);
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
    await screen.findByText(/2 more editions following/);
    publishPosition.mockClear();
    order.length = 0;
    inFlight = 0;

    await pressKey("Space");

    await waitFor(() => expect(publishPosition).toHaveBeenCalledTimes(3));
    expect(inFlight).toBe(2);
    expect(order.slice(0, 2).sort()).toEqual(["root-en", "root-zh"]);
    expect(order[2]).toBe("root");
  });

  it("sends the edition on screen again when a translation is ticked on the line being read", async () => {
    const user = userEvent.setup();
    localStorage.setItem("recitation_emit_token", "tok-123");
    const order: string[] = [];
    publishPosition.mockImplementation(
      async (_eventId: string, _token: string, cue: { textId: string }) => {
        order.push(cue.textId);
        return { ok: true };
      },
    );

    renderPage();
    expect(await screen.findByText("root line 1")).toBeInTheDocument();
    await followNone(user);
    await pressKey("Space");
    await waitFor(() => expect(order).toEqual(["root"]));

    await user.click(
      screen.getByRole("checkbox", { name: "Follow Praise (en)" }),
    );
    await waitFor(() =>
      expect(fetchRecitationDetails).toHaveBeenCalledWith("root-en", "en"),
    );
    // The same line again, now with a translation following it. The room already
    // has the line being read, but it has to be posted again behind the
    // translation: the event keeps only the last position it accepted.
    await user.click(screen.getByText("root line 1"));

    await waitFor(() => expect(order).toEqual(["root", "root-en", "root"]));
    expect(publishPosition).toHaveBeenLastCalledWith("e1", "tok-123", {
      textId: "root",
      segmentId: "root-s1",
      index: 0,
      roundNumber: 1,
    });
  });

  it("stops moving an edition once it is unticked", async () => {
    const user = userEvent.setup();
    localStorage.setItem("recitation_emit_token", "tok-123");
    renderPage();
    expect(await screen.findByText("root line 1")).toBeInTheDocument();

    await screen.findByText(/2 more editions following/);
    const english = screen.getByRole("checkbox", {
      name: "Follow Praise (en)",
    });
    await user.click(english);
    await user.click(
      screen.getByRole("checkbox", { name: "Follow Praise (zh)" }),
    );
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
    await screen.findByText(/2 more editions following/);

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
    await screen.findByText(/2 more editions following/);
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

  it("says when a translation does not line up with what is being read", async () => {
    fetchRecitationDetails.mockImplementation(
      async (textId: string, language: string) =>
        linesFor(textId, language, textId === "root-en" ? 2 : 3),
    );
    renderPage();
    expect(await screen.findByText("root line 1")).toBeInTheDocument();

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

  it("closes an error message", async () => {
    const user = userEvent.setup();
    fetchLiveControlEvent.mockRejectedValue(
      new Error("Invalid or no token found"),
    );
    renderPage();

    const alert = await screen.findByRole("alert");
    await user.click(screen.getByRole("button", { name: "Dismiss message" }));

    expect(alert).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows a closed message again when a different problem comes up", async () => {
    const user = userEvent.setup();
    localStorage.setItem("recitation_emit_token", "tok-123");
    publishPosition.mockResolvedValue({
      ok: false,
      message: "That emit token was rejected.",
    });
    renderPage();
    expect(await screen.findByText("root line 1")).toBeInTheDocument();

    await pressKey("Space");
    expect(
      await screen.findByText(/emit token was rejected/),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Dismiss message" }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    publishPosition.mockResolvedValue({
      ok: false,
      message: "Could not reach the room.",
    });
    await pressKey("Space");
    expect(
      await screen.findByText(/Could not reach the room/),
    ).toBeInTheDocument();
  });

  it("sends a followed edition the current line once its lines arrive", async () => {
    localStorage.setItem("recitation_emit_token", "tok-123");
    let releaseEnglish: () => void = () => {};
    const englishHeld = new Promise<void>((resolve) => {
      releaseEnglish = resolve;
    });
    fetchRecitationDetails.mockImplementation(
      async (textId: string, language: string) => {
        if (textId === "root-en") await englishHeld;
        return linesFor(textId, language, 3);
      },
    );
    renderPage();
    expect(await screen.findByText("root line 1")).toBeInTheDocument();

    // Next before the English lines are in: nothing to send it yet.
    await pressKey("Space");
    await waitFor(() =>
      expect(publishPosition).toHaveBeenCalledWith(
        "e1",
        "tok-123",
        expect.objectContaining({ textId: "root", segmentId: "root-s1" }),
      ),
    );
    expect(publishPosition).not.toHaveBeenCalledWith(
      "e1",
      "tok-123",
      expect.objectContaining({ textId: "root-en" }),
    );

    await act(async () => {
      releaseEnglish();
    });

    // Its readers are brought to the line the room is on.
    await waitFor(() =>
      expect(publishPosition).toHaveBeenCalledWith("e1", "tok-123", {
        textId: "root-en",
        segmentId: "root-en-s1",
        index: 0,
        roundNumber: 1,
      }),
    );
    // And the room is left on the edition being read.
    await waitFor(() =>
      expect(publishPosition).toHaveBeenLastCalledWith(
        "e1",
        "tok-123",
        expect.objectContaining({ textId: "root" }),
      ),
    );
  });

  it("has no round counter or end-session control", async () => {
    renderPage();
    expect(await screen.findByText("root line 1")).toBeInTheDocument();

    expect(screen.queryByLabelText("Round")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "End session" }),
    ).not.toBeInTheDocument();
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
    await followNone(user);

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

    it("shows a return button under a praise ending and jumps back to its start", async () => {
      const user = userEvent.setup();
      localStorage.setItem("recitation_emit_token", "tok-123");
      fetchRecitationDetails.mockImplementation(
        async (textId: string, language: string) => {
          if (textId !== "root") return linesFor(textId, language, 3);
          return {
            text_id: "root",
            title: "root",
            segments: [
              {
                recitation: {
                  bo: { id: "BsajlElFFNFLoHcUjICwB", content: "homage line" },
                },
              },
              {
                recitation: {
                  bo: { id: "root-middle", content: "middle line" },
                },
              },
              {
                recitation: {
                  bo: {
                    id: "kYNR7EmC5apQWrkYl5fiO",
                    content: "root mantra line",
                  },
                },
              },
            ],
          };
        },
      );
      renderPage();

      expect(await screen.findByText("root mantra line")).toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: /2nd Praises/ }),
      ).not.toBeInTheDocument();

      await user.click(
        screen.getByRole("button", {
          name: "↺ Return to start · 1st Praises to the 21 Tārās",
        }),
      );

      await waitFor(() =>
        expect(publishPosition).toHaveBeenCalledWith("e1", "tok-123", {
          textId: "root",
          segmentId: "BsajlElFFNFLoHcUjICwB",
          index: 0,
          roundNumber: 1,
        }),
      );
      expect(screen.getByText(/line 1\/3/)).toBeInTheDocument();
    });

    it("scrolls the outline to the live section when the peek is opened", async () => {
      const user = userEvent.setup();
      const scrollIntoView = vi.mocked(Element.prototype.scrollIntoView);
      localStorage.setItem("recitation_emit_token", "tok-123");
      fetchEditionSections.mockResolvedValue(outline);
      renderPage();
      expect(await screen.findByText("root line 1")).toBeInTheDocument();

      // Cruised to the second section with the titles folded away, where nothing
      // in the panel had a box to scroll.
      await user.click(screen.getByRole("button", { name: /root line 3/ }));
      await waitFor(() =>
        expect(screen.getByRole("button", { name: "Praises" })).toHaveAttribute(
          "data-section-active",
          "true",
        ),
      );
      scrollIntoView.mockClear();

      await user.click(screen.getByRole("button", { name: "Show titles" }));

      expect(scrollIntoView).toHaveBeenCalled();
    });

    it("draws no section list for an edition with no outline", async () => {
      renderPage();

      expect(await screen.findByText("root line 1")).toBeInTheDocument();
      expect(screen.queryByText("Sections")).not.toBeInTheDocument();
    });
  });

  // The page is driven two ways on a phone: cruising, one thumb on a Next big
  // enough to take a fresh finger, and finding the place, titles and text packed
  // on the one screen. The layout is the stylesheet's work; what is tested here
  // is that the modes are switchable and that neither takes the driving away.
  describe("titles and the divider", () => {
    it("shows and hides the titles with one button", async () => {
      const user = userEvent.setup();
      renderPage();

      expect(await screen.findByText("root line 1")).toBeInTheDocument();
      // A phone opens on the text alone.
      expect(titlesPanel()).toHaveAttribute("data-titles", "folded");
      expect(
        screen.queryByRole("button", { name: "Cruise" }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Find" }),
      ).not.toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "Show titles" }));
      expect(titlesPanel()).toHaveAttribute("data-titles", "unfolded");

      await user.click(screen.getByRole("button", { name: "Hide titles" }));
      expect(titlesPanel()).toHaveAttribute("data-titles", "folded");
    });

    it("opens with the titles on a wide screen", async () => {
      const matchMedia = vi.fn(() => ({ matches: true }));
      vi.stubGlobal("matchMedia", matchMedia);
      try {
        renderPage();
        expect(await screen.findByText("root line 1")).toBeInTheDocument();
        expect(titlesPanel()).toHaveAttribute("data-titles", "unfolded");
        expect(matchMedia).toHaveBeenCalledWith("(min-width: 1024px)");
      } finally {
        vi.unstubAllGlobals();
      }
    });

    it("keeps the titles up after a jump taken from them", async () => {
      const user = userEvent.setup();
      localStorage.setItem("recitation_emit_token", "tok-123");
      renderPage();

      expect(await screen.findByText("root line 1")).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "Show titles" }));
      await user.click(screen.getByRole("button", { name: "Refuge" }));

      expect(titlesPanel()).toHaveAttribute("data-titles", "unfolded");
    });

    it("drags the divider to split the height, and remembers the split", async () => {
      const user = userEvent.setup();
      renderPage();
      expect(await screen.findByText("root line 1")).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "Show titles" }));

      const divider = screen.getByRole("separator", { name: "Resize titles" });
      expect(divider).toHaveAttribute("aria-valuenow", "35");
      // The area the divider splits: 1000px tall, from the top of the screen.
      const area = divider.parentElement as HTMLElement;
      area.getBoundingClientRect = () => ({ top: 0, height: 1000 }) as DOMRect;

      // jsdom has no PointerEvent, so one is made from a mouse event to carry
      // where the finger is.
      class TestPointerEvent extends MouseEvent {
        pointerId: number;
        constructor(type: string, init: PointerEventInit = {}) {
          super(type, init);
          this.pointerId = init.pointerId ?? 0;
        }
      }
      vi.stubGlobal("PointerEvent", TestPointerEvent);
      onTestFinished(() => {
        vi.unstubAllGlobals();
      });

      // The finger goes down on the divider and is followed wherever it goes.
      fireEvent.pointerDown(divider, { clientY: 350, pointerId: 1 });
      fireEvent.pointerMove(window, { clientY: 420, pointerId: 1 });
      fireEvent.pointerMove(window, { clientY: 500, pointerId: 1 });
      expect(localStorage.getItem("live-control-titles-share")).toBeNull();
      fireEvent.pointerUp(window, { clientY: 500, pointerId: 1 });

      expect(divider).toHaveAttribute("aria-valuenow", "50");
      expect(area.style.getPropertyValue("--titles-share")).toBe("0.5");
      expect(localStorage.getItem("live-control-titles-share")).toBe("0.500");

      // Never so far that either side is lost.
      fireEvent.pointerDown(divider, { clientY: 500, pointerId: 1 });
      fireEvent.pointerMove(window, { clientY: 990, pointerId: 1 });
      fireEvent.pointerUp(window, { clientY: 990, pointerId: 1 });
      expect(divider).toHaveAttribute("aria-valuenow", "70");
    });

    it("follows only the finger that started the drag", async () => {
      const user = userEvent.setup();
      class TestPointerEvent extends MouseEvent {
        pointerId: number;
        constructor(type: string, init: PointerEventInit = {}) {
          super(type, init);
          this.pointerId = init.pointerId ?? 0;
        }
      }
      vi.stubGlobal("PointerEvent", TestPointerEvent);
      onTestFinished(() => {
        vi.unstubAllGlobals();
      });
      renderPage();
      expect(await screen.findByText("root line 1")).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "Show titles" }));

      const divider = screen.getByRole("separator", { name: "Resize titles" });
      const area = divider.parentElement as HTMLElement;
      area.getBoundingClientRect = () => ({ top: 0, height: 1000 }) as DOMRect;

      fireEvent.pointerDown(divider, { clientY: 350, pointerId: 1 });
      // A second finger lands, moves and lifts: none of it counts.
      fireEvent.pointerMove(window, { clientY: 650, pointerId: 2 });
      fireEvent.pointerUp(window, { clientY: 650, pointerId: 2 });
      expect(divider).toHaveAttribute("aria-valuenow", "35");
      expect(localStorage.getItem("live-control-titles-share")).toBeNull();

      fireEvent.pointerMove(window, { clientY: 500, pointerId: 1 });
      fireEvent.pointerUp(window, { clientY: 500, pointerId: 1 });
      expect(divider).toHaveAttribute("aria-valuenow", "50");
      expect(localStorage.getItem("live-control-titles-share")).toBe("0.500");
    });

    it("brings the titles in when the window widens past a phone's", async () => {
      let onChange: (change: { matches: boolean }) => void = () => {};
      vi.stubGlobal(
        "matchMedia",
        vi.fn(() => ({
          matches: false,
          addEventListener: (
            _type: string,
            listener: (change: { matches: boolean }) => void,
          ) => {
            onChange = listener;
          },
          removeEventListener: () => {},
        })),
      );
      onTestFinished(() => {
        vi.unstubAllGlobals();
      });
      renderPage();
      expect(await screen.findByText("root line 1")).toBeInTheDocument();
      expect(titlesPanel()).toHaveAttribute("data-titles", "folded");

      act(() => onChange({ matches: true }));
      expect(titlesPanel()).toHaveAttribute("data-titles", "unfolded");

      act(() => onChange({ matches: false }));
      expect(titlesPanel()).toHaveAttribute("data-titles", "folded");
    });

    it("moves the divider from the keyboard without moving the room", async () => {
      const user = userEvent.setup();
      localStorage.setItem("recitation_emit_token", "tok-123");
      renderPage();
      expect(await screen.findByText("root line 1")).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "Show titles" }));

      const divider = screen.getByRole("separator", { name: "Resize titles" });
      divider.focus();
      await user.keyboard("{ArrowDown}");

      expect(divider).toHaveAttribute("aria-valuenow", "40");
      expect(publishPosition).not.toHaveBeenCalled();
    });

    it("opens with the split saved in this browser", async () => {
      const user = userEvent.setup();
      localStorage.setItem("live-control-titles-share", "0.6");
      renderPage();
      expect(await screen.findByText("root line 1")).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "Show titles" }));

      expect(
        screen.getByRole("separator", { name: "Resize titles" }),
      ).toHaveAttribute("aria-valuenow", "60");
    });

    it("opens the text box on a phone when the event has no liturgies", async () => {
      fetchLiveControlEvent.mockResolvedValue({
        title: "Tara Puja",
        collectionId: null,
      });
      const user = userEvent.setup();
      renderPage();

      // Pasting a text id is the only way in, so it is not left two taps away.
      await waitFor(() =>
        expect(titlesPanel()).toHaveAttribute("data-titles", "unfolded"),
      );
      expect(setupPanel()).toHaveAttribute("data-setup", "unfolded");
      expect(
        screen.queryByRole("button", { name: /^(Hide )?setup$/i }),
      ).toHaveClass("hidden");

      await openTextByName(user, "Praise");
      expect(await screen.findByText("root line 1")).toBeInTheDocument();

      // Once a text is on screen, cruise gives the height back to the lines.
      expect(titlesPanel()).toHaveAttribute("data-titles", "folded");
      expect(setupPanel()).toHaveAttribute("data-setup", "folded");
    });

    it("folds setup away and keeps the editions ticked from there", async () => {
      const user = userEvent.setup();
      renderPage();

      expect(await screen.findByText("root line 1")).toBeInTheDocument();

      expect(setupPanel()).toHaveAttribute("data-setup", "folded");

      await user.click(screen.getByRole("button", { name: "Setup" }));
      expect(setupPanel()).toHaveAttribute("data-setup", "unfolded");
      expect(
        screen.getByRole("button", { name: "Hide setup" }),
      ).toBeInTheDocument();

      // Folded or open, the editions are in the page: the fold is height on a
      // phone, never a second way to reach them.
      await user.click(screen.getByRole("button", { name: "Hide setup" }));
      expect(setupPanel()).toHaveAttribute("data-setup", "folded");
      await user.click(
        screen.getByRole("checkbox", { name: "Follow Praise (en)" }),
      );
      expect(
        await screen.findByText(/1 more edition following/),
      ).toBeInTheDocument();
    });
  });
});
