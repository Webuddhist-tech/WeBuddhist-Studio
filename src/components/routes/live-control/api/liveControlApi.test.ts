import { beforeEach, describe, expect, it, vi } from "vitest";
import axiosInstance from "@/config/axios-config";
import {
  fetchAutoplayState,
  fetchLiturgies,
  fetchLiveControlEvent,
  fetchRecitationDetails,
  fetchTextEditions,
  publishMove,
  publishPosition,
  recitationSocketUrl,
  sendAutoplayCommand,
  startAutoplay,
  stopAutoplay,
  toAutoplayState,
  toOperatorSegments,
  type RecitationSegmentRow,
} from "./liveControlApi";

vi.mock("@/config/axios-config", () => ({
  default: { post: vi.fn(), get: vi.fn() },
}));

const { emitPost, emitGet } = vi.hoisted(() => ({
  emitPost: vi.fn(),
  emitGet: vi.fn(),
}));

vi.mock("axios", async (importOriginal) => {
  const actual = await importOriginal<typeof import("axios")>();
  return {
    ...actual,
    default: {
      ...actual.default,
      create: vi.fn(() => ({ post: emitPost, get: emitGet })),
    },
  };
});

describe("publishPosition", () => {
  const position = { textId: "t1", segmentId: "s1", index: 3, roundNumber: 2 };

  beforeEach(() => {
    emitPost.mockReset();
    emitPost.mockResolvedValue({ status: 202 });
  });

  it("posts the run the text is in", async () => {
    await publishPosition("e1", "tok", position, "run-1");

    expect(emitPost).toHaveBeenCalledWith(
      "/api/v1/events/e1/recitation/position",
      {
        text_id: "t1",
        segment_id: "s1",
        index: 3,
        round_number: 2,
        run: "run-1",
      },
      { headers: { "X-Recitation-Token": "tok" } },
    );
  });

  it("leaves the run out when there is none", async () => {
    await publishPosition("e1", "tok", position);

    expect(emitPost.mock.calls[0][1]).not.toHaveProperty("run");
  });

  it("sends the line a move follows on from, only when there is one", async () => {
    await publishPosition("e1", "tok", { ...position, fromIndex: 1 });
    await publishPosition("e1", "tok", position);

    expect(emitPost.mock.calls[0][1]).toMatchObject({ from_index: 1 });
    expect(emitPost.mock.calls[1][1]).not.toHaveProperty("from_index");
  });
});

const auth = { headers: { "X-Recitation-Token": "tok" } };
const wireState = {
  type: "autoplay",
  event_id: "e1",
  plan_id: "p1",
  status: "running",
  reason: null,
  step: 2,
  total_steps: 9,
  step_started_at_ms: 5_000,
  step_duration_ms: 1_200,
  server_time_ms: 5_400,
};
const httpError = (status: number) =>
  Object.assign(new Error(`HTTP ${status}`), {
    isAxiosError: true,
    response: { status },
  });

describe("publishMove", () => {
  beforeEach(() => {
    emitPost.mockReset();
    emitPost.mockResolvedValue({ status: 202 });
  });

  it("sends every edition of the move in one request, in the order given", async () => {
    const result = await publishMove("e1", "tok", [
      {
        position: { textId: "en", segmentId: "en-3", index: 2, roundNumber: 1 },
        run: "run-en",
      },
      {
        position: {
          textId: "bo",
          segmentId: "bo-3",
          index: 2,
          roundNumber: 1,
          elapsedMs: 900,
          fromIndex: 1,
        },
        run: "run-bo",
      },
    ]);

    expect(result).toEqual({ ok: true });
    expect(emitPost).toHaveBeenCalledTimes(1);
    expect(emitPost).toHaveBeenCalledWith(
      "/api/v1/events/e1/recitation/move",
      {
        positions: [
          {
            text_id: "en",
            segment_id: "en-3",
            index: 2,
            round_number: 1,
            run: "run-en",
          },
          {
            text_id: "bo",
            segment_id: "bo-3",
            index: 2,
            round_number: 1,
            run: "run-bo",
            elapsed_ms: 900,
            from_index: 1,
          },
        ],
      },
      auth,
    );
  });

  it("says what went wrong in words the operator can act on", async () => {
    emitPost.mockRejectedValueOnce(httpError(429));
    const throttled = await publishMove("e1", "tok", [
      { position: { textId: "bo", segmentId: "s", index: 0, roundNumber: 1 } },
    ]);
    emitPost.mockRejectedValueOnce(httpError(401));
    const refused = await publishMove("e1", "tok", [
      { position: { textId: "bo", segmentId: "s", index: 0, roundNumber: 1 } },
    ]);

    expect(throttled).toEqual({
      ok: false,
      message: "studio.live_control.errors.positions_throttled",
    });
    expect(refused).toEqual({
      ok: false,
      message: "studio.live_control.errors.token_rejected",
    });
  });
});

