import { useCallback, useEffect, useRef, useState } from "react";
import { tolgee } from "@/i18n/tolgee";
import {
  commandRefused,
  recitationSocketUrl,
  toAutoplayState,
  toWireCommand,
  toWirePosition,
  type AutoplayCommand,
  type AutoplayResult,
  type AutoplayState,
  type MovePosition,
  type PublishResult,
} from "./api/liveControlApi";

/** Where the room is, as the socket last said. */
export interface RoomPosition {
  textId: string | null;
  segmentId: string;
  index: number | null;
  roundNumber: number | null;
  revision: number | null;
}

export type SocketStatus =
  | "idle"
  | "connecting"
  | "open"
  | "closed"
  /** The server answered, and turned the controller away. */
  | "refused";

export interface RecitationSocket {
  status: SocketStatus;
  /** The line the room is on - whoever put it there. */
  room: RoomPosition | null;
  /** How many people are following, not counting this controller. */
  people: number | null;
  autoplay: AutoplayState | null;
  /** Why the server turned the socket away, in its own words, while it does. */
  refusal: string | null;
  /**
   * Sends one move over the socket and resolves once the room has taken it -
   * or null at once when the socket is not open, so the caller sends it some
   * other way.
   */
  sendMove: (positions: MovePosition[]) => Promise<SocketMoveResult> | null;
  /**
   * Sends a command to the backend's autoplay over the socket and resolves
   * with its answer - or null at once when the socket is not open, so the
   * caller sends it by HTTP instead.
   */
  sendCommand: (command: AutoplayCommand) => Promise<AutoplayResult> | null;
}

/**
 * A move's answer. `lost` marks one that never got an answer - the socket
 * closed or went quiet - as against one the room refused: a lost move may be
 * sent again another way.
 */
export type SocketMoveResult = PublishResult & { lost?: boolean };

/** How long a move waits on its answer before it is given up as not taken. */
export const MOVE_ACK_TIMEOUT_MS = 4000;
/** Kept under the server's own idle limit, so a quiet socket is not dropped. */
const PING_INTERVAL_MS = 25_000;
const RECONNECT_MIN_MS = 1000;
const RECONNECT_MAX_MS = 15_000;

const newMoveId = (): string =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

const moveRefused = (code: unknown, message: unknown): string => {
  if (code === "THROTTLED") {
    return tolgee.t("studio.live_control.errors.positions_throttled");
  }
  if (typeof message === "string" && message) return message;
  return tolgee.t("studio.live_control.errors.move_not_taken");
};

/**
 * The controller's own line to the room: the event's live socket, opened with
 * the emit token. Over it the controller sends its moves, and hears where the
 * room actually is and what the backend's autoplay is doing. It reconnects by
 * itself; while it is down, moves go by HTTP instead.
 */
