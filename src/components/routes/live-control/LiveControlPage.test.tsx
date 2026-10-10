import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, onTestFinished, vi } from "vitest";
import LiveControlPage from "./LiveControlPage";
import type {
  AutoplayCommand,
  AutoplayPlanStep,
  AutoplayState,
  MovePosition,
  RecitationDetails,
} from "./api/liveControlApi";
import type { RecitationSocket, SocketMoveResult } from "./useRecitationSocket";

// Echo interpolated values so assertions can still check them.
const { echoT } = vi.hoisted(() => ({
  echoT: (key: string, params?: Record<string, unknown>) =>
    params
      ? `${key} ${Object.entries(params)
          .map(([name, value]) => `${name}=${String(value)}`)
          .join(" ")}`
      : key,
}));
vi.mock("@tolgee/react", () => ({ useTranslate: () => ({ t: echoT }) }));
vi.mock("@/i18n/tolgee", () => ({ tolgee: { t: echoT } }));

const {
  fetchLiveControlEvent,
  fetchLiturgies,
  fetchTextEditions,
  fetchRecitationDetails,
  publishPosition,
  endRecitationSession,
  fetchEditionSections,
  fetchEditionYigchungs,
  searchTextsByTitle,
  fetchEditionTitle,
  fetchSegmentPlayTimes,
  publishMove,
  startAutoplay,
  stopAutoplay,
  fetchAutoplayState,
  sendAutoplayCommand,
  socketStore,
} = vi.hoisted(() => ({
  fetchSegmentPlayTimes: vi.fn(),
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
        autoplay?: boolean;
        elapsedMs?: number;
      },
      run?: string,
    ) => Promise<{ ok: boolean; message?: string }>
  >(async () => ({ ok: true })),
  endRecitationSession: vi.fn<
    (
      eventId: string,
      token: string,
    ) => Promise<{ ok: boolean; message?: string }>
  >(async () => ({ ok: true })),
  fetchEditionSections: vi.fn(),
  fetchEditionYigchungs: vi.fn(),
  publishMove:
    vi.fn<
      (
        eventId: string,
        token: string,
        positions: MovePosition[],
      ) => Promise<{ ok: boolean; message?: string }>
    >(),
  startAutoplay:
    vi.fn<
      (
        eventId: string,
        token: string,
        steps: AutoplayPlanStep[],
        firstStepElapsedMs?: number,
        priorPlanId?: string | null,
      ) => Promise<
        { ok: true; state: AutoplayState } | { ok: false; message: string }
      >
    >(),
  stopAutoplay:
    vi.fn<
      (
        eventId: string,
        token: string,
      ) => Promise<
        { ok: true; state: AutoplayState } | { ok: false; message: string }
      >
    >(),
  fetchAutoplayState:
    vi.fn<(eventId: string, token: string) => Promise<AutoplayState | null>>(),
  sendAutoplayCommand:
    vi.fn<
      (
        eventId: string,
        token: string,
        command: AutoplayCommand,
      ) => Promise<
        { ok: true; state: AutoplayState } | { ok: false; message: string }
      >
    >(),
  /** The controller's socket, as a test drives it: whatever is set here is
   * what the page hears. */
  socketStore: (() => {
    const closed = (): RecitationSocket => ({
      status: "closed",
      room: null,
      people: null,
      autoplay: null,
      refusal: null,
      sendMove: () => null,
      sendCommand: () => null,
    });
    let state = closed();
    const listeners = new Set<() => void>();
    return {
      get: () => state,
      set: (patch: Partial<RecitationSocket>) => {
        state = { ...state, ...patch };
        listeners.forEach((listener) => listener());
      },
      subscribe: (listener: () => void) => {
        listeners.add(listener);
        return () => {
          listeners.delete(listener);
        };
      },
      reset: () => {
        state = closed();
      },
    };
  })(),
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
    fetchSegmentPlayTimes,
    // No repeats or returns set in Studio: the built-in returns are used.
    fetchEditionRecitationSettings: async () => ({
      repeats: {},
      returnJumps: [],
    }),
    publishMove,
    startAutoplay,
    stopAutoplay,
    fetchAutoplayState,
    sendAutoplayCommand,
  };
});

vi.mock("./useRecitationSocket", async () => {
  const { useSyncExternalStore } = await import("react");
  return {
    MOVE_ACK_TIMEOUT_MS: 4000,
    useRecitationSocket: () =>
      useSyncExternalStore(socketStore.subscribe, socketStore.get),
  };
});

vi.mock("./api/libraryTocApi", () => ({
  fetchEditionSections,
  fetchEditionYigchungs,
  resolveEditionId: async (id: string) => id,
}));

vi.mock("react-router-dom", async () => {
  const actual =
    await vi.importActual<typeof import("react-router-dom")>(
      "react-router-dom",
    );
  return { ...actual, useParams: () => ({ eventId: "e1" }) };
});

/** How many plans the backend has been handed this test: plan ids count up. */
let planCount = 0;

/** The backend's autoplay as it would report it. */
const autoplayState = (
  overrides: Partial<AutoplayState> = {},
): AutoplayState => ({
  planId: "plan-1",
  status: "running",
  reason: null,
  step: 0,
  totalSteps: 3,
  stepStartedAtMs: 1_000,
  stepDurationMs: 20,
  held: false,
  heldAtMs: null,
  tempo: 1,
  leadMs: 0,
  serverTimeMs: 1_000,
  ...overrides,
});

