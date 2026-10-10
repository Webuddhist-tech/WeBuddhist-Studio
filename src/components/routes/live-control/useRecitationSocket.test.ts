import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  MOVE_ACK_TIMEOUT_MS,
  useRecitationSocket,
} from "./useRecitationSocket";

/** Stands in for the browser's WebSocket, and lets a test play the server. */
class FakeSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;
  static made: FakeSocket[] = [];

  readyState = FakeSocket.CONNECTING;
  sent: Record<string, unknown>[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((message: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;

  url: string;

  constructor(url: string) {
    this.url = url;
    FakeSocket.made.push(this);
  }

  send(data: string) {
    this.sent.push(JSON.parse(data));
  }

  close() {
    this.readyState = FakeSocket.CLOSED;
    this.onclose?.();
  }

  // What the server does:
  open() {
    this.readyState = FakeSocket.OPEN;
    this.onopen?.();
  }

  /** Opens, and says hello as the server does once the token is taken. */
  accept(count = 0) {
    this.open();
    this.say({ type: "session_info", is_operator: true, count });
  }

  say(frame: Record<string, unknown>) {
    this.onmessage?.({ data: JSON.stringify(frame) });
  }

  drop() {
    this.readyState = FakeSocket.CLOSED;
    this.onclose?.();
  }
}

const latest = () => FakeSocket.made[FakeSocket.made.length - 1];

const move = [
  {
    position: { textId: "en", segmentId: "en-2", index: 1, roundNumber: 1 },
    run: "r-en",
  },
  {
    position: { textId: "bo", segmentId: "bo-2", index: 1, roundNumber: 1 },
    run: "r-bo",
  },
];

describe("useRecitationSocket", () => {
  beforeEach(() => {
    FakeSocket.made = [];
    vi.stubGlobal("WebSocket", FakeSocket);
    vi.stubEnv("VITE_BACKEND_BASE_URL", "https://api.example.org");
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("opens the event's socket with the emit token", () => {
    const { result } = renderHook(() => useRecitationSocket("e1", "tok"));

    expect(latest().url).toBe(
      "wss://api.example.org/api/v1/events/e1/recitation/live?token=tok",
    );
    expect(result.current.status).toBe("connecting");
    // Open, but not yet let in: the server checks the token first.
    act(() => latest().open());
    expect(result.current.status).toBe("connecting");
    expect(result.current.sendMove(move)).toBeNull();
    act(() =>
      latest().say({ type: "session_info", is_operator: true, count: 0 }),
    );
    expect(result.current.status).toBe("open");
  });

  it("says why the server turned it away, and asks again only now and then", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useRecitationSocket("e1", "tok"));

    act(() => {
      latest().open();
      latest().say({
        type: "error",
        code: "UNAUTHORIZED",
        message: "Invalid or no token found",
      });
      latest().drop();
    });

    expect(result.current.status).toBe("refused");
    expect(result.current.refusal).toBe("Invalid or no token found");
    expect(result.current.sendMove(move)).toBeNull();
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(FakeSocket.made).toHaveLength(1);
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(FakeSocket.made).toHaveLength(2);

    // Taken this time - the server was redeployed, say.
    act(() => latest().accept());
    expect(result.current.status).toBe("open");
    expect(result.current.refusal).toBeNull();
  });

  it("opens nothing without a token", () => {
    const { result } = renderHook(() => useRecitationSocket("e1", null));

    expect(FakeSocket.made).toHaveLength(0);
    expect(result.current.status).toBe("idle");
    expect(result.current.sendMove(move)).toBeNull();
  });

  it("follows the room's position, never backwards", () => {
    const { result } = renderHook(() => useRecitationSocket("e1", "tok"));
    act(() => latest().accept());

    act(() =>
      latest().say({
        type: "position",
        text_id: "bo",
        segment_id: "bo-5",
        index: 4,
        round_number: 2,
        revision: 10,
      }),
    );
    expect(result.current.room).toEqual({
      textId: "bo",
      segmentId: "bo-5",
      index: 4,
      roundNumber: 2,
      revision: 10,
    });

    // An older frame - a reconnect's snapshot, say - is not taken.
    act(() =>
      latest().say({
        type: "position",
        text_id: "bo",
        segment_id: "bo-1",
        revision: 7,
      }),
    );
    expect(result.current.room?.segmentId).toBe("bo-5");

    act(() => latest().say({ type: "session_ended" }));
    expect(result.current.room).toBeNull();
  });

  it("hears how many follow, and where autoplay is", () => {
    const { result } = renderHook(() => useRecitationSocket("e1", "tok"));
    act(() => latest().accept());

    act(() =>
      latest().say({ type: "session_info", is_operator: true, count: 3 }),
    );
    act(() => latest().say({ type: "presence", count: 5 }));
    act(() =>
      latest().say({
        type: "autoplay",
        plan_id: "p1",
        status: "running",
        step: 4,
        total_steps: 9,
        step_started_at_ms: 100,
        step_duration_ms: 900,
        server_time_ms: 150,
      }),
    );

    expect(result.current.people).toBe(5);
    expect(result.current.autoplay).toMatchObject({ planId: "p1", step: 4 });
  });

  it("sends a move and resolves once the room has taken it", async () => {
    const { result } = renderHook(() => useRecitationSocket("e1", "tok"));
    act(() => latest().accept());

    const answer = result.current.sendMove(move);
    const sent = latest().sent[0];
    expect(sent).toMatchObject({
      type: "move",
      positions: [
        { text_id: "en", segment_id: "en-2", run: "r-en" },
        { text_id: "bo", segment_id: "bo-2", run: "r-bo" },
      ],
    });
    act(() =>
      latest().say({
        type: "move_ack",
        move_id: sent.move_id,
        ok: true,
        revisions: [1, 2],
      }),
    );

    await expect(answer).resolves.toEqual({ ok: true });
  });

  it("tells a refused move from a lost one", async () => {
    const { result } = renderHook(() => useRecitationSocket("e1", "tok"));
    act(() => latest().accept());

    const refused = result.current.sendMove(move);
    act(() =>
      latest().say({
        type: "move_ack",
        move_id: latest().sent[0].move_id,
        ok: false,
        code: "THROTTLED",
      }),
    );
    const lost = result.current.sendMove(move);
    act(() => latest().drop());

    await expect(refused).resolves.toEqual({
      ok: false,
      message: "studio.live_control.errors.positions_throttled",
    });
    await expect(lost).resolves.toMatchObject({ ok: false, lost: true });
  });

  it("gives a move up as lost when the room does not answer in time", async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useRecitationSocket("e1", "tok"));
    act(() => latest().accept());

    const answer = result.current.sendMove(move);
    act(() => {
      vi.advanceTimersByTime(MOVE_ACK_TIMEOUT_MS + 1);
    });

    await expect(answer).resolves.toMatchObject({ ok: false, lost: true });
  });

  it("sends an autoplay command and resolves with the backend's new state", async () => {
    const { result } = renderHook(() => useRecitationSocket("e1", "tok"));
    act(() => latest().accept());

    const answer = result.current.sendCommand({
      type: "seek",
      planId: "p1",
      step: 4,
      expectedStep: 3,
    });
    const sent = latest().sent[0];
    expect(sent).toMatchObject({
      type: "autoplay_seek",
      plan_id: "p1",
      step: 4,
      expected_step: 3,
    });
    act(() =>
      latest().say({
        type: "autoplay_ack",
        command_id: sent.command_id,
        command: "seek",
        ok: true,
        state: {
          type: "autoplay",
          plan_id: "p1",
          status: "running",
          step: 4,
          total_steps: 9,
          server_time_ms: 1,
        },
      }),
    );

    await expect(answer).resolves.toMatchObject({
      ok: true,
      state: { planId: "p1", step: 4 },
    });
    // What the command answered is where autoplay is now.
    expect(result.current.autoplay).toMatchObject({ step: 4 });
  });

  it("says why an autoplay command was turned down", async () => {
    const { result } = renderHook(() => useRecitationSocket("e1", "tok"));
    act(() => latest().accept());

    const answer = result.current.sendCommand({ type: "hold" });
    act(() =>
      latest().say({
        type: "autoplay_ack",
        command_id: latest().sent[0].command_id,
        ok: false,
        code: "NOT_RUNNING",
      }),
    );

    await expect(answer).resolves.toEqual({
      ok: false,
      message: "studio.live_control.errors.autoplay_not_running",
    });
  });

  it("gives an autoplay command up when the socket goes", async () => {
    const { result } = renderHook(() => useRecitationSocket("e1", "tok"));
    act(() => latest().accept());

    const answer = result.current.sendCommand({ type: "resume" });
    act(() => latest().drop());

    await expect(answer).resolves.toMatchObject({ ok: false, lost: true });
  });

  it("gives an autoplay command up as lost when the server does not answer in time", async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useRecitationSocket("e1", "tok"));
    act(() => latest().accept());

    const answer = result.current.sendCommand({
      type: "seek",
      planId: "p1",
      step: 2,
      expectedStep: 1,
    });
    act(() => {
      vi.advanceTimersByTime(MOVE_ACK_TIMEOUT_MS + 1);
    });

    // It may still have been carried out: not the same as one turned down.
    await expect(answer).resolves.toMatchObject({ ok: false, lost: true });
  });

  it("does not send a command over a socket that is not open", () => {
    const { result } = renderHook(() => useRecitationSocket("e1", "tok"));

    expect(result.current.sendCommand({ type: "hold" })).toBeNull();
  });

  it("does not send over a socket that is not open", () => {
    const { result } = renderHook(() => useRecitationSocket("e1", "tok"));

    expect(result.current.sendMove(move)).toBeNull();
  });

  it("reconnects by itself, waiting longer each time", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useRecitationSocket("e1", "tok"));
    act(() => latest().drop());
    expect(result.current.status).toBe("closed");

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(FakeSocket.made).toHaveLength(2);
    act(() => latest().drop());
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(FakeSocket.made).toHaveLength(2);
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(FakeSocket.made).toHaveLength(3);

    act(() => latest().accept());
    expect(result.current.status).toBe("open");
  });

  it("keeps a quiet socket alive with pings", () => {
    vi.useFakeTimers();
    renderHook(() => useRecitationSocket("e1", "tok"));
    act(() => latest().accept());

    act(() => {
      vi.advanceTimersByTime(25_000);
    });

    expect(latest().sent).toContainEqual({ type: "ping" });
  });

  it("closes for good when the page goes, without reconnecting", () => {
    vi.useFakeTimers();
    const { unmount } = renderHook(() => useRecitationSocket("e1", "tok"));
    act(() => latest().accept());
    const socket = latest();

    unmount();
    act(() => {
      vi.advanceTimersByTime(30_000);
    });

    expect(socket.readyState).toBe(FakeSocket.CLOSED);
    expect(FakeSocket.made).toHaveLength(1);
  });
});