export function useRecitationSocket(
  eventId: string | undefined,
  token: string | null,
): RecitationSocket {
  const [status, setStatus] = useState<SocketStatus>("idle");
  const [room, setRoom] = useState<RoomPosition | null>(null);
  const [people, setPeople] = useState<number | null>(null);
  const [autoplay, setAutoplay] = useState<AutoplayState | null>(null);
  const [refusal, setRefusal] = useState<string | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  /** Whether the server has said hello on the socket now held: only then may
   * a move go over it. */
  const helloRef = useRef(false);
  const pendingRef = useRef(
    new Map<
      string,
      { resolve: (result: SocketMoveResult) => void; timer: number }
    >(),
  );
  const commandsRef = useRef(
    new Map<
      string,
      { resolve: (result: AutoplayResult) => void; timer: number }
    >(),
  );

  useEffect(() => {
    if (!eventId || !token || typeof WebSocket === "undefined") {
      setStatus("idle");
      return;
    }
    let disposed = false;
    let retryDelay = RECONNECT_MIN_MS;
    let retryTimer: number | undefined;
    let pingTimer: number | undefined;
    const pending = pendingRef.current;
    const commands = commandsRef.current;
    let lastRevision: number | null = null;

    const settleAll = (result: SocketMoveResult) => {
      pending.forEach(({ resolve, timer }) => {
        window.clearTimeout(timer);
        resolve(result);
      });
      pending.clear();
      commands.forEach(({ resolve, timer }) => {
        window.clearTimeout(timer);
        resolve({
          ok: false,
          lost: true,
          message: result.ok
            ? tolgee.t("studio.live_control.errors.server_connection_lost")
            : result.message,
        });
      });
      commands.clear();
    };

    const connect = () => {
      if (disposed) return;
      setStatus("connecting");
      let socket: WebSocket;
      try {
        socket = new WebSocket(recitationSocketUrl(eventId, token));
      } catch {
        setStatus("closed");
        retryTimer = window.setTimeout(connect, retryDelay);
        return;
      }
      socketRef.current = socket;
      helloRef.current = false;

      // The server accepts before it checks the token, then says why it will
      // not have the socket and closes it: until it has said hello, the socket
      // is not open to the room.
      let turnedAway: string | null = null;
      let hello = false;
      socket.onopen = () => {
        if (disposed) return;
        pingTimer = window.setInterval(() => {
          if (socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ type: "ping" }));
          }
        }, PING_INTERVAL_MS);
      };

      socket.onmessage = (message) => {
        let frame: Record<string, unknown>;
        try {
          frame = JSON.parse(String(message.data));
        } catch {
          return;
        }
        if (!frame || typeof frame !== "object") return;
        switch (frame.type) {
          case "position": {
            const revision =
              typeof frame.revision === "number" ? frame.revision : null;
            // A reconnect's snapshot can be older than a frame already
            // heard; the room never goes backwards on this screen.
            if (
              revision !== null &&
              lastRevision !== null &&
              revision <= lastRevision
            ) {
              return;
            }
            if (revision !== null) lastRevision = revision;
            setRoom({
              textId: typeof frame.text_id === "string" ? frame.text_id : null,
              segmentId: String(frame.segment_id ?? ""),
              index: typeof frame.index === "number" ? frame.index : null,
              roundNumber:
                typeof frame.round_number === "number"
                  ? frame.round_number
                  : null,
              revision,
            });
            return;
          }
          case "session_ended":
            setRoom(null);
            return;
          case "session_info":
            hello = true;
            helloRef.current = true;
            retryDelay = RECONNECT_MIN_MS;
            setRefusal(null);
            setStatus("open");
            if (typeof frame.count === "number") setPeople(frame.count);
            return;
          case "presence":
            if (typeof frame.count === "number") setPeople(frame.count);
            return;
          case "error":
            // Before hello, an error is the server turning the socket away.
            if (!hello) {
              turnedAway =
                typeof frame.message === "string" && frame.message
                  ? frame.message
                  : String(frame.code ?? "refused");
            }
            return;
          case "autoplay": {
            const state = toAutoplayState(frame);
            if (state) setAutoplay(state);
            return;
          }
          case "autoplay_ack": {
            const id =
              typeof frame.command_id === "string" ? frame.command_id : "";
            const waiting = commands.get(id);
            if (!waiting) return;
            commands.delete(id);
            window.clearTimeout(waiting.timer);
            const state =
              frame.ok === true ? toAutoplayState(frame.state) : null;
            if (state) setAutoplay(state);
            waiting.resolve(
              state
                ? { ok: true, state }
                : {
                    ok: false,
                    message: commandRefused(frame.code, frame.message),
                  },
            );
            return;
          }
          case "move_ack": {
            const id = typeof frame.move_id === "string" ? frame.move_id : "";
            const waiting = pending.get(id);
            if (!waiting) return;
            pending.delete(id);
            window.clearTimeout(waiting.timer);
            waiting.resolve(
              frame.ok === true
                ? { ok: true }
                : {
                    ok: false,
                    message: moveRefused(frame.code, frame.message),
                  },
            );
            return;
          }
          default:
            return;
        }
      };

      socket.onclose = () => {
        window.clearInterval(pingTimer);
        if (socketRef.current === socket) {
          socketRef.current = null;
          helloRef.current = false;
        }
        // Whatever was on its way may or may not have landed; the publisher
        // treats it as not taken and sends the line again on the next move.
        settleAll({
          ok: false,
          lost: true,
          message: tolgee.t("studio.live_control.errors.room_connection_lost"),
        });
        if (disposed) return;
        if (turnedAway) {
          // Asking again at once will be refused again - but a server being
          // redeployed may take the token soon, so it is asked now and then.
          setRefusal(turnedAway);
          setStatus("refused");
          retryDelay = RECONNECT_MAX_MS;
        } else {
          setStatus("closed");
        }
        retryTimer = window.setTimeout(connect, retryDelay);
        retryDelay = Math.min(retryDelay * 2, RECONNECT_MAX_MS);
      };
    };

    connect();

    return () => {
      disposed = true;
      window.clearTimeout(retryTimer);
      window.clearInterval(pingTimer);
      const socket = socketRef.current;
      socketRef.current = null;
      settleAll({
        ok: false,
        lost: true,
        message: tolgee.t("studio.live_control.errors.room_connection_closed"),
      });
      if (socket) {
        socket.onclose = null;
        socket.close();
      }
      setStatus("idle");
      setRoom(null);
      setAutoplay(null);
      setPeople(null);
      setRefusal(null);
    };
  }, [eventId, token]);

  const sendMove = useCallback(
    (positions: MovePosition[]): Promise<SocketMoveResult> | null => {
      const socket = socketRef.current;
      if (
        !socket ||
        socket.readyState !== WebSocket.OPEN ||
        !helloRef.current
      ) {
        return null;
      }
      const moveId = newMoveId();
      return new Promise<SocketMoveResult>((resolve) => {
        const timer = window.setTimeout(() => {
          pendingRef.current.delete(moveId);
          resolve({
            ok: false,
            lost: true,
            message: tolgee.t("studio.live_control.errors.room_timeout"),
          });
        }, MOVE_ACK_TIMEOUT_MS);
        pendingRef.current.set(moveId, { resolve, timer });
        try {
          socket.send(
            JSON.stringify({
              type: "move",
              move_id: moveId,
              positions: positions.map(({ position, run }) =>
                toWirePosition(position, run),
              ),
            }),
          );
        } catch {
          window.clearTimeout(timer);
          pendingRef.current.delete(moveId);
          resolve({
            ok: false,
            lost: true,
            message: tolgee.t("studio.live_control.errors.room_unreachable"),
          });
        }
      });
    },
    [],
  );

  const sendCommand = useCallback(
    (command: AutoplayCommand): Promise<AutoplayResult> | null => {
      const socket = socketRef.current;
      if (
        !socket ||
        socket.readyState !== WebSocket.OPEN ||
        !helloRef.current
      ) {
        return null;
      }
      const commandId = newMoveId();
      return new Promise<AutoplayResult>((resolve) => {
        const timer = window.setTimeout(() => {
          commandsRef.current.delete(commandId);
          resolve({
            ok: false,
            lost: true,
            message: tolgee.t("studio.live_control.errors.server_timeout"),
          });
        }, MOVE_ACK_TIMEOUT_MS);
        commandsRef.current.set(commandId, { resolve, timer });
        try {
          socket.send(
            JSON.stringify({
              type: `autoplay_${command.type}`,
              command_id: commandId,
              ...toWireCommand(command),
            }),
          );
        } catch {
          window.clearTimeout(timer);
          commandsRef.current.delete(commandId);
          resolve({
            ok: false,
            message: tolgee.t("studio.live_control.errors.server_unreachable"),
          });
        }
      });
    },
    [],
  );

  return { status, room, people, autoplay, refusal, sendMove, sendCommand };
}