describe("autoplay", () => {
  beforeEach(() => {
    emitPost.mockReset();
    emitGet.mockReset();
  });

  it("hands the plan over, each step with its positions and hold", async () => {
    emitPost.mockResolvedValue({ data: wireState });

    const result = await startAutoplay("e1", "tok", [
      {
        positions: [
          { textId: "bo", segmentId: "bo-1", index: 0, roundNumber: 1 },
        ],
        durationMs: 1_500,
      },
    ]);

    expect(emitPost).toHaveBeenCalledWith(
      "/api/v1/events/e1/recitation/autoplay",
      {
        steps: [
          {
            positions: [
              { text_id: "bo", segment_id: "bo-1", index: 0, round_number: 1 },
            ],
            duration_ms: 1_500,
          },
        ],
      },
      auth,
    );
    expect(result).toEqual({
      ok: true,
      state: {
        planId: "p1",
        status: "running",
        reason: null,
        step: 2,
        totalSteps: 9,
        stepStartedAtMs: 5_000,
        stepDurationMs: 1_200,
        // A backend that does not report them yet reads as plain autoplay.
        held: false,
        heldAtMs: null,
        tempo: 1,
        leadMs: 0,
        serverTimeMs: 5_400,
      },
    });
  });

  it("reads the hold, the room's pace and the phone lead", () => {
    expect(
      toAutoplayState({
        ...wireState,
        held: true,
        held_at_ms: 5_200,
        tempo: 0.9,
        lead_ms: 300,
      }),
    ).toMatchObject({ held: true, heldAtMs: 5_200, tempo: 0.9, leadMs: 300 });
  });

  it("sends a command to the running plan, each in the backend's own words", async () => {
    emitPost.mockResolvedValue({ data: wireState });

    const result = await sendAutoplayCommand("e1", "tok", {
      type: "seek",
      planId: "p1",
      step: 3,
      expectedStep: 2,
    });
    await sendAutoplayCommand("e1", "tok", { type: "hold", planId: "p1" });
    await sendAutoplayCommand("e1", "tok", { type: "resume" });
    await sendAutoplayCommand("e1", "tok", { type: "settings", leadMs: 450 });

    expect(result).toMatchObject({ ok: true, state: { planId: "p1" } });
    expect(emitPost.mock.calls.map(([url, body]) => [url, body])).toEqual([
      [
        "/api/v1/events/e1/recitation/autoplay/seek",
        { plan_id: "p1", step: 3, expected_step: 2 },
      ],
      ["/api/v1/events/e1/recitation/autoplay/hold", { plan_id: "p1" }],
      ["/api/v1/events/e1/recitation/autoplay/resume", {}],
      ["/api/v1/events/e1/recitation/autoplay/settings", { lead_ms: 450 }],
    ]);
    expect(emitPost.mock.calls[0][2]).toEqual(auth);
  });

  it("says why a command was turned down", async () => {
    emitPost.mockRejectedValueOnce(httpError(409));
    emitPost.mockRejectedValueOnce(httpError(429));

    const gone = await sendAutoplayCommand("e1", "tok", { type: "hold" });
    const fast = await sendAutoplayCommand("e1", "tok", {
      type: "seek",
      planId: "p1",
      step: 1,
    });

    expect(gone).toEqual({
      ok: false,
      message: "studio.live_control.errors.autoplay_not_running",
    });
    expect(fast).toMatchObject({
      ok: false,
      message: "studio.live_control.errors.lines_throttled",
    });
  });

  it("says how long the first line has been showing when it is not to be sent again", async () => {
    emitPost.mockResolvedValue({ data: wireState });

    await startAutoplay(
      "e1",
      "tok",
      [
        {
          positions: [
            { textId: "bo", segmentId: "b", index: 0, roundNumber: 1 },
          ],
          durationMs: 900,
        },
      ],
      750,
    );

    expect(emitPost.mock.calls[0][1]).toMatchObject({
      first_step_elapsed_ms: 750,
    });
  });

  it("reports a start the server could not run", async () => {
    emitPost.mockRejectedValue(httpError(503));

    const result = await startAutoplay("e1", "tok", []);

    expect(result).toEqual({
      ok: false,
      message: "studio.live_control.errors.autoplay_unavailable",
    });
    expect(emitGet).not.toHaveBeenCalled();
  });

  it("takes a plan the server is already running when the answer is late", async () => {
    vi.useFakeTimers();
    try {
      emitPost.mockReturnValue(new Promise(() => {}));
      emitGet.mockResolvedValue({
        data: { ...wireState, plan_id: "new-plan" },
      });

      const pending = startAutoplay("e1", "tok", [], undefined, "old-plan");
      await vi.advanceTimersByTimeAsync(15_000);

      await expect(pending).resolves.toMatchObject({
        ok: true,
        state: { planId: "new-plan", status: "running" },
      });
      expect(emitGet).toHaveBeenCalledWith(
        "/api/v1/events/e1/recitation/autoplay",
        auth,
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it("waits out a start that has not replaced the plan already running", async () => {
    vi.useFakeTimers();
    try {
      let finish: (value: { data: typeof wireState }) => void = () => {};
      emitPost.mockReturnValue(
        new Promise((resolve) => {
          finish = resolve;
        }),
      );
      emitGet.mockResolvedValue({
        data: { ...wireState, status: "stopped", reason: "stopped" },
      });

      const pending = startAutoplay("e1", "tok", [], undefined, "p1");
      const seen = vi.fn();
      void pending.then(seen);
      await vi.advanceTimersByTimeAsync(15_000);
      expect(seen).not.toHaveBeenCalled();

      finish({ data: { ...wireState, plan_id: "new-plan" } });

      await expect(pending).resolves.toMatchObject({
        ok: true,
        state: { planId: "new-plan" },
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("stops, and reads where it is", async () => {
    emitPost.mockResolvedValue({
      data: { ...wireState, status: "stopped", reason: "stopped" },
    });
    emitGet.mockResolvedValue({ data: wireState });

    const stopped = await stopAutoplay("e1", "tok");
    const read = await fetchAutoplayState("e1", "tok");

    expect(emitPost).toHaveBeenCalledWith(
      "/api/v1/events/e1/recitation/autoplay/stop",
      {},
      auth,
    );
    expect(stopped).toMatchObject({
      ok: true,
      state: { status: "stopped", reason: "stopped" },
    });
    expect(emitGet).toHaveBeenCalledWith(
      "/api/v1/events/e1/recitation/autoplay",
      auth,
    );
    expect(read?.step).toBe(2);
  });

  it("reads nothing when the server cannot be asked", async () => {
    emitGet.mockRejectedValue(httpError(503));

    expect(await fetchAutoplayState("e1", "tok")).toBeNull();
  });

  it("takes only autoplay frames as state", () => {
    expect(toAutoplayState({ type: "position", status: "live" })).toBeNull();
    expect(toAutoplayState(null)).toBeNull();
    expect(toAutoplayState(wireState)?.planId).toBe("p1");
  });
});

describe("recitationSocketUrl", () => {
  it("opens the event's live socket on the backend, with the token", () => {
    vi.stubEnv("VITE_BACKEND_BASE_URL", "https://api.example.org");
    try {
      expect(recitationSocketUrl("e/1", "a b")).toBe(
        "wss://api.example.org/api/v1/events/e%2F1/recitation/live?token=a+b",
      );
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("uses a plain socket for a plain-HTTP backend, keeping any path it sits under", () => {
    vi.stubEnv("VITE_BACKEND_BASE_URL", "http://localhost:8000/backend/");
    try {
      expect(recitationSocketUrl("e1", "tok")).toBe(
        "ws://localhost:8000/backend/api/v1/events/e1/recitation/live?token=tok",
      );
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("goes to this origin's root, not the page's path, when the build names no backend", () => {
    vi.stubEnv("VITE_BACKEND_BASE_URL", "");
    window.history.pushState({}, "", "/live-control/e1");
    try {
      expect(recitationSocketUrl("e1", "tok")).toBe(
        `ws://${window.location.host}/api/v1/events/e1/recitation/live?token=tok`,
      );
    } finally {
      window.history.pushState({}, "", "/");
      vi.unstubAllEnvs();
    }
  });
});

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
      { id: "seg-en-1", content: "Line 1", row: 0 },
      // Falls back to the only recitation the row carries.
      { id: "seg-bo-2", content: "བོད་ ༢", row: 1 },
    ]);
  });

  it("normalizes the language before matching", () => {
    expect(toOperatorSegments(details, " BO ")[0].id).toBe("seg-bo-1");
  });

  it("returns nothing for a text with no segments", () => {
    expect(toOperatorSegments({ segments: [] }, "bo")).toEqual([]);
  });

  it("keeps the row a line came from, past one that was dropped", () => {
    // The third row carries no recitation, so the fourth is the third line.
    const withGap: { segments: RecitationSegmentRow[] } = {
      segments: [
        ...details.segments,
        { recitation: { bo: { id: "seg-bo-4", content: "བོད་ ༤" } } },
      ],
    };

    expect(toOperatorSegments(withGap, "bo").map((line) => line.row)).toEqual([
      0, 1, 3,
    ]);
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
      title: "studio.live_control.untitled_event",
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

  it("keeps the edition id the text was opened by", async () => {
    // The library answers an edition id with its own internal id for the work.
    vi.mocked(axiosInstance.get).mockResolvedValue({
      data: {
        text: { id: "internal-root", title: "Praise", language: "bo" },
        versions: [
          { id: "internal-root", title: "Praise", language: "bo" },
          { id: "root-en", title: "Praise (en)", language: "en" },
        ],
      },
    });

    const { text, editions } = await fetchTextEditions("edition-root");

    expect(text.textId).toBe("edition-root");
    expect(editions.map((edition) => edition.textId)).toEqual(["root-en"]);
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
