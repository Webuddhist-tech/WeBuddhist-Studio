import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useRecitationSocket } from "./useRecitationSocket";

class FakeSocket {
  static instances: FakeSocket[] = [];

  static OPEN = 1;

  url: string;
  readyState = 0;
  sent: string[] = [];
  closed = false;
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;

  constructor(url: string) {
    this.url = url;
    FakeSocket.instances.push(this);
  }

  send(payload: string) {
    this.sent.push(payload);
  }

  close() {
    this.closed = true;
    this.readyState = 3;
    this.onclose?.();
  }

  /** Test helper: the server accepting the socket. */
  open() {
    this.readyState = FakeSocket.OPEN;
    this.onopen?.();
  }

  /** Test helper: a frame arriving from the server. */
  emit(frame: unknown) {
    this.onmessage?.({ data: JSON.stringify(frame) });
  }
}

const lastSocket = () => FakeSocket.instances[FakeSocket.instances.length - 1];

const connectAsOperator = (hook: {
  current: ReturnType<typeof useRecitationSocket>;
}) => {
  act(() => hook.current.connect());
  act(() => lastSocket().open());
  act(() => lastSocket().emit({ type: "session_info", is_operator: true }));
};

describe("useRecitationSocket", () => {
  beforeEach(() => {
    FakeSocket.instances = [];
    vi.stubGlobal("WebSocket", FakeSocket);
    sessionStorage.setItem("accessToken", "tok");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    sessionStorage.clear();
    vi.useRealTimers();
  });

  it("opens the event's socket with the session token", () => {
    const { result } = renderHook(() => useRecitationSocket("event-1"));

    act(() => result.current.connect());

    expect(lastSocket().url).toContain(
      "/api/v1/events/event-1/recitation/live?token=tok",
    );
    expect(result.current.state).toBe("connecting");
  });

  it("refuses to connect without a session token", () => {
    sessionStorage.clear();
    const { result } = renderHook(() => useRecitationSocket("event-1"));

    act(() => result.current.connect());

    expect(FakeSocket.instances).toHaveLength(0);
    expect(result.current.state).toBe("error");
    expect(result.current.notice).toMatch(/session has expired/i);
  });

  it("reports operator rights from session_info", () => {
    const { result } = renderHook(() => useRecitationSocket("event-1"));

    connectAsOperator(result);

    expect(result.current.state).toBe("connected");
    expect(result.current.isOperator).toBe(true);
    expect(result.current.notice).toBeNull();
  });

  it("explains why a viewer cannot publish", () => {
    const { result } = renderHook(() => useRecitationSocket("event-1"));

    act(() => result.current.connect());
    act(() => lastSocket().open());
    act(() => lastSocket().emit({ type: "session_info", is_operator: false }));

    expect(result.current.isOperator).toBe(false);
    expect(result.current.notice).toMatch(/no edit rights/i);

    let sent: boolean | undefined;
    act(() => {
      sent = result.current.sendPosition({
        text_id: "t1",
        segment_id: "s1",
        index: 0,
      });
    });

    expect(sent).toBe(false);
    expect(lastSocket().sent).toEqual([]);
  });

  it("publishes a set frame as the operator", () => {
    const { result } = renderHook(() => useRecitationSocket("event-1"));
    connectAsOperator(result);

    let sent: boolean | undefined;
    act(() => {
      sent = result.current.sendPosition({
        text_id: "t1",
        segment_id: "s1",
        index: 3,
        round_number: 2,
      });
    });

    expect(sent).toBe(true);
    expect(JSON.parse(lastSocket().sent[0])).toEqual({
      type: "set",
      text_id: "t1",
      segment_id: "s1",
      index: 3,
      round_number: 2,
    });
  });

  it("keeps the room's last position for display", () => {
    const { result } = renderHook(() => useRecitationSocket("event-1"));
    connectAsOperator(result);

    act(() =>
      lastSocket().emit({
        type: "position",
        text_id: "t1",
        segment_id: "s9",
        index: 8,
        round_number: 3,
      }),
    );

    expect(result.current.livePosition).toMatchObject({
      textId: "t1",
      segmentId: "s9",
      index: 8,
      roundNumber: 3,
    });
  });

  it("sends an end frame and stops on session_ended", () => {
    const { result } = renderHook(() => useRecitationSocket("event-1"));
    connectAsOperator(result);

    act(() => result.current.endSession());
    expect(JSON.parse(lastSocket().sent[0])).toEqual({ type: "end" });

    act(() => lastSocket().emit({ type: "session_ended" }));
    expect(result.current.state).toBe("ended");
    expect(result.current.isOpen).toBe(false);
  });

  it("surfaces a server error frame", () => {
    const { result } = renderHook(() => useRecitationSocket("event-1"));
    connectAsOperator(result);

    act(() =>
      lastSocket().emit({
        type: "error",
        code: "FORBIDDEN",
        message: "Only the event's operator can drive this recitation",
      }),
    );

    expect(result.current.notice).toContain("FORBIDDEN");
  });

  it("reconnects with backoff after an unintended close", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useRecitationSocket("event-1"));
    connectAsOperator(result);

    act(() => lastSocket().close());
    expect(result.current.state).toBe("reconnecting");
    expect(FakeSocket.instances).toHaveLength(1);

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(FakeSocket.instances).toHaveLength(2);
  });

  it("drops operator rights until the new connection confirms them", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useRecitationSocket("event-1"));
    connectAsOperator(result);

    act(() => lastSocket().close());
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    act(() => lastSocket().open());

    // session_info for this socket has not arrived yet.
    expect(result.current.isOperator).toBe(false);

    let sent: boolean | undefined;
    act(() => {
      sent = result.current.sendPosition({
        text_id: "t1",
        segment_id: "s1",
        index: 0,
      });
    });
    expect(sent).toBe(false);
    expect(lastSocket().sent).toEqual([]);

    act(() => lastSocket().emit({ type: "session_info", is_operator: true }));
    expect(result.current.isOperator).toBe(true);
  });

  it("does not reconnect after the operator disconnects", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useRecitationSocket("event-1"));
    connectAsOperator(result);

    act(() => result.current.disconnect());

    act(() => {
      vi.advanceTimersByTime(30000);
    });
    expect(FakeSocket.instances).toHaveLength(1);
    expect(result.current.state).toBe("idle");
  });

  it("closes the socket when the page unmounts", () => {
    const { result, unmount } = renderHook(() =>
      useRecitationSocket("event-1"),
    );
    connectAsOperator(result);
    const socket = lastSocket();

    unmount();

    expect(socket.closed).toBe(true);
  });

  it("pings an open socket so an idle operator is not dropped", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useRecitationSocket("event-1"));
    connectAsOperator(result);

    act(() => {
      vi.advanceTimersByTime(30000);
    });

    expect(lastSocket().sent.map((raw) => JSON.parse(raw))).toContainEqual({
      type: "ping",
    });
  });
});