/** The backend tells the page, over the socket, where its autoplay is. */
const hearAutoplay = (overrides: Partial<AutoplayState> = {}) =>
  act(() => {
    socketStore.set({ autoplay: autoplayState(overrides) });
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

/** An event with no liturgies: the page opens on the text box. */
const noEventLiturgies = () => {
  fetchLiveControlEvent.mockResolvedValue({
    title: "Tara Puja",
    collectionId: null,
  });
};

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
  for (const name of [
    "studio.live_control.editions.follow_aria title=Praise (en)",
    "studio.live_control.editions.follow_aria title=Praise (zh)",
  ]) {
    const box = await screen.findByRole("checkbox", { name });
    if ((box as HTMLInputElement).checked) await user.click(box);
  }
};

/** Finds a text by name and opens the first match, as an operator would. */
const openTextByName = async (
  user: ReturnType<typeof userEvent.setup>,
  name: string,
) => {
  await user.type(
    await screen.findByLabelText("studio.live_control.setup.search_aria"),
    name,
  );
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

/** Live, Auto and Hold sit in the controls menu at the top: it is opened, if
 * it is shut, before one of them is looked for. */
const openControls = () => {
  const menu = screen.getByRole("button", {
    name: "studio.live_control.controls.settings",
  });
  if (menu.getAttribute("aria-expanded") !== "true") fireEvent.click(menu);
};
const controlButton = (name: string) => {
  openControls();
  return screen.getByRole("button", { name });
};
const queryControlButton = (name: string) => {
  openControls();
  return screen.queryByRole("button", { name });
};

/** Status, the titles, size and cue sit in the settings menu too. */
const publishState = () => {
  openControls();
  return screen.getByTestId("publish-state");
};
const textSizePicker = () => {
  openControls();
  return screen.getByRole("combobox", {
    name: "studio.live_control.text_size",
  });
};
const roomStatus = () => {
  openControls();
  return document.querySelector("[data-room]");
};

const pressKey = async (code: string) => {
  await act(async () => {
    document.body.dispatchEvent(
      new KeyboardEvent("keydown", { code, bubbles: true, cancelable: true }),
    );
  });
};

/**
 * The titles button by the title. The floating touch dot is named the same,
 * and shows once the outline is in, so it is told apart by what it opens.
 */
const findTitlesButton = async () =>
  (
    await screen.findAllByRole("button", {
      name: "studio.live_control.toc.open",
    })
  ).find((button) => button.getAttribute("data-slot") === "dialog-trigger") ??
  Promise.reject(new Error("no titles button"));

describe("LiveControlPage", () => {
  beforeEach(() => {
    fetchLiveControlEvent.mockReset();
    fetchLiveControlEvent.mockResolvedValue({
      title: "Tara Puja",
      collectionId: "col-1",
    });
    fetchLiturgies.mockReset();
    fetchLiturgies.mockResolvedValue([
      { textId: "root", title: "Praise to the 21 Tārās" },
      { textId: "other", title: "Refuge" },
    ]);
    fetchTextEditions.mockReset();
    fetchRecitationDetails.mockReset();
    publishPosition.mockClear();
    publishPosition.mockResolvedValue({ ok: true });
    endRecitationSession.mockClear();
    endRecitationSession.mockResolvedValue({ ok: true });
    fetchEditionSections.mockReset();
    fetchEditionSections.mockResolvedValue([]);
    fetchEditionYigchungs.mockReset();
    fetchEditionYigchungs.mockResolvedValue({});
    searchTextsByTitle.mockReset();
    searchTextsByTitle.mockResolvedValue([
      { textId: "root", title: "Praise to the 21 Taras" },
    ]);
    fetchEditionTitle.mockReset();
    fetchEditionTitle.mockImplementation(
      async (textId: string) => `Title of ${textId}`,
    );
    fetchSegmentPlayTimes.mockReset();
    fetchSegmentPlayTimes.mockResolvedValue({});
    // The backend takes every command to the plan it is running.
    sendAutoplayCommand.mockReset();
    sendAutoplayCommand.mockImplementation(async (_event, _key, command) => {
      switch (command.type) {
        case "seek":
          return {
            ok: true,
            state: autoplayState({
              planId: command.planId,
              step: command.step,
              stepStartedAtMs: 1_000,
              serverTimeMs: 1_000,
            }),
          };
        case "hold":
          return {
            ok: true,
            state: autoplayState({
              planId: command.planId ?? "plan-1",
              held: true,
              heldAtMs: 1_000,
            }),
          };
        case "resume":
          return {
            ok: true,
            state: autoplayState({ planId: command.planId ?? "plan-1" }),
          };
        case "settings":
          return {
            ok: true,
            state: autoplayState({
              status: "stopped",
              leadMs: command.leadMs ?? 0,
              tempo: command.tempo ?? 1,
            }),
          };
      }
    });
    // A move reaches the room edition by edition, in the order given: each is
    // seen here as the single-position call the tests read. The room takes
    // the whole move or none of it.
    publishMove.mockReset();
    publishMove.mockImplementation(async (event, key, positions) => {
      let failure: { ok: boolean; message?: string } | null = null;
      for (const { position, run } of positions) {
        const result = await publishPosition(event, key, position, run);
        if (!result.ok && !failure) failure = result;
      }
      return failure ?? { ok: true };
    });
    planCount = 0;
    startAutoplay.mockReset();
    startAutoplay.mockImplementation(async (_event, _key, steps) => {
      planCount += 1;
      return {
        ok: true,
        // The backend reports the first step's hold, as the plan gave it.
        state: autoplayState({
          planId: `plan-${planCount}`,
          stepDurationMs: steps[0]?.durationMs ?? 20,
        }),
      };
    });
    stopAutoplay.mockReset();
    stopAutoplay.mockImplementation(async () => ({
      ok: true,
      state: autoplayState({
        planId: `plan-${planCount}`,
        status: "stopped",
        reason: "stopped",
      }),
    }));
    fetchAutoplayState.mockReset();
    fetchAutoplayState.mockResolvedValue(null);
    socketStore.reset();
    localStorage.clear();
    Element.prototype.scrollIntoView = vi.fn();

    // Shortcuts from texts opened in this browser. The page itself opens on
    // this event's first liturgy, not on whichever text was opened last.
    localStorage.setItem(
      "live-control-recent-texts",
      JSON.stringify([
        { textId: "root", title: "Praise to the 21 Tārās" },
        { textId: "other", title: "Refuge" },
      ]),
    );
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

  it("opens this event's first liturgy and follows every translation of it", async () => {
    const user = userEvent.setup();
    // The text last opened anywhere in this browser belongs to another event.
    localStorage.setItem(
      "live-control-recent-texts",
      JSON.stringify([{ textId: "other", title: "Refuge" }]),
    );
    renderPage();

    expect(await screen.findByText("root line 1")).toBeInTheDocument();
    expect(fetchLiveControlEvent).toHaveBeenCalledWith("e1");
    expect(fetchLiturgies).toHaveBeenCalledWith("col-1");
    expect(fetchRecitationDetails).toHaveBeenCalledWith("root", "bo");
    expect(screen.queryByText("other line 1")).not.toBeInTheDocument();
    expect(localStorage.getItem("live-control-open-text:e1")).toBe("root");
    // Every edition moves with the room unless the operator unticks it.
    expect(
      screen.getByRole("checkbox", {
        name: "studio.live_control.editions.follow_aria title=Praise (en)",
      }),
    ).toBeChecked();
    expect(
      screen.getByRole("checkbox", {
        name: "studio.live_control.editions.follow_aria title=Praise (zh)",
      }),
    ).toBeChecked();
    // The edition being read is always published, so its tick is fixed on.
    const driver = screen.getByRole("checkbox", {
      name: "studio.live_control.editions.follow_aria title=Praise (bo)",
    });
    expect(driver).toBeChecked();
    expect(driver).toBeDisabled();

    await user.click(screen.getByRole("button", { name: /^Refuge$/ }));
    expect(await screen.findByText("other line 1")).toBeInTheDocument();
  });

  it("reopens the text last opened for this event", async () => {
    localStorage.setItem("live-control-open-text:e1", "other");
    renderPage();

    expect(await screen.findByText("other line 1")).toBeInTheDocument();
    expect(fetchRecitationDetails).not.toHaveBeenCalledWith("root", "bo");
  });

  it("does not open another event's text when this event has no liturgy", async () => {
    localStorage.setItem(
      "live-control-recent-texts",
      JSON.stringify([{ textId: "other", title: "Refuge" }]),
    );
    noEventLiturgies();
    renderPage();

    await waitFor(() => expect(fetchLiveControlEvent).toHaveBeenCalled());
    expect(screen.queryByText("other line 1")).not.toBeInTheDocument();
    expect(
      screen.getByLabelText("studio.live_control.setup.search_aria"),
    ).toBeInTheDocument();
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
      screen.getByRole("checkbox", {
        name: "studio.live_control.editions.follow_aria title=Praise (en)",
      }),
    ).toBeChecked();
    expect(
      screen.getByRole("checkbox", {
        name: "studio.live_control.editions.follow_aria title=Praise (zh)",
      }),
    ).toBeChecked();
    expect(
      screen.getByRole("checkbox", {
        name: "studio.live_control.editions.follow_aria title=Praise (fr)",
      }),
    ).not.toBeChecked();
    // An edition nobody follows is not fetched until it is ticked.
    expect(fetchRecitationDetails).not.toHaveBeenCalledWith("root-fr", "fr");
  });

  it("sizes the lines and remembers the size in this browser", async () => {
    const user = userEvent.setup();
    renderPage();
    expect(await screen.findByText("root line 1")).toBeInTheDocument();
    expect(textScaleOnPage()).toBe("1");

    const picker = textSizePicker();
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
    fetchEditionSections.mockResolvedValue([
      { id: "s1", title: "Going for Refuge", depth: 0, segmentId: "root-s1" },
    ]);
    renderPage();
    expect(await screen.findByText("root line 1")).toBeInTheDocument();

    await user.selectOptions(
      await screen.findByRole("combobox", {
        name: "studio.live_control.title_size",
      }),
      "150%",
    );

    expect(titlesScaleOnPage()).toBe("1.5");
    expect(textScaleOnPage()).toBe("1");
    expect(localStorage.getItem("live-control-titles-scale")).toBe("1.5");
    expect(localStorage.getItem("live-control-text-scale")).toBeNull();

    await user.selectOptions(textSizePicker(), "80%");
    expect(titlesScaleOnPage()).toBe("1.5");
    expect(textScaleOnPage()).toBe("0.8");
  });

  it("moves a size saved from the older steps onto the nearest one", async () => {
    localStorage.setItem("live-control-text-scale", "1.75");
    localStorage.setItem("live-control-titles-scale", "0.85");
    renderPage();
    expect(await screen.findByText("root line 1")).toBeInTheDocument();

    expect(textScaleOnPage()).toBe("1.5");
    expect(["0.8", "0.9"]).toContain(titlesScaleOnPage());
  });

  it("opens with each pane at the size saved in this browser", async () => {
    localStorage.setItem("live-control-text-scale", "1.3");
    localStorage.setItem("live-control-titles-scale", "0.4");
    fetchEditionSections.mockResolvedValue([
      { id: "s1", title: "Going for Refuge", depth: 0, segmentId: "root-s1" },
    ]);
    renderPage();
    expect(await screen.findByText("root line 1")).toBeInTheDocument();

    expect(textSizePicker()).toHaveValue("1.3");
    expect(
      await screen.findByRole("combobox", {
        name: "studio.live_control.title_size",
      }),
    ).toHaveValue("0.4");
  });

  it("keeps a titles size saved under the earlier key", async () => {
    localStorage.setItem("live-control-title-scale", "1.3");
    renderPage();
    expect(await screen.findByText("root line 1")).toBeInTheDocument();

    expect(titlesScaleOnPage()).toBe("1.3");
  });

  it("opens with the text size saved in this browser", async () => {
    localStorage.setItem("live-control-text-scale", "1.5");
    renderPage();
    expect(await screen.findByText("root line 1")).toBeInTheDocument();
    expect(textScaleOnPage()).toBe("1.5");
    expect(textSizePicker()).toHaveValue("1.5");
  });

  it("loads a pasted text id and its translations", async () => {
    const user = userEvent.setup();
    localStorage.removeItem("live-control-recent-texts");
    renderPage();

    await openTextByName(user, "Praise");

    expect(await screen.findByText("root line 1")).toBeInTheDocument();
    expect(fetchTextEditions).toHaveBeenCalledWith("root");
    expect(
      screen.getByRole("checkbox", {
        name: "studio.live_control.editions.follow_aria title=Praise (en)",
      }),
    ).toBeInTheDocument();
  });

  it("finds a text by name and opens it by its edition id", async () => {
    const user = userEvent.setup();
    localStorage.removeItem("live-control-recent-texts");
    renderPage();

    await openTextByName(user, "Praise");

    expect(searchTextsByTitle).toHaveBeenCalledWith("Praise");
    expect(await screen.findByText("root line 1")).toBeInTheDocument();
    expect(fetchTextEditions).toHaveBeenCalledWith("root");
    // The search closes once a text is picked.
    expect(
      screen.getByLabelText("studio.live_control.setup.search_aria"),
    ).toHaveValue("");
  });

  it("does not open an earlier search's result on Enter", async () => {
    const user = userEvent.setup();
    localStorage.removeItem("live-control-recent-texts");
    noEventLiturgies();
    renderPage();

    const box = await screen.findByLabelText(
      "studio.live_control.setup.search_aria",
    );
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
    localStorage.removeItem("live-control-recent-texts");
    renderPage();

    const box = await screen.findByLabelText(
      "studio.live_control.setup.search_aria",
    );
    await user.type(box, "RefugePrayerTextAbcde");
    expect(
      screen.queryByRole("option", {
        name: /^studio.live_control.setup\.open_id/,
      }),
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
    localStorage.removeItem("live-control-recent-texts");
    renderPage();

    await user.type(
      await screen.findByLabelText("studio.live_control.setup.search_aria"),
      "Zt5c0fe1OMJI1Kh8rp2FM{Enter}",
    );

    await waitFor(() =>
      expect(fetchTextEditions).toHaveBeenCalledWith("Zt5c0fe1OMJI1Kh8rp2FM"),
    );
  });

  it("does not open an id-shaped query when the title search fails", async () => {
    const user = userEvent.setup();
    localStorage.removeItem("live-control-recent-texts");
    noEventLiturgies();
    searchTextsByTitle.mockRejectedValue(new Error("offline"));
    renderPage();

    const box = await screen.findByLabelText(
      "studio.live_control.setup.search_aria",
    );
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
    localStorage.removeItem("live-control-recent-texts");
    searchTextsByTitle.mockResolvedValue([]);
    renderPage();

    const box = await screen.findByLabelText(
      "studio.live_control.setup.search_aria",
    );
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
    localStorage.removeItem("live-control-recent-texts");
    renderPage();

    expect(
      await screen.findByRole("button", {
        name: "studio.live_control.setup.open_aria title=Title of Zt5c0fe1OMJI1Kh8rp2FM",
      }),
    ).toHaveTextContent("Title of Zt5c0fe1OMJI1Kh8rp2FM");
    expect(
      await screen.findByRole("button", {
        name: "studio.live_control.setup.open_aria title=Title of lEmYv8BrRQkOMPY9ymQpS",
      }),
    ).toBeInTheDocument();
  });

  it("remembers a pasted text id in this browser, under its title", async () => {
    const user = userEvent.setup();
    localStorage.removeItem("live-control-recent-texts");
    renderPage();

    await openTextByName(user, "Praise");
    expect(await screen.findByText("root line 1")).toBeInTheDocument();

    await waitFor(() =>
      expect(
        JSON.parse(localStorage.getItem("live-control-recent-texts") ?? "[]"),
      ).toEqual([{ textId: "root", title: "Praise (bo)" }]),
    );
    expect(
      screen.getByRole("button", {
        name: "studio.live_control.setup.open_aria title=Praise (bo)",
      }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("offers remembered and suggested texts to open with one tap", async () => {
    const user = userEvent.setup();
    localStorage.setItem(
      "live-control-recent-texts",
      JSON.stringify([{ textId: "root", title: "Praise (bo)" }]),
    );
    renderPage();

    expect(
      await screen.findByRole("button", {
        name: "studio.live_control.setup.open_aria title=Title of Zt5c0fe1OMJI1Kh8rp2FM",
      }),
    ).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", {
        name: "studio.live_control.setup.open_aria title=Praise (bo)",
      }),
    );

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
      await screen.findByText(/following_other count=2/),
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

    await screen.findByText(/following_other count=2/);
    publishPosition.mockClear();

    await pressKey("Space");

    // One position per edition: each is its own library text with its own ids.
    await waitFor(() => expect(publishPosition).toHaveBeenCalledTimes(3));
    expect(publishPosition).toHaveBeenCalledWith(
      "e1",
      "tok-123",
      {
        textId: "root",
        segmentId: "root-s1",
        index: 0,
        roundNumber: 1,
      },
      expect.any(String),
    );
    expect(publishPosition).toHaveBeenCalledWith(
      "e1",
      "tok-123",
      {
        textId: "root-en",
        segmentId: "root-en-s1",
        index: 0,
        roundNumber: 1,
      },
      expect.any(String),
    );
    expect(publishPosition).toHaveBeenCalledWith(
      "e1",
      "tok-123",
      {
        textId: "root-zh",
        segmentId: "root-zh-s1",
        index: 0,
        roundNumber: 1,
      },
      expect.any(String),
    );
  });

  it("reports how long each line was held, rather than leaving the backend to time the moves", async () => {
    // The backend can only subtract two request arrivals, which carries the
    // network, its liveness check and throttle, and this page's send pacing into
    // a figure meant to be speech alone. The hold is measured here instead, off
    // a monotonic clock, and sent with the move that ends it.
    localStorage.setItem("recitation_emit_token", "tok-123");
    let clock = 1_000;
    const now = vi.spyOn(performance, "now").mockImplementation(() => clock);
    onTestFinished(() => now.mockRestore());
    const user = userEvent.setup();
    renderPage();
    expect(await screen.findByText("root line 1")).toBeInTheDocument();
    await followNone(user);
    publishPosition.mockClear();

    // The first move has no line behind it, so there is nothing to report.
    await pressKey("Space");
    await waitFor(() => expect(publishPosition).toHaveBeenCalledTimes(1));
    expect(publishPosition.mock.calls[0][2].elapsedMs).toBeUndefined();

    clock += 2_500;
    await pressKey("Space");
    await waitFor(() => expect(publishPosition).toHaveBeenCalledTimes(2));
    // The first line's own hold, to the millisecond - not the gap between two
    // posts landing.
    expect(publishPosition.mock.calls[1][2]).toEqual({
      textId: "root",
      segmentId: "root-s2",
      index: 1,
      roundNumber: 1,
      elapsedMs: 2_500,
    });
  });

  it("sends no hold while Record play times is off, so stored times are left alone", async () => {
    localStorage.setItem("recitation_emit_token", "tok-123");
    localStorage.setItem(
      "live-control-cue",
      JSON.stringify({ recordPlayTimes: false }),
    );
    let clock = 1_000;
    const now = vi.spyOn(performance, "now").mockImplementation(() => clock);
    onTestFinished(() => now.mockRestore());
    const user = userEvent.setup();
    renderPage();
    expect(await screen.findByText("root line 1")).toBeInTheDocument();
    await followNone(user);
    publishPosition.mockClear();

    await pressKey("Space");
    await waitFor(() => expect(publishPosition).toHaveBeenCalledTimes(1));
    clock += 2_500;
    await pressKey("Space");
    await waitFor(() => expect(publishPosition).toHaveBeenCalledTimes(2));
    expect(publishPosition.mock.calls[1][2]).toEqual({
      textId: "root",
      segmentId: "root-s2",
      index: 1,
      roundNumber: 1,
    });
  });

  it("reports one hold to every edition of the move", async () => {
    // A move lands on all the followed editions at once, so each is told the
    // same hold: the backend keeps its own marks per text and decides for each
    // whether the two lines may be timed against each other.
    localStorage.setItem("recitation_emit_token", "tok-123");
    let clock = 1_000;
    const now = vi.spyOn(performance, "now").mockImplementation(() => clock);
    onTestFinished(() => now.mockRestore());
    renderPage();
    expect(await screen.findByText("root line 1")).toBeInTheDocument();
    await screen.findByText(/following_other count=2/);
    publishPosition.mockClear();

    await pressKey("Space");
    await waitFor(() => expect(publishPosition).toHaveBeenCalledTimes(3));
    clock += 1_800;
    await pressKey("Space");
    await waitFor(() => expect(publishPosition).toHaveBeenCalledTimes(6));
    expect(
      publishPosition.mock.calls.slice(3).map((call) => call[2].elapsedMs),
    ).toEqual([1_800, 1_800, 1_800]);
  });

  it("sends a whole move in one request, the edition on screen last", async () => {
    localStorage.setItem("recitation_emit_token", "tok-123");
    renderPage();
    expect(await screen.findByText("root line 1")).toBeInTheDocument();
    await screen.findByText(/following_other count=2/);
    publishMove.mockClear();

    await pressKey("Space");

    // One request for every edition, not one each: the edition being read is
    // not held back a round trip behind the others. The event keeps the last
    // position it is sent, so that edition goes last.
    await waitFor(() => expect(publishMove).toHaveBeenCalledTimes(1));
    const [, token, positions] = publishMove.mock.calls[0];
    expect(token).toBe("tok-123");
    expect(positions.map(({ position }) => position.textId)).toEqual([
      "root-en",
      "root-zh",
      "root",
    ]);
    // Each edition carries its own run, so each is timed on its own.
    expect(positions.every(({ run }) => typeof run === "string")).toBe(true);
  });

  it("sends a move over the socket while it is open, and by HTTP when it is lost", async () => {
    localStorage.setItem("recitation_emit_token", "tok-123");
    const overSocket = vi.fn<
      (positions: MovePosition[]) => Promise<SocketMoveResult>
    >(async () => ({ ok: true }));
    socketStore.set({ status: "open", sendMove: overSocket });
    renderPage();
    expect(await screen.findByText("root line 1")).toBeInTheDocument();
    await screen.findByText(/following_other count=2/);
    publishMove.mockClear();

    await pressKey("Space");
    await waitFor(() => expect(overSocket).toHaveBeenCalledTimes(1));
    expect(
      overSocket.mock.calls[0][0].map(({ position }) => position.textId),
    ).toEqual(["root-en", "root-zh", "root"]);
    expect(publishMove).not.toHaveBeenCalled();

    // The socket went quiet on the next one: it goes by HTTP instead.
    overSocket.mockResolvedValueOnce({
      ok: false,
      lost: true,
      message: "gone",
    });
    await pressKey("Space");
    await waitFor(() => expect(publishMove).toHaveBeenCalledTimes(1));
    expect(
      publishMove.mock.calls[0][2].map(({ position }) => position.segmentId),
    ).toEqual(["root-en-s2", "root-zh-s2", "root-s2"]);
  });

  it("does not send a move the room refused over the socket again by HTTP", async () => {
    localStorage.setItem("recitation_emit_token", "tok-123");
    const overSocket = vi.fn(async () => ({
      ok: false,
      message:
        "The room is taking positions as fast as it can; slow down a little.",
    }));
    socketStore.set({ status: "open", sendMove: overSocket });
    renderPage();
    expect(await screen.findByText("root line 1")).toBeInTheDocument();
    publishMove.mockClear();

    await pressKey("Space");

    expect(await screen.findByText(/slow down a little/)).toBeInTheDocument();
    expect(publishMove).not.toHaveBeenCalled();
  });

  describe("stop / go live", () => {
    it("moves only this screen while stopped, and remembers it in this browser", async () => {
      const user = userEvent.setup();
      localStorage.setItem("recitation_emit_token", "tok-123");
      renderPage();
      expect(await screen.findByText("root line 1")).toBeInTheDocument();
      await screen.findByText(/following_other count=2/);

      await user.click(
        screen.getByRole("button", { name: "studio.live_control.on_air.stop" }),
      );
      expect(localStorage.getItem("live-control-on-air:e1")).toBe("false");
      expect(
        screen.getByText("studio.live_control.on_air.stopped"),
      ).toBeInTheDocument();
      expect(publishState()).toHaveTextContent(
        "studio.live_control.status.stopped",
      );
      expect(
        controlButton("▶ studio.live_control.controls.auto"),
      ).toBeDisabled();
      publishPosition.mockClear();

      await pressKey("Space");
      await user.click(screen.getByText("root line 3"));
      expect(
        await screen.findByText(/position\.line_of line=3 total=3/),
      ).toBeInTheDocument();
      expect(publishPosition).not.toHaveBeenCalled();
      expect(publishMove).not.toHaveBeenCalled();
      expect(startAutoplay).not.toHaveBeenCalled();

      await user.click(
        screen.getByRole("button", {
          name: "studio.live_control.on_air.go_live",
        }),
      );
      expect(localStorage.getItem("live-control-on-air:e1")).toBe("true");
      // Going live sends nothing by itself; the next move does.
      expect(publishPosition).not.toHaveBeenCalled();

      await user.click(screen.getByText("root line 2"));
      await waitFor(() =>
        expect(publishPosition).toHaveBeenCalledWith(
          "e1",
          "tok-123",
          { textId: "root", segmentId: "root-s2", index: 1, roundNumber: 1 },
          expect.any(String),
        ),
      );
    });

    it("opens stopped when it was stopped in this browser", async () => {
      localStorage.setItem("recitation_emit_token", "tok-123");
      localStorage.setItem("live-control-on-air:e1", "false");
      renderPage();
      expect(await screen.findByText("root line 1")).toBeInTheDocument();
      await screen.findByText(/following_other count=2/);

      expect(
        screen.getByRole("button", {
          name: "studio.live_control.on_air.go_live",
        }),
      ).toHaveAttribute("aria-pressed", "false");
      await pressKey("Space");
      expect(
        await screen.findByText(/position\.line_of line=1 total=3/),
      ).toBeInTheDocument();
      expect(publishMove).not.toHaveBeenCalled();
    });

    it("pauses the backend's autoplay on Stop, then sends nothing more", async () => {
      const user = userEvent.setup();
      localStorage.setItem("recitation_emit_token", "tok-123");
      fetchSegmentPlayTimes.mockResolvedValue({
        "root-s1": 20_000,
        "root-s2": 20_000,
        "root-s3": 20_000,
      });
      renderPage();
      expect(await screen.findByText("root line 1")).toBeInTheDocument();
      await screen.findByText(/following_other count=2/);

      await user.click(controlButton("▶ studio.live_control.controls.auto"));
      await waitFor(() => expect(startAutoplay).toHaveBeenCalledTimes(1));

      await user.click(
        screen.getByRole("button", { name: "studio.live_control.on_air.stop" }),
      );
      await waitFor(() => expect(stopAutoplay).toHaveBeenCalledTimes(1));

      await user.click(screen.getByText("root line 3"));
      expect(
        await screen.findByText(/position\.line_of line=3 total=3/),
      ).toBeInTheDocument();
      expect(startAutoplay).toHaveBeenCalledTimes(1);
      expect(sendAutoplayCommand).not.toHaveBeenCalled();
    });
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
      screen.getByRole("checkbox", {
        name: "studio.live_control.editions.follow_aria title=Praise (en)",
      }),
    );
    await waitFor(() =>
      expect(fetchRecitationDetails).toHaveBeenCalledWith("root-en", "en"),
    );
    // The same line again, now with a translation following it. The room already
    // has the line being read, but it has to be posted again behind the
    // translation: the event keeps only the last position it accepted.
    await user.click(screen.getByText("root line 1"));

    await waitFor(() => expect(order).toEqual(["root", "root-en", "root"]));
    expect(publishPosition).toHaveBeenLastCalledWith(
      "e1",
      "tok-123",
      {
        textId: "root",
        segmentId: "root-s1",
        index: 0,
        roundNumber: 1,
      },
      expect.any(String),
    );
  });

  it("keeps an edition's run while it moves, and starts a new one once it was left out", async () => {
    // The backend only times a line against the next within one run: an
    // edition that sat out a move must not be billed for the time it sat out.
    const user = userEvent.setup();
    localStorage.setItem("recitation_emit_token", "tok-123");
    renderPage();
    expect(await screen.findByText("root line 1")).toBeInTheDocument();
    await screen.findByText(/following_other count=2/);
    publishPosition.mockClear();
    const runsOf = (textId: string) =>
      publishPosition.mock.calls
        .filter((call) => call[2].textId === textId)
        .map((call) => call[3]);

    await pressKey("Space");
    await waitFor(() => expect(publishPosition).toHaveBeenCalledTimes(3));
    await pressKey("Space");
    await waitFor(() => expect(publishPosition).toHaveBeenCalledTimes(6));

    const english = screen.getByRole("checkbox", {
      name: "studio.live_control.editions.follow_aria title=Praise (en)",
    });
    await user.click(english);
    await pressKey("Space");
    await waitFor(() => expect(publishPosition).toHaveBeenCalledTimes(8));

    await user.click(english);
    await waitFor(() =>
      expect(fetchRecitationDetails).toHaveBeenCalledWith("root-en", "en"),
    );
    await user.click(screen.getByText("root line 3"));
    await waitFor(() => expect(runsOf("root-en")).toHaveLength(3));

    const [first, second, afterReturn] = runsOf("root-en");
    expect(first).toEqual(expect.any(String));
    expect(second).toBe(first);
    expect(afterReturn).not.toBe(first);
    // The edition on screen was in every move, so its run never changed.
    expect(new Set(runsOf("root")).size).toBe(1);
    expect(new Set(runsOf("root-zh")).size).toBe(1);
  });

  it("stops moving an edition once it is unticked", async () => {
    const user = userEvent.setup();
    localStorage.setItem("recitation_emit_token", "tok-123");
    renderPage();
    expect(await screen.findByText("root line 1")).toBeInTheDocument();

    await screen.findByText(/following_other count=2/);
    const english = screen.getByRole("checkbox", {
      name: "studio.live_control.editions.follow_aria title=Praise (en)",
    });
    await user.click(english);
    await user.click(
      screen.getByRole("checkbox", {
        name: "studio.live_control.editions.follow_aria title=Praise (zh)",
      }),
    );
    expect(english).not.toBeChecked();
    publishPosition.mockClear();

    await pressKey("Space");

    await waitFor(() => expect(publishPosition).toHaveBeenCalledTimes(1));
    expect(publishPosition).toHaveBeenCalledWith(
      "e1",
      "tok-123",
      expect.objectContaining({ textId: "root" }),
      expect.any(String),
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
      expect(publishPosition).toHaveBeenCalledWith(
        "e1",
        "tok-123",
        {
          textId: "root-en",
          segmentId: "root-en-s1",
          index: 0,
          roundNumber: 1,
        },
        expect.any(String),
      ),
    );
  });

  it("drops the previous work's editions when another text is picked", async () => {
    const user = userEvent.setup();
    localStorage.setItem("recitation_emit_token", "tok-123");
    renderPage();
    expect(await screen.findByText("root line 1")).toBeInTheDocument();
    await screen.findByText(/following_other count=2/);

    await user.click(
      screen.getByRole("button", {
        name: "studio.live_control.setup.open_aria title=Refuge",
      }),
    );
    expect(await screen.findByText("other line 1")).toBeInTheDocument();
    expect(
      screen.queryByRole("checkbox", {
        name: "studio.live_control.editions.follow_aria title=Praise (en)",
      }),
    ).not.toBeInTheDocument();
    publishPosition.mockClear();

    await pressKey("Space");

    await waitFor(() => expect(publishPosition).toHaveBeenCalledTimes(1));
    expect(publishPosition).toHaveBeenCalledWith(
      "e1",
      "tok-123",
      expect.objectContaining({ textId: "other", segmentId: "other-s1" }),
      expect.any(String),
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
    await screen.findByText(/following_other count=2/);
    publishPosition.mockClear();

    await pressKey("Space");
    await pressKey("Space");

    // Second line of the text being read is the second row, which this edition
    // holds as its first line - not its second.
    await waitFor(() =>
      expect(publishPosition).toHaveBeenCalledWith(
        "e1",
        "tok-123",
        {
          textId: "root-en",
          segmentId: "root-en-s2",
          index: 0,
          roundNumber: 1,
          // The second move, so it reports how long the first line was held.
          elapsedMs: expect.any(Number),
        },
        expect.any(String),
      ),
    );
    expect(publishPosition).not.toHaveBeenCalledWith(
      "e1",
      "tok-123",
      expect.objectContaining({ segmentId: "root-en-s3" }),
      expect.any(String),
    );
  });

  it("publishes nothing for the text just left while the next one loads", async () => {
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

    await user.click(
      screen.getByRole("button", {
        name: "studio.live_control.setup.open_aria title=Refuge",
      }),
    );
    await pressKey("Space");
    await pressKey("ArrowRight");

    expect(publishPosition).toHaveBeenCalledTimes(1);
    expect(publishPosition).not.toHaveBeenCalledWith(
      "e1",
      "tok-123",
      expect.objectContaining({ segmentId: "root-s2" }),
      expect.any(String),
    );
  });

  it("says when a translation does not line up with what is being read", async () => {
    fetchRecitationDetails.mockImplementation(
      async (textId: string, language: string) =>
        linesFor(textId, language, textId === "root-en" ? 2 : 3),
    );
    renderPage();
    expect(await screen.findByText("root line 1")).toBeInTheDocument();

    expect(await screen.findByText(/lines_misaligned/)).toBeInTheDocument();
  });

  it("publishes with the pasted token and remembers it for next time", async () => {
    const user = userEvent.setup();
    renderPage();
    expect(await screen.findByText("root line 1")).toBeInTheDocument();

    await user.type(
      await screen.findByLabelText("studio.live_control.token.label"),
      "tok-123",
    );
    await user.click(
      screen.getByRole("button", { name: "studio.common.save" }),
    );

    expect(
      screen.queryByLabelText("studio.live_control.token.label"),
    ).not.toBeInTheDocument();
    expect(localStorage.getItem("recitation_emit_token")).toBe("tok-123");

    await user.click(
      screen.getByRole("button", {
        name: "studio.live_control.controls.next →",
      }),
    );

    await waitFor(() =>
      expect(publishPosition).toHaveBeenCalledWith(
        "e1",
        "tok-123",
        {
          textId: "root",
          segmentId: "root-s1",
          index: 0,
          roundNumber: 1,
        },
        expect.any(String),
      ),
    );
  });

  it("steps over yigchung lines with Next and back, and sets them apart", async () => {
    const user = userEvent.setup();
    localStorage.setItem("recitation_emit_token", "tok-123");
    fetchRecitationDetails.mockImplementation(
      async (textId: string, language: string) => linesFor(textId, language, 4),
    );
    // Line 2 is instruction throughout; line 3 carries some in its first word.
    fetchEditionYigchungs.mockImplementation(async (textId: string) =>
      textId === "root"
        ? {
            "root-s2": {
              full: true,
              ranges: [{ start: 0, end: 11 }],
              length: 11,
            },
            "root-s3": {
              full: false,
              ranges: [{ start: 0, end: 4 }],
              length: 11,
            },
          }
        : {},
    );
    renderPage();
    await followNone(user);
    await waitFor(() =>
      expect(document.querySelector('[data-line="1"]')).toHaveAttribute(
        "data-yigchung",
      ),
    );
    expect(
      document.querySelector('[data-line="2"] [data-yigchung]'),
    ).toHaveTextContent("root");

    const next = screen.getByRole("button", {
      name: "studio.live_control.controls.next →",
    });
    await user.click(next);
    await user.click(next);
    await waitFor(() =>
      expect(publishPosition).toHaveBeenLastCalledWith(
        "e1",
        "tok-123",
        expect.objectContaining({ segmentId: "root-s3", index: 2 }),
        expect.any(String),
      ),
    );
    expect(publishPosition).not.toHaveBeenCalledWith(
      "e1",
      "tok-123",
      expect.objectContaining({ segmentId: "root-s2" }),
      expect.any(String),
    );

    await pressKey("ArrowLeft");
    await waitFor(() =>
      expect(publishPosition).toHaveBeenLastCalledWith(
        "e1",
        "tok-123",
        expect.objectContaining({ segmentId: "root-s1", index: 0 }),
        expect.any(String),
      ),
    );
  });

  it("holds a move made before the yigchung arrives, so an instruction is never published", async () => {
    const user = userEvent.setup();
    localStorage.setItem("recitation_emit_token", "tok-123");
    fetchRecitationDetails.mockImplementation(
      async (textId: string, language: string) => linesFor(textId, language, 3),
    );
    // The lines are in; the marks are still on their way.
    let deliver: (marks: Record<string, unknown>) => void = () => {};
    fetchEditionYigchungs.mockImplementation((textId: string) =>
      textId === "root"
        ? new Promise((resolve) => {
            deliver = resolve;
          })
        : Promise.resolve({}),
    );
    renderPage();
    await followNone(user);
    expect(await screen.findByText("root line 1")).toBeInTheDocument();

    await user.click(screen.getByText("root line 1"));
    await waitFor(() =>
      expect(publishPosition).toHaveBeenLastCalledWith(
        "e1",
        "tok-123",
        expect.objectContaining({ segmentId: "root-s1" }),
        expect.any(String),
      ),
    );
    // Held, not dropped: nothing moves until the marks say what line 2 is.
    await user.click(
      screen.getByRole("button", {
        name: "studio.live_control.controls.next →",
      }),
    );
    expect(screen.getByText(/line_of line=1 total=3/)).toBeInTheDocument();

    await act(async () => {
      deliver({
        "root-s2": { full: true, ranges: [{ start: 0, end: 11 }], length: 11 },
      });
    });
    await waitFor(() =>
      expect(publishPosition).toHaveBeenLastCalledWith(
        "e1",
        "tok-123",
        expect.objectContaining({ segmentId: "root-s3" }),
        expect.any(String),
      ),
    );
    expect(publishPosition).not.toHaveBeenCalledWith(
      "e1",
      "tok-123",
      expect.objectContaining({ segmentId: "root-s2" }),
      expect.any(String),
    );
  });

  it("drops a held move when the operator taps a line before the yigchung arrives", async () => {
    const user = userEvent.setup();
    localStorage.setItem("recitation_emit_token", "tok-123");
    fetchRecitationDetails.mockImplementation(
      async (textId: string, language: string) => linesFor(textId, language, 4),
    );
    let deliver: (marks: Record<string, unknown>) => void = () => {};
    fetchEditionYigchungs.mockImplementation((textId: string) =>
      textId === "root"
        ? new Promise((resolve) => {
            deliver = resolve;
          })
        : Promise.resolve({}),
    );
    renderPage();
    await followNone(user);
    expect(await screen.findByText("root line 1")).toBeInTheDocument();

    // Next is held; then the operator picks line 3 themselves.
    await user.click(
      screen.getByRole("button", {
        name: "studio.live_control.controls.next →",
      }),
    );
    await user.click(screen.getByText("root line 3"));
    await act(async () => {
      deliver({});
    });

    expect(screen.getByText(/line_of line=3 total=4/)).toBeInTheDocument();
    expect(publishPosition).toHaveBeenLastCalledWith(
      "e1",
      "tok-123",
      expect.objectContaining({ segmentId: "root-s3" }),
      expect.any(String),
    );
    expect(publishPosition).not.toHaveBeenCalledWith(
      "e1",
      "tok-123",
      expect.objectContaining({ segmentId: "root-s4" }),
      expect.any(String),
    );
  });

  it("refuses to drive the room before a token is pasted", async () => {
    const user = userEvent.setup();
    renderPage();
    expect(await screen.findByText("root line 1")).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", {
        name: "studio.live_control.controls.next →",
      }),
    );

    expect(publishPosition).not.toHaveBeenCalled();
    expect(
      await screen.findByText(/publisher\.token_needed/),
    ).toBeInTheDocument();
    expect(publishState()).toHaveTextContent(
      "studio.live_control.status.no_token",
    );
  });

  it("closes an error message", async () => {
    const user = userEvent.setup();
    fetchTextEditions.mockRejectedValue(new Error("offline"));
    renderPage();

    const alert = await screen.findByRole("alert");
    await user.click(
      screen.getByRole("button", {
        name: "studio.live_control.dismiss_message",
      }),
    );

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
    await user.click(
      screen.getByRole("button", {
        name: "studio.live_control.dismiss_message",
      }),
    );
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
        expect.any(String),
      ),
    );
    expect(publishPosition).not.toHaveBeenCalledWith(
      "e1",
      "tok-123",
      expect.objectContaining({ textId: "root-en" }),
      expect.any(String),
    );

    await act(async () => {
      releaseEnglish();
    });

    // Its readers are brought to the line the room is on.
    await waitFor(() =>
      expect(publishPosition).toHaveBeenCalledWith(
        "e1",
        "tok-123",
        {
          textId: "root-en",
          segmentId: "root-en-s1",
          index: 0,
          roundNumber: 1,
        },
        expect.any(String),
      ),
    );
    // And the room is left on the edition being read.
    await waitFor(() =>
      expect(publishPosition).toHaveBeenLastCalledWith(
        "e1",
        "tok-123",
        expect.objectContaining({ textId: "root" }),
        expect.any(String),
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
        expect.any(String),
      ),
    );

    await pressKey("ArrowRight");
    await waitFor(() =>
      expect(publishPosition).toHaveBeenCalledWith(
        "e1",
        "tok-123",
        expect.objectContaining({ segmentId: "root-s2", index: 1 }),
        expect.any(String),
      ),
    );

    await pressKey("ArrowLeft");
    await waitFor(() =>
      expect(publishPosition).toHaveBeenCalledWith(
        "e1",
        "tok-123",
        expect.objectContaining({ segmentId: "root-s1", index: 0 }),
        expect.any(String),
      ),
    );

    // Never before the first line.
    publishPosition.mockClear();
    await pressKey("ArrowLeft");
    expect(publishPosition).not.toHaveBeenCalled();

    // Space on a control does what that control does, not what the room does.
    const next = screen.getByRole("button", {
      name: "studio.live_control.controls.next →",
    });
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

    await user.click(
      screen.getByRole("button", {
        name: "studio.live_control.controls.next →",
      }),
    );
    expect(
      await screen.findByText(/emit token was rejected/i),
    ).toBeInTheDocument();
    expect(publishState()).toHaveTextContent(
      "studio.live_control.status.not_publishing",
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

    it("draws the sections in the order dragged before, and resets it", async () => {
      const user = userEvent.setup();
      localStorage.setItem(
        "live-control-section-order:root",
        JSON.stringify(["s2", "s1"]),
      );
      fetchEditionSections.mockResolvedValue(outline);
      renderPage();

      const titles = () =>
        [...document.querySelectorAll("[data-section-active]")].map(
          (button) => button.textContent,
        );
      await screen.findByRole("button", { name: "Praises" });
      expect(titles()).toEqual(["Praises", "Going for Refuge"]);
      // Each row is dragged by its own handle.
      expect(
        screen.getByRole("button", {
          name: "studio.live_control.section.reorder_aria title=Praises",
        }),
      ).toBeInTheDocument();
      // The section being recited still goes by the lines.
      await user.click(screen.getByText("root line 1"));
      expect(
        screen.getByRole("button", { name: "Going for Refuge" }),
      ).toHaveAttribute("data-section-active", "true");

      await user.click(
        screen.getByRole("button", {
          name: "studio.live_control.section.reset_order",
        }),
      );
      expect(titles()).toEqual(["Going for Refuge", "Praises"]);
      expect(
        localStorage.getItem("live-control-section-order:root"),
      ).toBeNull();
      expect(
        screen.queryByRole("button", {
          name: "studio.live_control.section.reset_order",
        }),
      ).not.toBeInTheDocument();
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

    it("offers to resume a section left partway, where it was left", async () => {
      const user = userEvent.setup();
      localStorage.setItem("recitation_emit_token", "tok-123");
      fetchRecitationDetails.mockImplementation(
        async (textId: string, language: string) =>
          linesFor(textId, language, 6),
      );
      // Refuge is lines 1-3, Praises lines 4-6.
      fetchEditionSections.mockResolvedValue([
        { id: "s1", title: "Going for Refuge", depth: 0, segmentId: "root-s1" },
        { id: "s2", title: "Praises", depth: 0, segmentId: "root-s4" },
      ]);
      renderPage();
      await followNone(user);
      expect(await screen.findByText("root line 1")).toBeInTheDocument();

      // Two lines into Refuge, then over to Praises.
      const next = screen.getByRole("button", {
        name: "studio.live_control.controls.next →",
      });
      await user.click(next);
      await user.click(next);
      expect(
        screen.queryByRole("button", {
          name: "studio.live_control.section.resume_aria title=Going for Refuge",
        }),
      ).not.toBeInTheDocument();
      await user.click(await screen.findByRole("button", { name: "Praises" }));

      // Praises was entered at its start, so only Refuge has somewhere to resume.
      expect(
        screen.queryByRole("button", {
          name: "studio.live_control.section.resume_aria title=Praises",
        }),
      ).not.toBeInTheDocument();
      await user.click(
        screen.getByRole("button", {
          name: "studio.live_control.section.resume_aria title=Going for Refuge",
        }),
      );
      await waitFor(() =>
        expect(publishPosition).toHaveBeenLastCalledWith(
          "e1",
          "tok-123",
          expect.objectContaining({ segmentId: "root-s2", index: 1 }),
          expect.any(String),
        ),
      );
      expect(screen.getByText(/line_of line=2 total=6/)).toBeInTheDocument();
    });

    it("offers no resume for a section taken to its last line", async () => {
      const user = userEvent.setup();
      localStorage.setItem("recitation_emit_token", "tok-123");
      fetchRecitationDetails.mockImplementation(
        async (textId: string, language: string) =>
          linesFor(textId, language, 6),
      );
      fetchEditionSections.mockResolvedValue([
        { id: "s1", title: "Going for Refuge", depth: 0, segmentId: "root-s1" },
        { id: "s2", title: "Praises", depth: 0, segmentId: "root-s4" },
      ]);
      renderPage();
      await followNone(user);
      expect(await screen.findByText("root line 1")).toBeInTheDocument();

      await user.click(screen.getByText("root line 3"));
      await user.click(await screen.findByRole("button", { name: "Praises" }));

      expect(
        screen.queryByRole("button", {
          name: "studio.live_control.section.resume_aria title=Going for Refuge",
        }),
      ).not.toBeInTheDocument();
    });

    it("goes to the first segment of a section that is picked", async () => {
      const user = userEvent.setup();
      localStorage.setItem("recitation_emit_token", "tok-123");
      fetchEditionSections.mockResolvedValue(outline);
      renderPage();
      expect(await screen.findByText("root line 1")).toBeInTheDocument();

      await user.click(await screen.findByRole("button", { name: "Praises" }));

      await waitFor(() =>
        expect(publishPosition).toHaveBeenCalledWith(
          "e1",
          "tok-123",
          {
            textId: "root",
            segmentId: "root-s3",
            index: 2,
            roundNumber: 1,
          },
          expect.any(String),
        ),
      );
      expect(screen.getByText(/line_of line=3 total=3/)).toBeInTheDocument();
    });

    it("goes to a section picked from the floating dot's titles", async () => {
      const user = userEvent.setup();
      localStorage.setItem("recitation_emit_token", "tok-123");
      fetchEditionSections.mockResolvedValue([
        { ...outline[0], icon: "🪷" },
        outline[1],
      ]);
      renderPage();
      expect(await screen.findByText("root line 1")).toBeInTheDocument();

      // The top right opens the same titles, so the dot is found by its mark.
      await waitFor(() =>
        expect(document.querySelector("[data-touch-dot]")).not.toBeNull(),
      );
      await user.click(
        document.querySelector("[data-touch-dot]") as HTMLElement,
      );
      const menu = screen.getByRole("dialog", {
        name: "studio.live_control.toc.title",
      });
      // The titles only, each by its icon.
      expect(
        [...menu.querySelectorAll("[data-touch-item]")].map(
          (tile) => tile.textContent,
        ),
      ).toEqual(["🪷Going for Refuge", "Praises"]);
      await user.click(within(menu).getByRole("button", { name: "Praises" }));

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      await waitFor(() =>
        expect(publishPosition).toHaveBeenCalledWith(
          "e1",
          "tok-123",
          expect.objectContaining({ segmentId: "root-s3", index: 2 }),
          expect.any(String),
        ),
      );
    });

    it("passes over yigchung a picked section opens on", async () => {
      const user = userEvent.setup();
      localStorage.setItem("recitation_emit_token", "tok-123");
      fetchEditionSections.mockResolvedValue([
        { id: "s1", title: "Going for Refuge", depth: 0, segmentId: "root-s1" },
        { id: "s2", title: "Praises", depth: 0, segmentId: "root-s2" },
      ]);
      fetchEditionYigchungs.mockImplementation(async (textId: string) =>
        textId === "root"
          ? {
              "root-s2": {
                full: true,
                ranges: [{ start: 0, end: 11 }],
                length: 11,
              },
            }
          : {},
      );
      renderPage();
      expect(await screen.findByText("root line 1")).toBeInTheDocument();
      await waitFor(() =>
        expect(
          document.querySelector('[data-line="1"][data-yigchung]'),
        ).not.toBeNull(),
      );

      await user.click(await screen.findByRole("button", { name: "Praises" }));

      await waitFor(() =>
        expect(publishPosition).toHaveBeenCalledWith(
          "e1",
          "tok-123",
          expect.objectContaining({ segmentId: "root-s3", index: 2 }),
          expect.any(String),
        ),
      );
      expect(publishPosition).not.toHaveBeenCalledWith(
        "e1",
        "tok-123",
        expect.objectContaining({ segmentId: "root-s2" }),
        expect.any(String),
      );
    });

    /** Line 2 of the text is instruction from end to end. */
    const secondLineYigchung = async (textId: string) =>
      textId === "root"
        ? {
            "root-s2": {
              full: true,
              ranges: [{ start: 0, end: 11 }],
              length: 11,
            },
          }
        : {};

    it("does not send the next section's line for a section of instruction alone", async () => {
      localStorage.setItem("recitation_emit_token", "tok-123");
      fetchEditionSections.mockResolvedValue([
        { id: "s1", title: "Going for Refuge", depth: 0, segmentId: "root-s1" },
        { id: "s2", title: "Instructions", depth: 0, segmentId: "root-s2" },
        { id: "s3", title: "Praises", depth: 0, segmentId: "root-s3" },
      ]);
      fetchEditionYigchungs.mockImplementation(secondLineYigchung);
      renderPage();
      expect(await screen.findByText("root line 1")).toBeInTheDocument();

      // Line 3 is recited, but it is Praises', not this section's.
      await waitFor(() =>
        expect(
          screen.getByRole("button", { name: "Instructions" }),
        ).toBeDisabled(),
      );
      expect(
        screen.getByRole("button", { name: "Instructions" }),
      ).toHaveAttribute("title", "studio.live_control.section.nothing_recited");
      expect(screen.getByRole("button", { name: "Praises" })).toBeEnabled();
    });

    it("does not send the next section's line when both begin on the same instruction", async () => {
      const user = userEvent.setup();
      localStorage.setItem("recitation_emit_token", "tok-123");
      // Praises begins partway through line 2, so both are anchored to it.
      fetchEditionSections.mockResolvedValue([
        { id: "s1", title: "Going for Refuge", depth: 0, segmentId: "root-s1" },
        { id: "s2", title: "Instructions", depth: 0, segmentId: "root-s2" },
        { id: "s3", title: "Praises", depth: 0, segmentId: "root-s2" },
      ]);
      fetchEditionYigchungs.mockImplementation(secondLineYigchung);
      renderPage();
      expect(await screen.findByText("root line 1")).toBeInTheDocument();

      await waitFor(() =>
        expect(
          screen.getByRole("button", { name: "Instructions" }),
        ).toBeDisabled(),
      );
      await user.click(screen.getByRole("button", { name: "Praises" }));
      await waitFor(() =>
        expect(publishPosition).toHaveBeenCalledWith(
          "e1",
          "tok-123",
          expect.objectContaining({ segmentId: "root-s3", index: 2 }),
          expect.any(String),
        ),
      );
    });

    it("goes on to the first subsection of a section that opens on instruction", async () => {
      const user = userEvent.setup();
      localStorage.setItem("recitation_emit_token", "tok-123");
      fetchEditionSections.mockResolvedValue([
        { id: "s1", title: "Going for Refuge", depth: 0, segmentId: "root-s1" },
        { id: "s2", title: "Praises", depth: 0, segmentId: "root-s2" },
        { id: "s3", title: "First praise", depth: 1, segmentId: "root-s3" },
      ]);
      fetchEditionYigchungs.mockImplementation(secondLineYigchung);
      renderPage();
      expect(await screen.findByText("root line 1")).toBeInTheDocument();
      await waitFor(() =>
        expect(
          document.querySelector('[data-line="1"][data-yigchung]'),
        ).not.toBeNull(),
      );

      // Its subsection is part of it: there is something to recite after all.
      await user.click(screen.getByRole("button", { name: "Praises" }));

      await waitFor(() =>
        expect(publishPosition).toHaveBeenCalledWith(
          "e1",
          "tok-123",
          expect.objectContaining({ segmentId: "root-s3", index: 2 }),
          expect.any(String),
        ),
      );
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

      await user.click(
        screen.getByRole("button", {
          name: "studio.live_control.controls.next →",
        }),
      );
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
        screen.queryByRole("button", { name: /return_jumps\.praises_2/ }),
      ).not.toBeInTheDocument();

      await user.click(
        screen.getByRole("button", {
          name: "studio.live_control.return.aria label=studio.live_control.return_jumps.praises_1 round=1",
        }),
      );

      // Going back is the praise's next round.
      await waitFor(() =>
        expect(publishPosition).toHaveBeenCalledWith(
          "e1",
          "tok-123",
          {
            textId: "root",
            segmentId: "BsajlElFFNFLoHcUjICwB",
            index: 0,
            roundNumber: 2,
          },
          expect.any(String),
        ),
      );
      expect(screen.getByText(/line_of line=1 total=3/)).toBeInTheDocument();

      // The rest of the passage is recited in that round too.
      await user.click(
        screen.getByRole("button", {
          name: "studio.live_control.controls.next →",
        }),
      );
      await waitFor(() =>
        expect(publishPosition).toHaveBeenLastCalledWith(
          "e1",
          "tok-123",
          {
            textId: "root",
            segmentId: "root-middle",
            index: 1,
            roundNumber: 2,
            elapsedMs: expect.any(Number),
          },
          expect.any(String),
        ),
      );
    });

    it("moves the badge only once the room takes the new round", async () => {
      const user = userEvent.setup();
      localStorage.setItem("recitation_emit_token", "tok-123");
      fetchRecitationDetails.mockImplementation(
        async (textId: string, language: string) =>
          textId !== "root"
            ? linesFor(textId, language, 3)
            : {
                text_id: "root",
                title: "root",
                segments: [
                  {
                    recitation: {
                      bo: { id: "BsajlElFFNFLoHcUjICwB", content: "homage" },
                    },
                  },
                  {
                    recitation: {
                      bo: { id: "kYNR7EmC5apQWrkYl5fiO", content: "mantra" },
                    },
                  },
                ],
              },
      );
      publishPosition.mockResolvedValue({
        ok: false,
        message: "That emit token was rejected. Check it and paste it again.",
      });
      renderPage();
      const label = "studio.live_control.return_jumps.praises_1";

      await user.click(
        await screen.findByRole("button", {
          name: `studio.live_control.return.aria label=${label} round=1`,
        }),
      );
      await screen.findByText(/emit token was rejected/);

      // Refused: the badge stays on the round the room has, the new one waits.
      expect(
        screen.getByRole("button", {
          name: `studio.live_control.return.aria label=${label} round=1`,
        }),
      ).toBeInTheDocument();
      expect(document.querySelector("[data-round-pending]")).toHaveTextContent(
        "→ 2",
      );
      expect(localStorage.getItem("live-control-return-counts:e1")).toBeNull();

      // Once the room takes a line of that round, the badge moves.
      publishPosition.mockResolvedValue({ ok: true });
      await user.click(
        screen.getByRole("button", {
          name: "studio.live_control.controls.next →",
        }),
      );
      expect(
        await screen.findByRole("button", {
          name: `studio.live_control.return.aria label=${label} round=2`,
        }),
      ).toBeInTheDocument();
      expect(publishPosition).toHaveBeenLastCalledWith(
        "e1",
        "tok-123",
        expect.objectContaining({
          segmentId: "kYNR7EmC5apQWrkYl5fiO",
          roundNumber: 2,
        }),
        expect.any(String),
      );
      expect(document.querySelector("[data-round-pending]")).toBeNull();
    });

    it("clears every count with the text's last Return, and starts it over in round 1", async () => {
      const user = userEvent.setup();
      localStorage.setItem("recitation_emit_token", "tok-123");
      const line = (id: string, content: string) => ({
        recitation: { bo: { id, content } },
      });
      fetchRecitationDetails.mockImplementation(
        async (textId: string, language: string) =>
          textId !== "root"
            ? linesFor(textId, language, 4)
            : {
                text_id: "root",
                title: "root",
                segments: [
                  line("BsajlElFFNFLoHcUjICwB", "first homage"),
                  line("kYNR7EmC5apQWrkYl5fiO", "first mantra"),
                  line("cdgek8Op2tOd3YplRyUzV", "second homage"),
                  line("IWMKZtgFHWDxOLQrov7Iq", "second mantra"),
                ],
              },
      );
      renderPage();
      const first = "studio.live_control.return_jumps.praises_1";
      const last = "studio.live_control.return_jumps.praises_2";

      await user.click(
        await screen.findByRole("button", {
          name: `studio.live_control.return.aria label=${first} round=1`,
        }),
      );
      await user.click(
        await screen.findByRole("button", {
          name: `studio.live_control.return.aria label=${first} round=2`,
        }),
      );
      expect(
        await screen.findByRole("button", {
          name: `studio.live_control.return.aria label=${first} round=3`,
        }),
      ).toBeInTheDocument();
      publishPosition.mockClear();

      await user.click(
        screen.getByRole("button", {
          name: `studio.live_control.return.aria label=${last} round=1`,
        }),
      );

      expect(
        await screen.findByRole("button", {
          name: `studio.live_control.return.aria label=${first} round=1`,
        }),
      ).toBeInTheDocument();
      // Not a round of its own passage: the puja starts over.
      expect(
        screen.getByRole("button", {
          name: `studio.live_control.return.aria label=${last} round=1`,
        }),
      ).toBeInTheDocument();
      expect(
        JSON.parse(
          localStorage.getItem("live-control-return-counts:e1") ?? "{}",
        ),
      ).toEqual({});
      await waitFor(() =>
        expect(publishPosition).toHaveBeenCalledWith(
          "e1",
          "tok-123",
          expect.objectContaining({
            segmentId: "cdgek8Op2tOd3YplRyUzV",
            roundNumber: 1,
          }),
          expect.any(String),
        ),
      );
    });

    it("counts each return on the button, keeps the count, and resets it to 1", async () => {
      const user = userEvent.setup();
      localStorage.setItem("recitation_emit_token", "tok-123");
      fetchRecitationDetails.mockImplementation(
        async (textId: string, language: string) =>
          textId !== "root"
            ? linesFor(textId, language, 3)
            : {
                text_id: "root",
                title: "root",
                segments: [
                  {
                    recitation: {
                      bo: { id: "BsajlElFFNFLoHcUjICwB", content: "homage" },
                    },
                  },
                  {
                    recitation: {
                      bo: { id: "kYNR7EmC5apQWrkYl5fiO", content: "mantra" },
                    },
                  },
                ],
              },
      );
      renderPage();
      const label = "studio.live_control.return_jumps.praises_1";

      // Nothing pressed yet: the first round, and nothing to reset.
      await user.click(
        await screen.findByRole("button", {
          name: `studio.live_control.return.aria label=${label} round=1`,
        }),
      );
      expect(
        screen.getByRole("button", {
          name: `studio.live_control.return.aria label=${label} round=2`,
        }),
      ).toBeInTheDocument();
      await user.click(
        screen.getByRole("button", {
          name: `studio.live_control.return.aria label=${label} round=2`,
        }),
      );
      expect(
        screen.getByRole("button", {
          name: `studio.live_control.return.aria label=${label} round=3`,
        }),
      ).toBeInTheDocument();
      expect(
        JSON.parse(
          localStorage.getItem("live-control-return-counts:e1") ?? "{}",
        ),
      ).toEqual({ "1-85": 3 });

      await user.click(
        screen.getByRole("button", {
          name: `studio.live_control.return.reset_aria label=${label}`,
        }),
      );
      expect(
        screen.getByRole("button", {
          name: `studio.live_control.return.aria label=${label} round=1`,
        }),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole("button", {
          name: `studio.live_control.return.reset_aria label=${label}`,
        }),
      ).not.toBeInTheDocument();
      expect(
        JSON.parse(
          localStorage.getItem("live-control-return-counts:e1") ?? "{}",
        ),
      ).toEqual({});
    });

    it("picks the return count up from this browser, for this event only", async () => {
      localStorage.setItem(
        "live-control-return-counts:e1",
        JSON.stringify({ "1-85": 4 }),
      );
      // The same praise at another event has its own count.
      localStorage.setItem(
        "live-control-return-counts:other-event",
        JSON.stringify({ "1-85": 9 }),
      );
      fetchRecitationDetails.mockImplementation(
        async (textId: string, language: string) =>
          textId !== "root"
            ? linesFor(textId, language, 3)
            : {
                text_id: "root",
                title: "root",
                segments: [
                  {
                    recitation: {
                      bo: { id: "BsajlElFFNFLoHcUjICwB", content: "homage" },
                    },
                  },
                  {
                    recitation: {
                      bo: { id: "kYNR7EmC5apQWrkYl5fiO", content: "mantra" },
                    },
                  },
                ],
              },
      );
      renderPage();

      expect(
        await screen.findByRole("button", {
          name: "studio.live_control.return.aria label=studio.live_control.return_jumps.praises_1 round=4",
        }),
      ).toBeInTheDocument();
    });

    it("does not count a return made with no token, which reaches no room", async () => {
      const user = userEvent.setup();
      fetchRecitationDetails.mockImplementation(
        async (textId: string, language: string) =>
          textId !== "root"
            ? linesFor(textId, language, 3)
            : {
                text_id: "root",
                title: "root",
                segments: [
                  {
                    recitation: {
                      bo: { id: "BsajlElFFNFLoHcUjICwB", content: "homage" },
                    },
                  },
                  {
                    recitation: {
                      bo: { id: "kYNR7EmC5apQWrkYl5fiO", content: "mantra" },
                    },
                  },
                ],
              },
      );
      renderPage();
      const label = "studio.live_control.return_jumps.praises_1";

      await user.click(
        await screen.findByRole("button", {
          name: `studio.live_control.return.aria label=${label} round=1`,
        }),
      );

      expect(
        screen.getByRole("button", {
          name: `studio.live_control.return.aria label=${label} round=1`,
        }),
      ).toBeInTheDocument();
      expect(localStorage.getItem("live-control-return-counts:e1")).toBeNull();
    });

    /** A praise of two lines, whose ending carries a Return. */
    const openPraise = async () => {
      localStorage.setItem("recitation_emit_token", "tok-123");
      fetchRecitationDetails.mockImplementation(
        async (textId: string, language: string) =>
          textId !== "root"
            ? linesFor(textId, language, 3)
            : {
                text_id: "root",
                title: "root",
                segments: [
                  {
                    recitation: {
                      bo: { id: "BsajlElFFNFLoHcUjICwB", content: "homage" },
                    },
                  },
                  {
                    recitation: {
                      bo: { id: "kYNR7EmC5apQWrkYl5fiO", content: "mantra" },
                    },
                  },
                ],
              },
      );
      renderPage();
      return "studio.live_control.return_jumps.praises_1";
    };

    /** Holds the room's answer to round `round` of the praise until released. */
    const holdRound = (round: number) => {
      let release = () => {};
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      publishPosition.mockImplementation(async (_event, _token, cue) => {
        if (cue.textId === "root" && cue.roundNumber === round) await gate;
        return { ok: true };
      });
      return () => act(async () => release());
    };

    it("counts a second return made before the room took the first", async () => {
      const user = userEvent.setup();
      const release = holdRound(2);
      const label = await openPraise();

      await user.click(
        await screen.findByRole("button", {
          name: `studio.live_control.return.aria label=${label} round=1`,
        }),
      );
      await waitFor(() =>
        expect(publishPosition).toHaveBeenCalledWith(
          "e1",
          "tok-123",
          expect.objectContaining({ textId: "root", roundNumber: 2 }),
          expect.any(String),
        ),
      );
      // Still on its way: the next return is the round after it.
      await user.click(
        screen.getByRole("button", {
          name: `studio.live_control.return.aria label=${label} round=1`,
        }),
      );
      await release();

      await waitFor(() =>
        expect(publishPosition).toHaveBeenLastCalledWith(
          "e1",
          "tok-123",
          {
            textId: "root",
            segmentId: "BsajlElFFNFLoHcUjICwB",
            index: 0,
            roundNumber: 3,
            elapsedMs: expect.any(Number),
          },
          expect.any(String),
        ),
      );
      expect(
        await screen.findByRole("button", {
          name: `studio.live_control.return.aria label=${label} round=3`,
        }),
      ).toBeInTheDocument();
    });

    it("keeps a reset made while a return was still on its way", async () => {
      const user = userEvent.setup();
      localStorage.setItem(
        "live-control-return-counts:e1",
        JSON.stringify({ "1-85": 2 }),
      );
      const release = holdRound(3);
      const label = await openPraise();

      await user.click(
        await screen.findByRole("button", {
          name: `studio.live_control.return.aria label=${label} round=2`,
        }),
      );
      await waitFor(() =>
        expect(publishPosition).toHaveBeenCalledWith(
          "e1",
          "tok-123",
          expect.objectContaining({ textId: "root", roundNumber: 3 }),
          expect.any(String),
        ),
      );
      await user.click(
        screen.getByRole("button", {
          name: `studio.live_control.return.reset_aria label=${label}`,
        }),
      );
      // The room takes the return only now, after the reset.
      await release();
      await waitFor(() =>
        expect(
          screen.getByText(
            /controls\.sent detail=studio\.live_control\.publisher\.last_sent line=1 /,
          ),
        ).toBeInTheDocument(),
      );

      expect(
        screen.getByRole("button", {
          name: `studio.live_control.return.aria label=${label} round=1`,
        }),
      ).toBeInTheDocument();
      expect(
        JSON.parse(
          localStorage.getItem("live-control-return-counts:e1") ?? "{}",
        ),
      ).toEqual({});
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

      await user.click(controlButton("studio.live_control.show_titles"));

      expect(scrollIntoView).toHaveBeenCalled();
    });

    it("opens the titles as a popup from the title, and closes it on a pick", async () => {
      const user = userEvent.setup();
      localStorage.setItem("recitation_emit_token", "tok-123");
      fetchEditionSections.mockResolvedValue(outline);
      renderPage();
      expect(await screen.findByText("root line 1")).toBeInTheDocument();

      await user.click(await findTitlesButton());
      const popup = screen.getByRole("dialog", {
        name: "studio.live_control.toc.title",
      });
      await user.click(within(popup).getByRole("button", { name: "Praises" }));

      await waitFor(() =>
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
      );
      expect(screen.getByText(/line_of line=3 total=3/)).toBeInTheDocument();
    });

    it("closes the titles popup without a pick", async () => {
      const user = userEvent.setup();
      fetchEditionSections.mockResolvedValue(outline);
      renderPage();
      expect(await screen.findByText("root line 1")).toBeInTheDocument();

      await user.click(await findTitlesButton());
      await user.click(
        within(screen.getByRole("dialog")).getByRole("button", {
          name: "studio.common.close",
        }),
      );

      await waitFor(() =>
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
      );
    });

    it("draws no section list for an edition with no outline", async () => {
      renderPage();

      expect(await screen.findByText("root line 1")).toBeInTheDocument();
      expect(
        screen.queryByText("studio.live_control.sections"),
      ).not.toBeInTheDocument();
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

      await user.click(controlButton("studio.live_control.show_titles"));
      expect(titlesPanel()).toHaveAttribute("data-titles", "unfolded");

      await user.click(controlButton("studio.live_control.hide_titles"));
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
      await user.click(controlButton("studio.live_control.show_titles"));
      await user.click(
        screen.getByRole("button", {
          name: "studio.live_control.setup.open_aria title=Refuge",
        }),
      );

      expect(titlesPanel()).toHaveAttribute("data-titles", "unfolded");
    });

    it("drags the divider to split the height, and remembers the split", async () => {
      const user = userEvent.setup();
      renderPage();
      expect(await screen.findByText("root line 1")).toBeInTheDocument();
      await user.click(controlButton("studio.live_control.show_titles"));

      const divider = screen.getByRole("separator", {
        name: "studio.live_control.resize_titles",
      });
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
      await user.click(controlButton("studio.live_control.show_titles"));

      const divider = screen.getByRole("separator", {
        name: "studio.live_control.resize_titles",
      });
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
      await user.click(controlButton("studio.live_control.show_titles"));

      const divider = screen.getByRole("separator", {
        name: "studio.live_control.resize_titles",
      });
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
      await user.click(controlButton("studio.live_control.show_titles"));

      expect(
        screen.getByRole("separator", {
          name: "studio.live_control.resize_titles",
        }),
      ).toHaveAttribute("aria-valuenow", "60");
    });

    it("opens the text box on a phone when no text is open", async () => {
      localStorage.removeItem("live-control-recent-texts");
      noEventLiturgies();
      const user = userEvent.setup();
      renderPage();

      // Pasting a text id is the only way in, so it is not left two taps away.
      await waitFor(() =>
        expect(titlesPanel()).toHaveAttribute("data-titles", "unfolded"),
      );
      expect(setupPanel()).toHaveAttribute("data-setup", "unfolded");
      expect(
        screen.queryByRole("button", {
          name: /^studio.live_control.setup\.(hide|show)$/,
        }),
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

      await user.click(
        screen.getByRole("button", { name: "studio.live_control.setup.show" }),
      );
      expect(setupPanel()).toHaveAttribute("data-setup", "unfolded");
      expect(
        screen.getByRole("button", { name: "studio.live_control.setup.hide" }),
      ).toBeInTheDocument();

      // Folded or open, the editions are in the page: the fold is height on a
      // phone, never a second way to reach them.
      await user.click(
        screen.getByRole("button", { name: "studio.live_control.setup.hide" }),
      );
      expect(setupPanel()).toHaveAttribute("data-setup", "folded");
      await user.click(
        screen.getByRole("checkbox", {
          name: "studio.live_control.editions.follow_aria title=Praise (en)",
        }),
      );
      expect(
        await screen.findByText(/following_one count=1/),
      ).toBeInTheDocument();
    });
  });

  it("links to the autoplay dry run for the text open here", async () => {
    renderPage();
    expect(await screen.findByText("root line 1")).toBeInTheDocument();

    const link = screen.getByRole("link", {
      name: /setup\.test_autoplay/,
    });
    expect(link).toHaveAttribute("href", "/live/e1/autoplay-test?text=root");
    expect(link).toHaveAttribute("target", "_blank");

    // Reading a translation, the dry run opens that edition, as it is driven.
    await userEvent.click(
      screen.getByRole("button", { name: /Praise \(en\)/ }),
    );
    expect(await screen.findByText("root-en line 1")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /setup\.test_autoplay/ }),
    ).toHaveAttribute("href", "/live/e1/autoplay-test?text=root-en");
  });

  describe("autoplay", () => {
    /** Opens the first liturgy with a token, driving the Tibetan alone. */
    const openForAutoplay = async () => {
      const user = userEvent.setup();
      localStorage.setItem("recitation_emit_token", "tok-123");
      renderPage();
      expect(await screen.findByText("root line 1")).toBeInTheDocument();
      await followNone(user);
      await waitFor(() =>
        expect(fetchSegmentPlayTimes).toHaveBeenCalledWith("root"),
      );
      publishPosition.mockClear();
      return user;
    };

    it("shows each line's play time, and a dash where there is none", async () => {
      fetchSegmentPlayTimes.mockResolvedValue({ "root-s1": 4200 });
      await openForAutoplay();

      const first = screen.getByText("root line 1").closest("[data-line]");
      const second = screen.getByText("root line 2").closest("[data-line]");
      await waitFor(() =>
        expect(first?.querySelector("[data-play-time]")?.textContent).toBe(
          "4.2s",
        ),
      );
      expect(second?.querySelector("[data-play-time]")?.textContent).toBe("—");
    });

    const times = { "root-s1": 1200, "root-s2": 900, "root-s3": 700 };
    const autoButton = () =>
      controlButton("▶ studio.live_control.controls.auto");
    const pauseButton = () =>
      controlButton("❚❚ studio.live_control.controls.pause");
    /** The plan the backend was handed, `nth` start of this test. */
    const planSent = (nth = 0) => startAutoplay.mock.calls[nth][2];

    it("hands the backend the whole plan: each line with its recorded time", async () => {
      fetchSegmentPlayTimes.mockResolvedValue(times);
      const user = await openForAutoplay();

      await user.click(autoButton());

      await waitFor(() => expect(startAutoplay).toHaveBeenCalledTimes(1));
      const [event, token, steps, keepFirst] = startAutoplay.mock.calls[0];
      expect([event, token, keepFirst]).toEqual(["e1", "tok-123", undefined]);
      expect(steps.map((step) => step.durationMs)).toEqual([1200, 900, 700]);
      expect(
        steps.map((step) => step.positions.map((p) => p.segmentId)),
      ).toEqual([["root-s1"], ["root-s2"], ["root-s3"]]);
      // The backend sends every line from here on: nothing goes from the page.
      expect(publishPosition).not.toHaveBeenCalled();
      expect(pauseButton()).toBeInTheDocument();
    });

    it("puts the edition on screen last in every step, so the room is left on it", async () => {
      fetchSegmentPlayTimes.mockResolvedValue(times);
      const user = userEvent.setup();
      localStorage.setItem("recitation_emit_token", "tok-123");
      renderPage();
      expect(await screen.findByText("root line 1")).toBeInTheDocument();
      await screen.findByText(/following_other count=2/);
      await waitFor(() => expect(autoButton()).toBeEnabled());

      await user.click(autoButton());

      await waitFor(() => expect(startAutoplay).toHaveBeenCalledTimes(1));
      expect(planSent()[1].positions.map((p) => p.segmentId)).toEqual([
        "root-en-s2",
        "root-zh-s2",
        "root-s2",
      ]);
    });

    it("follows the backend as it moves the room on, and lets go at the end", async () => {
      fetchSegmentPlayTimes.mockResolvedValue(times);
      const user = await openForAutoplay();
      await user.click(autoButton());
      await waitFor(() => expect(startAutoplay).toHaveBeenCalledTimes(1));
      expect(
        await screen.findByText(/line_of line=1 total=3/),
      ).toBeInTheDocument();

      hearAutoplay({ planId: "plan-1", step: 1 });
      expect(
        await screen.findByText(/line_of line=2 total=3/),
      ).toBeInTheDocument();
      hearAutoplay({ planId: "plan-1", step: 2 });
      expect(
        await screen.findByText(/line_of line=3 total=3/),
      ).toBeInTheDocument();

      hearAutoplay({
        planId: "plan-1",
        step: 2,
        status: "stopped",
        reason: "finished",
      });
      expect(
        await waitFor(() =>
          controlButton("▶ studio.live_control.controls.auto"),
        ),
      ).toBeEnabled();
      expect(screen.queryByText(/autoplay\.stopped/)).not.toBeInTheDocument();
    });

    it("ignores word of a plan it did not hand over", async () => {
      fetchSegmentPlayTimes.mockResolvedValue(times);
      const user = await openForAutoplay();
      await user.click(autoButton());
      await waitFor(() => expect(startAutoplay).toHaveBeenCalledTimes(1));

      hearAutoplay({ planId: "someone-elses", step: 2 });

      expect(screen.getByText(/line_of line=1 total=3/)).toBeInTheDocument();
    });

    it("does not step back when the start's answer arrives after the next step", async () => {
      fetchSegmentPlayTimes.mockResolvedValue(times);
      let answer: (
        value: Awaited<ReturnType<typeof startAutoplay>>,
      ) => void = () => {};
      startAutoplay.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            answer = resolve;
          }),
      );
      const user = await openForAutoplay();
      await user.click(autoButton());
      await waitFor(() => expect(startAutoplay).toHaveBeenCalledTimes(1));

      // The socket is quicker than the start's own answer.
      await act(async () =>
        answer({
          ok: true,
          state: autoplayState({ planId: "plan-1", step: 0 }),
        }),
      );
      hearAutoplay({ planId: "plan-1", step: 1 });
      expect(
        await screen.findByText(/line_of line=2 total=3/),
      ).toBeInTheDocument();
      hearAutoplay({ planId: "plan-1", step: 0 });

      expect(screen.getByText(/line_of line=2 total=3/)).toBeInTheDocument();
    });

    it("stops where a line has no recorded time, and says why", async () => {
      fetchSegmentPlayTimes.mockResolvedValue({ "root-s1": 1200 });
      const user = await openForAutoplay();
      await user.click(autoButton());
      await waitFor(() => expect(startAutoplay).toHaveBeenCalledTimes(1));

      // The line with no time is still sent - the plan ends on it.
      expect(planSent().map((step) => step.positions[0].segmentId)).toEqual([
        "root-s1",
        "root-s2",
      ]);
      hearAutoplay({ planId: "plan-1", step: 1 });
      hearAutoplay({
        planId: "plan-1",
        step: 1,
        status: "stopped",
        reason: "finished",
      });

      expect(
        await screen.findByText(/autoplay\.stopped_no_time line=2/),
      ).toBeInTheDocument();
      expect(autoButton()).toBeInTheDocument();
    });

    it("starts from the line after the one on screen, not that line again", async () => {
      fetchSegmentPlayTimes.mockResolvedValue(times);
      const user = await openForAutoplay();
      await user.click(screen.getByText("root line 1"));
      await waitFor(() => expect(publishPosition).toHaveBeenCalled());

      await user.click(autoButton());

      await waitFor(() => expect(startAutoplay).toHaveBeenCalledTimes(1));
      expect(
        planSent().map((step) => step.positions.map((p) => p.segmentId)),
      ).toEqual([["root-s2"], ["root-s3"]]);
    });

    it("will not start on a line with no recorded time", async () => {
      fetchSegmentPlayTimes.mockResolvedValue({});
      const user = await openForAutoplay();

      await user.click(autoButton());

      expect(
        await screen.findByText(/autoplay\.cannot_start_no_time line=1/),
      ).toBeInTheDocument();
      expect(startAutoplay).not.toHaveBeenCalled();
      expect(autoButton()).toBeInTheDocument();
    });

    it("waits for fresh play times before judging a line has none", async () => {
      let fresh = false;
      fetchSegmentPlayTimes.mockImplementation(async () =>
        fresh ? times : {},
      );
      const user = await openForAutoplay();

      fresh = true;
      await user.click(autoButton());

      await waitFor(() => expect(startAutoplay).toHaveBeenCalledTimes(1));
      expect(planSent()).toHaveLength(3);
      expect(
        screen.queryByText(/autoplay\.cannot_start_no_time/),
      ).not.toBeInTheDocument();
    });

    it("pauses the backend where it is", async () => {
      fetchSegmentPlayTimes.mockResolvedValue(times);
      const user = await openForAutoplay();
      await user.click(autoButton());
      await waitFor(() => expect(startAutoplay).toHaveBeenCalledTimes(1));

      await user.click(pauseButton());

      await waitFor(() =>
        expect(stopAutoplay).toHaveBeenCalledWith("e1", "tok-123"),
      );
      expect(autoButton()).toBeInTheDocument();
      // Late word of the plan just paused does not bring it back.
      hearAutoplay({ planId: "plan-1", step: 2 });
      expect(screen.getByText(/line_of line=1 total=3/)).toBeInTheDocument();
    });

    it("says so when a pause did not reach the backend, which is still moving the room", async () => {
      fetchSegmentPlayTimes.mockResolvedValue(times);
      stopAutoplay.mockResolvedValueOnce({
        ok: false,
        message: "Could not reach the room.",
      });
      const user = await openForAutoplay();
      await user.click(autoButton());
      await waitFor(() => expect(startAutoplay).toHaveBeenCalledTimes(1));
      hearAutoplay({ planId: "plan-1", step: 0 });

      await user.click(pauseButton());

      expect(
        await screen.findByText(/autoplay\.could_not_pause/),
      ).toBeInTheDocument();
      // Still running on the server: Pause stays, to be pressed again.
      expect(pauseButton()).toBeInTheDocument();
      await user.click(pauseButton());
      await waitFor(() => expect(stopAutoplay).toHaveBeenCalledTimes(2));
    });

    it("says why when the backend would not start", async () => {
      fetchSegmentPlayTimes.mockResolvedValue(times);
      startAutoplay.mockResolvedValueOnce({
        ok: false,
        message: "The server could not run autoplay just now. Try again.",
      });
      const user = await openForAutoplay();

      await user.click(autoButton());

      expect(
        await screen.findByText(
          /autoplay\.could_not_start message=The server could not run autoplay/,
        ),
      ).toBeInTheDocument();
      expect(autoButton()).toBeInTheDocument();
    });

    it("says so when the backend could not send a line", async () => {
      fetchSegmentPlayTimes.mockResolvedValue(times);
      const user = await openForAutoplay();
      await user.click(autoButton());
      await waitFor(() => expect(startAutoplay).toHaveBeenCalledTimes(1));

      hearAutoplay({ planId: "plan-1", status: "stopped", reason: "failed" });

      expect(
        await screen.findByText(/autoplay\.stopped_failed/),
      ).toBeInTheDocument();
      expect(autoButton()).toBeInTheDocument();
    });

    it("moves the running plan to a line the operator picks, without a new plan", async () => {
      fetchSegmentPlayTimes.mockResolvedValue(times);
      const user = await openForAutoplay();
      await user.click(autoButton());
      await waitFor(() => expect(startAutoplay).toHaveBeenCalledTimes(1));

      await user.click(screen.getByRole("button", { name: /root line 3/ }));

      await waitFor(() =>
        expect(sendAutoplayCommand).toHaveBeenCalledWith("e1", "tok-123", {
          type: "seek",
          planId: "plan-1",
          step: 2,
          expectedStep: 0,
        }),
      );
      // A step of the plan already running: nothing rebuilt, nothing resent,
      // and the backend - not this page - sends the line.
      expect(startAutoplay).toHaveBeenCalledTimes(1);
      expect(publishPosition).not.toHaveBeenCalled();
      expect(screen.getByText(/line_of line=3 total=3/)).toBeInTheDocument();
      expect(pauseButton()).toBeInTheDocument();
    });

    it("sends Next mid-autoplay as the plan's next step, naming the one it ends", async () => {
      fetchSegmentPlayTimes.mockResolvedValue(times);
      const user = await openForAutoplay();
      await user.click(autoButton());
      await waitFor(() => expect(startAutoplay).toHaveBeenCalledTimes(1));

      await user.click(
        screen.getByRole("button", {
          name: "studio.live_control.controls.next →",
        }),
      );

      await waitFor(() =>
        expect(sendAutoplayCommand).toHaveBeenCalledWith(
          "e1",
          "tok-123",
          expect.objectContaining({ type: "seek", step: 1, expectedStep: 0 }),
        ),
      );
      expect(screen.getByText(/line_of line=2 total=3/)).toBeInTheDocument();
    });

    it("sends a step back mid-autoplay as the plan's step before", async () => {
      fetchSegmentPlayTimes.mockResolvedValue(times);
      const user = await openForAutoplay();
      await user.click(autoButton());
      await waitFor(() => expect(startAutoplay).toHaveBeenCalledTimes(1));
      await user.click(
        screen.getByRole("button", {
          name: "studio.live_control.controls.next →",
        }),
      );
      await waitFor(() => expect(sendAutoplayCommand).toHaveBeenCalledTimes(1));

      await pressKey("ArrowLeft");

      await waitFor(() =>
        expect(sendAutoplayCommand).toHaveBeenLastCalledWith(
          "e1",
          "tok-123",
          expect.objectContaining({ type: "seek", step: 0, expectedStep: 1 }),
        ),
      );
      expect(screen.getByText(/line_of line=1 total=3/)).toBeInTheDocument();
    });

    it("sends the seek over the socket while it is open", async () => {
      fetchSegmentPlayTimes.mockResolvedValue(times);
      const viaSocket = vi.fn((command: AutoplayCommand) =>
        Promise.resolve({
          ok: true as const,
          state: autoplayState({
            planId: command.type === "seek" ? command.planId : "plan-1",
            step: command.type === "seek" ? command.step : 0,
          }),
        }),
      );
      act(() => socketStore.set({ status: "open", sendCommand: viaSocket }));
      const user = await openForAutoplay();
      await user.click(autoButton());
      await waitFor(() => expect(startAutoplay).toHaveBeenCalledTimes(1));

      await user.click(screen.getByRole("button", { name: /root line 2/ }));

      await waitFor(() => expect(viaSocket).toHaveBeenCalledTimes(1));
      expect(sendAutoplayCommand).not.toHaveBeenCalled();
    });

    it("hands over a plan of its own when the backend turns the seek down", async () => {
      fetchSegmentPlayTimes.mockResolvedValue(times);
      sendAutoplayCommand.mockResolvedValueOnce({
        ok: false,
        message: "Autoplay is no longer running that plan.",
      });
      const user = await openForAutoplay();
      await user.click(autoButton());
      await waitFor(() => expect(startAutoplay).toHaveBeenCalledTimes(1));

      await user.click(screen.getByRole("button", { name: /root line 3/ }));

      await waitFor(() => expect(startAutoplay).toHaveBeenCalledTimes(2));
      expect(planSent(1).map((step) => step.positions[0].segmentId)).toEqual([
        "root-s3",
      ]);
      expect(publishPosition).not.toHaveBeenCalled();
    });

    it("hands over a plan of its own for a line the running plan does not hold", async () => {
      fetchSegmentPlayTimes.mockResolvedValue(times);
      const user = await openForAutoplay();
      // Started from line 1: the plan runs from line 2, and line 1 is not in it.
      await user.click(screen.getByText("root line 1"));
      await waitFor(() => expect(publishPosition).toHaveBeenCalled());
      await user.click(autoButton());
      await waitFor(() => expect(startAutoplay).toHaveBeenCalledTimes(1));

      await user.click(screen.getByRole("button", { name: /root line 1/ }));

      await waitFor(() => expect(startAutoplay).toHaveBeenCalledTimes(2));
      expect(planSent(1)[0].positions[0].segmentId).toBe("root-s1");
      expect(sendAutoplayCommand).not.toHaveBeenCalled();
    });

    it("reads the times again for a hand move's plan, though this page timed nothing", async () => {
      fetchSegmentPlayTimes.mockResolvedValue({
        "root-s1": 1200,
        "root-s2": 900,
      });
      const user = await openForAutoplay();
      // Started from line 1: the plan runs from line 2, and line 1 is not in it.
      await user.click(screen.getByText("root line 1"));
      await waitFor(() => expect(publishPosition).toHaveBeenCalled());
      await user.click(autoButton());
      await waitFor(() => expect(startAutoplay).toHaveBeenCalledTimes(1));
      // Another controller has since taught the backend line 3's time.
      fetchSegmentPlayTimes.mockResolvedValue(times);

      await user.click(screen.getByRole("button", { name: /root line 1/ }));

      await waitFor(() => expect(startAutoplay).toHaveBeenCalledTimes(2));
      // Line 3 is timed now: the plan runs through it rather than stopping.
      expect(planSent(1).map((step) => step.durationMs)).toEqual([
        1200, 900, 700,
      ]);
    });

    it("builds a hand move's plan on a time the room has just taught, not the ones on hand", async () => {
      fetchSegmentPlayTimes.mockResolvedValue({
        "root-s1": 1200,
        "root-s2": 900,
      });
      const user = await openForAutoplay();
      // Line 1 recited through: the move off it teaches the backend a time.
      await user.click(
        screen.getByRole("button", {
          name: "studio.live_control.controls.next →",
        }),
      );
      await user.click(
        screen.getByRole("button", {
          name: "studio.live_control.controls.next →",
        }),
      );
      await waitFor(() => expect(publishPosition).toHaveBeenCalledTimes(2));
      await act(async () => {});
      let answer: (read: Record<string, number>) => void = () => {};
      fetchSegmentPlayTimes.mockImplementation(
        () =>
          new Promise((resolve) => {
            answer = resolve;
          }),
      );

      // A line picked while the times are still being read.
      await user.click(autoButton());
      await user.click(screen.getByRole("button", { name: /root line 1/ }));
      await act(async () => answer(times));

      await waitFor(() => expect(startAutoplay).toHaveBeenCalledTimes(1));
      // Line 3 is timed now: the plan runs through it rather than stopping.
      expect(planSent().map((step) => step.durationMs)).toEqual([
        1200, 900, 700,
      ]);
    });

    /** A socket on which every command's answer is lost. */
    const loseAnswers = () => {
      const viaSocket = vi.fn<RecitationSocket["sendCommand"]>(async () => ({
        ok: false,
        lost: true,
        message: "The server did not answer in time. Try again.",
      }));
      act(() => socketStore.set({ status: "open", sendCommand: viaSocket }));
      return viaSocket;
    };

    it("follows a seek the backend made though its answer was lost, with no plan of its own", async () => {
      fetchSegmentPlayTimes.mockResolvedValue(times);
      const viaSocket = loseAnswers();
      const user = await openForAutoplay();
      await user.click(autoButton());
      await waitFor(() => expect(startAutoplay).toHaveBeenCalledTimes(1));
      fetchAutoplayState.mockClear();
      fetchAutoplayState.mockResolvedValue(
        autoplayState({ planId: "plan-1", step: 2, stepStartedAtMs: 5_000 }),
      );

      await user.click(screen.getByRole("button", { name: /root line 3/ }));

      await waitFor(() => expect(fetchAutoplayState).toHaveBeenCalledTimes(1));
      await act(async () => {});
      expect(viaSocket).toHaveBeenCalledTimes(1);
      expect(startAutoplay).toHaveBeenCalledTimes(1);
      expect(screen.getByText(/line_of line=3 total=3/)).toBeInTheDocument();
    });

    it("does not send the room's own line again once the backend shows it went out", async () => {
      fetchSegmentPlayTimes.mockResolvedValue(times);
      const viaSocket = loseAnswers();
      const user = await openForAutoplay();
      await user.click(autoButton());
      await waitFor(() => expect(startAutoplay).toHaveBeenCalledTimes(1));
      fetchAutoplayState.mockClear();
      // The same step, gone out again: only its start tells the seek landed.
      fetchAutoplayState.mockResolvedValue(
        autoplayState({ planId: "plan-1", step: 0, stepStartedAtMs: 5_000 }),
      );

      await user.click(screen.getByRole("button", { name: /root line 1/ }));

      await waitFor(() => expect(fetchAutoplayState).toHaveBeenCalledTimes(1));
      await act(async () => {});
      expect(viaSocket).toHaveBeenCalledTimes(1);
      expect(viaSocket).toHaveBeenCalledWith(
        expect.objectContaining({ type: "seek", step: 0, expectedStep: 0 }),
      );
      expect(startAutoplay).toHaveBeenCalledTimes(1);
    });

    it("keeps the running plan when a lost seek's outcome cannot be read", async () => {
      fetchSegmentPlayTimes.mockResolvedValue(times);
      const viaSocket = loseAnswers();
      const user = await openForAutoplay();
      await user.click(autoButton());
      await waitFor(() => expect(startAutoplay).toHaveBeenCalledTimes(1));

      await user.click(screen.getByRole("button", { name: /root line 3/ }));

      // Sent once more - the backend makes a seek forward only once - and then
      // left to the backend's next word, not replaced by a plan of its own.
      expect(
        await screen.findByText(/The server did not answer in time/),
      ).toBeInTheDocument();
      expect(viaSocket).toHaveBeenCalledTimes(2);
      expect(startAutoplay).toHaveBeenCalledTimes(1);
      expect(pauseButton()).toBeInTheDocument();
    });

    it("holds the room on its line, and lets it go on", async () => {
      fetchSegmentPlayTimes.mockResolvedValue(times);
      const user = await openForAutoplay();
      await user.click(autoButton());
      await waitFor(() => expect(startAutoplay).toHaveBeenCalledTimes(1));

      await user.click(
        await waitFor(() =>
          controlButton("✋ studio.live_control.controls.hold"),
        ),
      );

      await waitFor(() =>
        expect(sendAutoplayCommand).toHaveBeenCalledWith("e1", "tok-123", {
          type: "hold",
          planId: "plan-1",
        }),
      );
      const goOn = await waitFor(() =>
        controlButton("▶ studio.live_control.controls.go_on"),
      );
      expect(goOn).toHaveAttribute("aria-pressed", "true");

      await user.click(goOn);

      await waitFor(() =>
        expect(sendAutoplayCommand).toHaveBeenLastCalledWith("e1", "tok-123", {
          type: "resume",
          planId: "plan-1",
        }),
      );
      expect(
        await waitFor(() =>
          controlButton("✋ studio.live_control.controls.hold"),
        ),
      ).toBeInTheDocument();
    });

    it("holds with H from the keyboard", async () => {
      fetchSegmentPlayTimes.mockResolvedValue(times);
      const user = await openForAutoplay();
      await user.click(autoButton());
      await waitFor(() => expect(startAutoplay).toHaveBeenCalledTimes(1));
      await waitFor(() =>
        controlButton("✋ studio.live_control.controls.hold"),
      );
      // Shortcuts are the liturgy's, not a focused button's.
      (document.activeElement as HTMLElement | null)?.blur();

      await user.keyboard("h");

      await waitFor(() =>
        expect(sendAutoplayCommand).toHaveBeenCalledWith(
          "e1",
          "tok-123",
          expect.objectContaining({ type: "hold" }),
        ),
      );
    });

    it("offers no Hold while autoplay is not running", async () => {
      await openForAutoplay();
      expect(
        queryControlButton("✋ studio.live_control.controls.hold"),
      ).not.toBeInTheDocument();
    });

    it("sets the phone lead and resets the room's pace from the cue settings", async () => {
      fetchAutoplayState.mockResolvedValue(
        autoplayState({ status: "stopped", leadMs: 300, tempo: 0.8 }),
      );
      const user = await openForAutoplay();
      await user.click(controlButton("studio.live_control.cue.button"));

      const lead = await screen.findByRole("spinbutton", {
        name: /settings\.phone_lead/,
      });
      await waitFor(() => expect(lead).toHaveValue(0.3));
      expect(
        screen.getByText("studio.live_control.settings.pace_faster percent=25"),
      ).toBeInTheDocument();

      await user.click(
        screen.getByRole("button", { name: "studio.common.reset" }),
      );
      await waitFor(() =>
        expect(sendAutoplayCommand).toHaveBeenCalledWith("e1", "tok-123", {
          type: "settings",
          tempo: 1,
        }),
      );
      expect(
        await screen.findByText(
          "studio.live_control.settings.pace_as_recorded",
        ),
      ).toBeInTheDocument();

      await user.clear(lead);
      await user.type(lead, "0.45{Enter}");
      await waitFor(() =>
        expect(sendAutoplayCommand).toHaveBeenLastCalledWith("e1", "tok-123", {
          type: "settings",
          leadMs: 450,
        }),
      );
    });

    it("sends a replacement plan only after the one already out, so the newest arrives last", async () => {
      fetchSegmentPlayTimes.mockResolvedValue(times);
      let answerFirst: (
        value: Awaited<ReturnType<typeof startAutoplay>>,
      ) => void = () => {};
      startAutoplay.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            answerFirst = resolve;
          }),
      );
      startAutoplay.mockImplementationOnce(async () => ({
        ok: true,
        state: autoplayState({ planId: "plan-2", step: 0 }),
      }));
      const user = await openForAutoplay();
      await user.click(autoButton());
      await waitFor(() => expect(startAutoplay).toHaveBeenCalledTimes(1));
      await user.click(screen.getByRole("button", { name: /root line 3/ }));

      // The second plan waits: it must not pass the first on the way.
      expect(
        await screen.findByText(/line_of line=3 total=3/),
      ).toBeInTheDocument();
      expect(startAutoplay).toHaveBeenCalledTimes(1);

      await act(async () =>
        answerFirst({
          ok: true,
          state: autoplayState({ planId: "plan-1", step: 1 }),
        }),
      );
      await waitFor(() => expect(startAutoplay).toHaveBeenCalledTimes(2));
      expect(startAutoplay.mock.calls[1][4]).toBe("plan-1");

      // The first plan's word does not move the page off the plan it follows.
      expect(screen.getByText(/line_of line=3 total=3/)).toBeInTheDocument();
      hearAutoplay({ planId: "plan-1", step: 1 });
      expect(screen.getByText(/line_of line=3 total=3/)).toBeInTheDocument();
    });

    it("keeps Pause until a stop sent before the start answers is confirmed", async () => {
      fetchSegmentPlayTimes.mockResolvedValue(times);
      let answerStart: (
        value: Awaited<ReturnType<typeof startAutoplay>>,
      ) => void = () => {};
      startAutoplay.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            answerStart = resolve;
          }),
      );
      stopAutoplay.mockResolvedValueOnce({
        ok: false,
        message: "Could not reach the room.",
      });
      const user = await openForAutoplay();
      await user.click(autoButton());
      await waitFor(() => expect(startAutoplay).toHaveBeenCalledTimes(1));

      await user.click(pauseButton());
      expect(pauseButton()).toBeInTheDocument();
      expect(stopAutoplay).not.toHaveBeenCalled();

      await act(async () =>
        answerStart({
          ok: true,
          state: autoplayState({ planId: "plan-1", step: 0 }),
        }),
      );

      expect(
        await screen.findByText(/autoplay\.could_not_pause/),
      ).toBeInTheDocument();
      expect(pauseButton()).toBeInTheDocument();
      // The late start is remembered, and its later word does not resume it.
      hearAutoplay({ planId: "plan-1", step: 2 });
      expect(screen.getByText(/line_of line=1 total=3/)).toBeInTheDocument();
    });

    it("runs no time bar under the live line, by hand or under autoplay", async () => {
      fetchSegmentPlayTimes.mockResolvedValue({
        "root-s1": 60_000,
        "root-s2": 60_000,
      });
      const user = await openForAutoplay();
      await user.click(screen.getByText("root line 1"));
      expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();

      await user.click(autoButton());
      await waitFor(() => expect(startAutoplay).toHaveBeenCalledTimes(1));
      expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    });

    it("shows autoplay running on the server that it did not start, and can pause it", async () => {
      fetchAutoplayState.mockResolvedValue(
        autoplayState({ planId: "from-another-screen", step: 4 }),
      );
      const user = await openForAutoplay();

      openControls();
      expect(
        await screen.findByText(/room\.autoplay_running/),
      ).toBeInTheDocument();
      await user.click(pauseButton());

      await waitFor(() =>
        expect(stopAutoplay).toHaveBeenCalledWith("e1", "tok-123"),
      );
    });

    it("asks the backend where autoplay is while the socket is down", async () => {
      fetchSegmentPlayTimes.mockResolvedValue(times);
      const user = await openForAutoplay();
      await user.click(autoButton());
      await waitFor(() => expect(startAutoplay).toHaveBeenCalledTimes(1));
      fetchAutoplayState.mockResolvedValue(
        autoplayState({ planId: "plan-1", step: 1 }),
      );

      expect(
        await screen.findByText(/line_of line=2 total=3/, undefined, {
          timeout: 3000,
        }),
      ).toBeInTheDocument();
    });

    it("keeps the screen on while autoplay runs", async () => {
      fetchSegmentPlayTimes.mockResolvedValue(times);
      const release = vi.fn(async () => {});
      const request = vi.fn(async () => ({
        release,
        addEventListener: vi.fn(),
      }));
      Object.defineProperty(navigator, "wakeLock", {
        value: { request },
        configurable: true,
      });
      onTestFinished(() => {
        Reflect.deleteProperty(navigator, "wakeLock");
      });
      const user = await openForAutoplay();

      await user.click(autoButton());
      await waitFor(() => expect(request).toHaveBeenCalledWith("screen"));

      await user.click(pauseButton());
      await waitFor(() => expect(release).toHaveBeenCalled());
    });

    it("shows the line the room is on, and how many are following", async () => {
      socketStore.set({
        status: "open",
        room: {
          textId: "root",
          segmentId: "root-s2",
          index: 1,
          roundNumber: 1,
          revision: 5,
        },
        people: 12,
      });
      await openForAutoplay();

      const room = roomStatus();
      expect(room).toHaveTextContent(/room\.line line=2 · root line 2/);
      expect(room).toHaveTextContent(/people_following count=12/);
      // Not the line on screen, so it is marked where it sits.
      expect(
        screen.getByText("root line 2").closest("[data-line]"),
      ).toHaveAttribute("data-room-here");
    });

    it("finds the room's line when the room holds a followed edition's position", async () => {
      localStorage.setItem("recitation_emit_token", "tok-123");
      socketStore.set({
        status: "open",
        room: {
          textId: "root-en",
          segmentId: "root-en-s3",
          index: 2,
          roundNumber: 1,
          revision: 9,
        },
        people: 3,
      });
      renderPage();
      expect(await screen.findByText("root line 1")).toBeInTheDocument();

      await waitFor(() =>
        expect(roomStatus()).toHaveTextContent(
          /room\.line line=3 · root line 3/,
        ),
      );
    });

    it("takes the screen to the room's line with Live, sending nothing", async () => {
      socketStore.set({
        status: "open",
        room: {
          textId: "root",
          segmentId: "root-s2",
          index: 1,
          roundNumber: 1,
          revision: 5,
        },
        people: 1,
      });
      const user = await openForAutoplay();
      const roomLine = () =>
        screen.getByText("root line 2").closest("[data-line]");
      expect(roomLine()).toHaveAttribute("data-room-here");
      // The room's line is badged Live, and only that one.
      expect(roomLine()?.querySelector("[data-live-badge]")).not.toBeNull();
      expect(document.querySelectorAll("[data-live-badge]")).toHaveLength(1);

      await user.click(controlButton("studio.live_control.controls.live"));

      expect(screen.getByText(/line_of line=2 total=3/)).toBeInTheDocument();
      expect(roomLine()).not.toHaveAttribute("data-room-here");
      expect(publishPosition).not.toHaveBeenCalled();

      // Next goes on from the room's line, not from where the screen was.
      await user.click(
        screen.getByRole("button", {
          name: "studio.live_control.controls.next →",
        }),
      );
      await waitFor(() =>
        expect(publishPosition).toHaveBeenLastCalledWith(
          "e1",
          "tok-123",
          expect.objectContaining({ segmentId: "root-s3", index: 2 }),
          expect.any(String),
        ),
      );
    });

    it("leaves Live off until the room's line is known", async () => {
      await openForAutoplay();

      expect(controlButton("studio.live_control.controls.live")).toBeDisabled();
    });

    it("says why when the server turns the controller's socket away", async () => {
      socketStore.set({
        status: "refused",
        refusal: "Invalid or no token found",
      });
      await openForAutoplay();

      expect(roomStatus()).toHaveTextContent(
        /room\.refused reason=Invalid or no token found/,
      );
    });

    it("says moves go by HTTP while the socket is down", async () => {
      await openForAutoplay();

      expect(roomStatus()).toHaveTextContent(/room\.offline/);
    });

    describe("planned rounds", () => {
      const label = "studio.live_control.return_jumps.praises_1";
      /** A praise of two lines, whose ending carries a Return. */
      const openPraiseForAutoplay = async () => {
        const user = userEvent.setup();
        localStorage.setItem("recitation_emit_token", "tok-123");
        fetchRecitationDetails.mockImplementation(
          async (textId: string, language: string) =>
            textId !== "root"
              ? linesFor(textId, language, 3)
              : {
                  text_id: "root",
                  title: "root",
                  segments: [
                    {
                      recitation: {
                        bo: { id: "BsajlElFFNFLoHcUjICwB", content: "homage" },
                      },
                    },
                    {
                      recitation: {
                        bo: { id: "kYNR7EmC5apQWrkYl5fiO", content: "mantra" },
                      },
                    },
                  ],
                },
        );
        fetchSegmentPlayTimes.mockResolvedValue({
          BsajlElFFNFLoHcUjICwB: 20,
          kYNR7EmC5apQWrkYl5fiO: 20,
        });
        renderPage();
        expect(await screen.findByText("homage")).toBeInTheDocument();
        await followNone(user);
        publishPosition.mockClear();
        return user;
      };
      const planOf = () =>
        screen.getByRole("group", {
          name: `studio.live_control.return_plan.aria label=${label}`,
        });

      /** Rounds planned before the page opens, as a reload mid-puja finds them. */
      const savePlannedRounds = (rounds: number) =>
        localStorage.setItem(
          "live-control-planned-rounds:e1",
          JSON.stringify({ "1-85": rounds }),
        );
      const startAuto = async (
        user: ReturnType<typeof userEvent.setup>,
        times = 1,
      ) => {
        await user.click(controlButton("▶ studio.live_control.controls.auto"));
        await waitFor(() => expect(startAutoplay).toHaveBeenCalledTimes(times));
      };
      const queryPlan = () =>
        screen.queryByRole("group", {
          name: `studio.live_control.return_plan.aria label=${label}`,
        });

      it("offers the rounds only while autoplay runs", async () => {
        const user = await openPraiseForAutoplay();
        expect(queryPlan()).not.toBeInTheDocument();

        await startAuto(user);
        expect(planOf()).toBeInTheDocument();

        await user.click(
          controlButton("❚❚ studio.live_control.controls.pause"),
        );
        await waitFor(() => expect(queryPlan()).not.toBeInTheDocument());
      });

      it("sets the rounds from 1, without taking the return", async () => {
        const user = await openPraiseForAutoplay();
        await startAuto(user);
        const more = () =>
          within(planOf()).getByRole("button", {
            name: "studio.live_control.return_plan.more",
          });
        const fewer = () =>
          within(planOf()).getByRole("button", {
            name: "studio.live_control.return_plan.fewer",
          });

        // Counted as the Return's badge counts: once through is round 1.
        expect(
          planOf().querySelector("[data-planned-rounds]"),
        ).toHaveTextContent("1");
        expect(fewer()).toBeDisabled();
        expect(planOf().querySelector("[data-returns-left]")).toBeNull();

        await user.click(more());
        await user.click(more());

        expect(
          planOf().querySelector("[data-planned-rounds]"),
        ).toHaveTextContent("3");
        expect(planOf().querySelector("[data-returns-left]")).toHaveTextContent(
          "studio.live_control.return_plan.returns_left_other count=2",
        );
        // Nothing went to the room, and the round did not move.
        expect(publishPosition).not.toHaveBeenCalled();
        expect(
          screen.getByRole("button", {
            name: `studio.live_control.return.aria label=${label} round=1`,
          }),
        ).toBeInTheDocument();
        // Kept for a reload mid-puja.
        expect(
          JSON.parse(
            localStorage.getItem("live-control-planned-rounds:e1") ?? "{}",
          ),
        ).toEqual({ "1-85": 3 });

        await user.click(fewer());
        await user.click(fewer());
        expect(planOf().querySelector("[data-returns-left]")).toBeNull();
        expect(fewer()).toBeDisabled();
        expect(localStorage.getItem("live-control-planned-rounds:e1")).toBe(
          "{}",
        );
      });

      it("carries a saved return count over as one more round", async () => {
        localStorage.setItem(
          "live-control-planned-returns:e1",
          JSON.stringify({ "1-85": 2 }),
        );
        const user = await openPraiseForAutoplay();
        await startAuto(user);

        expect(
          planOf().querySelector("[data-planned-rounds]"),
        ).toHaveTextContent("3");
        expect(planOf().querySelector("[data-returns-left]")).toHaveTextContent(
          "studio.live_control.return_plan.returns_left_other count=2",
        );
        expect(
          JSON.parse(
            localStorage.getItem("live-control-planned-rounds:e1") ?? "{}",
          ),
        ).toEqual({ "1-85": 3 });
        expect(localStorage.getItem("live-control-planned-returns:e1")).toBe(
          null,
        );
      });

      it("lays every planned round out in the plan, the Return taken each time", async () => {
        savePlannedRounds(3);
        const user = await openPraiseForAutoplay();

        await startAuto(user);

        // Three rounds of the praise, then the end of the text.
        expect(
          startAutoplay.mock.calls[0][2].map((step) => [
            step.positions[0].segmentId,
            step.positions[0].roundNumber,
          ]),
        ).toEqual([
          ["BsajlElFFNFLoHcUjICwB", 1],
          ["kYNR7EmC5apQWrkYl5fiO", 1],
          ["BsajlElFFNFLoHcUjICwB", 2],
          ["kYNR7EmC5apQWrkYl5fiO", 2],
          ["BsajlElFFNFLoHcUjICwB", 3],
          ["kYNR7EmC5apQWrkYl5fiO", 3],
        ]);
      });

      it("moves the round badge as the backend takes the room into each round", async () => {
        savePlannedRounds(2);
        const user = await openPraiseForAutoplay();
        await startAuto(user);

        // Step 2 is the praise's start again, in round 2.
        hearAutoplay({ planId: "plan-1", step: 2, totalSteps: 4 });

        expect(
          await screen.findByRole("button", {
            name: `studio.live_control.return.aria label=${label} round=2`,
          }),
        ).toBeInTheDocument();
        expect(planOf().querySelector("[data-returns-left]")).toHaveTextContent(
          "studio.live_control.return_plan.done",
        );
      });

      it("rebuilds the plan when the rounds change mid-line, without sending the line again", async () => {
        const user = await openPraiseForAutoplay();
        await startAuto(user);
        expect(startAutoplay.mock.calls[0][2]).toHaveLength(2);

        await user.click(
          within(planOf()).getByRole("button", {
            name: "studio.live_control.return_plan.more",
          }),
        );

        await waitFor(() => expect(startAutoplay).toHaveBeenCalledTimes(2));
        const [, , steps, keepFirst] = startAutoplay.mock.calls[1];
        // The line on screen keeps what is left of its time.
        expect(typeof keepFirst).toBe("number");
        expect(steps.map((step) => step.positions[0].roundNumber)).toEqual([
          1, 1, 2, 2,
        ]);
        expect(publishPosition).not.toHaveBeenCalled();
      });

      it("counts rounds begun by hand toward the plan", async () => {
        savePlannedRounds(2);
        const user = await openPraiseForAutoplay();
        await user.click(
          await screen.findByRole("button", {
            name: `studio.live_control.return.aria label=${label} round=1`,
          }),
        );

        expect(
          await screen.findByRole("button", {
            name: `studio.live_control.return.aria label=${label} round=2`,
          }),
        ).toBeInTheDocument();
        await startAuto(user);
        expect(planOf().querySelector("[data-returns-left]")).toHaveTextContent(
          "studio.live_control.return_plan.done",
        );
      });
      it("tells the backend a Return from the passage end follows on from it", async () => {
        const user = await openPraiseForAutoplay();
        await user.click(screen.getByRole("button", { name: /homage/ }));
        await user.click(
          screen.getByRole("button", {
            name: "studio.live_control.controls.next →",
          }),
        );
        await waitFor(() => expect(publishPosition).toHaveBeenCalledTimes(2));

        await user.click(
          screen.getByRole("button", {
            name: `studio.live_control.return.aria label=${label} round=1`,
          }),
        );

        // Back to line 1 in round 2, having recited line 2 through: line 2 is
        // the one the room's last move was on, so its hold is its play time.
        await waitFor(() =>
          expect(publishPosition).toHaveBeenLastCalledWith(
            "e1",
            "tok-123",
            {
              textId: "root",
              segmentId: "BsajlElFFNFLoHcUjICwB",
              index: 0,
              roundNumber: 2,
              elapsedMs: expect.any(Number),
              fromIndex: 1,
            },
            expect.any(String),
          ),
        );
      });
    });

    it("tells the backend Next over yigchung follows on, and a jump does not", async () => {
      fetchEditionYigchungs.mockImplementation(async (textId: string) =>
        textId === "root"
          ? {
              "root-s2": {
                full: true,
                ranges: [{ start: 0, end: 11 }],
                length: 11,
              },
            }
          : {},
      );
      const user = await openForAutoplay();
      await user.click(screen.getByRole("button", { name: /root line 1/ }));
      await waitFor(() => expect(publishPosition).toHaveBeenCalledTimes(1));

      // Line 2 is instruction: Next lands on line 3, the next line recited.
      await user.click(
        screen.getByRole("button", {
          name: "studio.live_control.controls.next →",
        }),
      );
      await waitFor(() =>
        expect(publishPosition).toHaveBeenLastCalledWith(
          "e1",
          "tok-123",
          expect.objectContaining({
            segmentId: "root-s3",
            index: 2,
            fromIndex: 0,
          }),
          expect.any(String),
        ),
      );

      // Back up to line 1 by tapping it: nothing was recited through.
      await user.click(screen.getByRole("button", { name: /root line 1/ }));
      await waitFor(() => expect(publishPosition).toHaveBeenCalledTimes(3));
      expect(publishPosition.mock.calls[2][2]).not.toHaveProperty("fromIndex");
    });

    it("reads the times again once the room takes a timed move by hand", async () => {
      fetchSegmentPlayTimes.mockResolvedValue({ "root-s1": 4200 });
      const user = await openForAutoplay();
      const first = screen.getByText("root line 1").closest("[data-line]");
      await waitFor(() =>
        expect(first?.querySelector("[data-play-time]")?.textContent).toBe(
          "4.2s",
        ),
      );
      fetchSegmentPlayTimes.mockClear();
      fetchSegmentPlayTimes.mockResolvedValue({ "root-s1": 3100 });

      // The first move onto the text carries no time, so teaches nothing.
      await user.click(
        screen.getByRole("button", {
          name: "studio.live_control.controls.next →",
        }),
      );
      await waitFor(() => expect(publishPosition).toHaveBeenCalledTimes(1));
      await new Promise((resolve) => setTimeout(resolve, 1700));
      expect(fetchSegmentPlayTimes).not.toHaveBeenCalled();

      // The second reports how long line 1 was held: its new time shows.
      await user.click(
        screen.getByRole("button", {
          name: "studio.live_control.controls.next →",
        }),
      );
      await waitFor(
        () =>
          expect(first?.querySelector("[data-play-time]")?.textContent).toBe(
            "3.1s",
          ),
        { timeout: 3000 },
      );
      expect(fetchSegmentPlayTimes).toHaveBeenCalledTimes(1);
      expect(fetchSegmentPlayTimes).toHaveBeenCalledWith("root");
    });

    it("cannot be started without the emit token", async () => {
      renderPage();
      expect(await screen.findByText("root line 1")).toBeInTheDocument();

      expect(
        controlButton("▶ studio.live_control.controls.auto"),
      ).toBeDisabled();
      // The times are public, so they still load and show on the lines.
      await waitFor(() =>
        expect(fetchSegmentPlayTimes).toHaveBeenCalledWith("root"),
      );
    });
  });
});
