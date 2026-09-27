import { useCallback, useEffect, useRef, useState } from "react";
import { ACCESS_TOKEN } from "@/lib/constant";
import {
  buildRecitationSocketUrl,
  type RecitationFrame,
  type SetPositionFrame,
} from "../api/recitationLiveApi";

const PING_INTERVAL_MS = 30000;
const MAX_RETRY_STEPS = 5;

export type RecitationConnectionState =
  | "idle"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "ended"
  | "error";

/** The room's last known position, as echoed back to the operator. */
export type LivePosition = {
  textId?: string;
  segmentId: string;
  index?: number | null;
  roundNumber?: number | null;
  at: string;
};

export interface UseRecitationSocketResult {
  state: RecitationConnectionState;
  /** True once the server confirms this token may drive the recitation. */
  isOperator: boolean;
  /** Last thing worth telling the operator: an error, or why publishing failed. */
  notice: string | null;
  livePosition: LivePosition | null;
  isOpen: boolean;
  connect: () => void;
  disconnect: () => void;
  /** Publishes a position. Returns false when the socket could not take it. */
  sendPosition: (frame: Omit<SetPositionFrame, "type">) => boolean;
  endSession: () => void;
  clearNotice: () => void;
}

/**
 * The operator's end of `/events/{id}/recitation/live`.
 *
 * Mirrors the reference emitter's connection rules: one socket at a time, a
 * queued reconnect is dropped before opening a new one (it would otherwise
 * replace this socket seconds later and orphan it), exponential backoff on an
 * unintended close, and a 30s ping so idle operators are not timed out.
 */
export function useRecitationSocket(
  eventId: string | undefined,
): UseRecitationSocketResult {
  const [state, setState] = useState<RecitationConnectionState>("idle");
  const [isOperator, setIsOperator] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [livePosition, setLivePosition] = useState<LivePosition | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const retryRef = useRef(0);
  const endedRef = useRef(false);
  /** Set while tearing down on purpose, so onclose does not queue a reconnect. */
  const closingRef = useRef(false);

  const clearReconnect = () => {
    if (reconnectTimerRef.current !== null) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  };

  const detach = (socket: WebSocket | null) => {
    if (!socket) return;
    socket.onopen = null;
    socket.onmessage = null;
    socket.onclose = null;
    socket.onerror = null;
  };

  const handleFrame = useCallback((frame: RecitationFrame) => {
    switch (frame.type) {
      case "session_info":
        setIsOperator(Boolean(frame.is_operator));
        if (!frame.is_operator) {
          setNotice(
            "This account has no edit rights on this event, so it cannot drive the recitation.",
          );
        }
        break;
      case "position":
        setLivePosition({
          textId: frame.text_id,
          segmentId: frame.segment_id,
          index: frame.index,
          roundNumber: frame.round_number,
          at: new Date().toLocaleTimeString(),
        });
        break;
      case "session_ended":
        endedRef.current = true;
        setState("ended");
        setIsOpen(false);
        setNotice("This recitation session has ended.");
        break;
      case "error":
        setNotice(`${frame.code}: ${frame.message}`);
        break;
      default:
        break;
    }
  }, []);

  const connect = useCallback(() => {
    if (!eventId) return;
    const token = sessionStorage.getItem(ACCESS_TOKEN);
    if (!token) {
      setState("error");
      setNotice("Your session has expired. Sign in again to go live.");
      return;
    }

    // A reconnect queued by an earlier socket would replace this one moments
    // from now and orphan it — still live on the server, unreachable here.
    clearReconnect();
    closingRef.current = true;
    detach(socketRef.current);
    socketRef.current?.close();
    closingRef.current = false;

    endedRef.current = false;
    // The role belongs to the connection that was confirmed it, not to the
    // operator: until this socket's own session_info lands, assume no rights.
    setIsOperator(false);
    setNotice(null);
    setState("connecting");

    const socket = new WebSocket(buildRecitationSocketUrl(eventId, token));
    socketRef.current = socket;

    socket.onopen = () => {
      retryRef.current = 0;
      setState("connected");
      setIsOpen(true);
    };

    socket.onmessage = (event: MessageEvent) => {
      let frame: RecitationFrame;
      try {
        frame = JSON.parse(String(event.data));
      } catch {
        return;
      }
      handleFrame(frame);
    };

    socket.onclose = () => {
      setIsOpen(false);
      if (closingRef.current || socketRef.current !== socket) return;
      if (endedRef.current) {
        setState("ended");
        return;
      }
      setState("reconnecting");
      retryRef.current = Math.min(retryRef.current + 1, MAX_RETRY_STEPS);
      reconnectTimerRef.current = setTimeout(
        () => connect(),
        1000 * Math.pow(2, retryRef.current - 1),
      );
    };

    socket.onerror = () => {
      if (socketRef.current !== socket) return;
      setState("error");
    };
  }, [eventId, handleFrame]);

  const disconnect = useCallback(() => {
    clearReconnect();
    closingRef.current = true;
    detach(socketRef.current);
    socketRef.current?.close();
    socketRef.current = null;
    closingRef.current = false;
    retryRef.current = 0;
    setIsOpen(false);
    setIsOperator(false);
    setState("idle");
  }, []);

  const send = useCallback((payload: object): boolean => {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) return false;
    socket.send(JSON.stringify(payload));
    return true;
  }, []);

  const sendPosition = useCallback(
    (frame: Omit<SetPositionFrame, "type">): boolean => {
      if (
        !socketRef.current ||
        socketRef.current.readyState !== WebSocket.OPEN
      ) {
        setNotice("Not connected.");
        return false;
      }
      if (!isOperator) {
        setNotice(
          "This account is connected as a viewer, so it cannot drive the recitation.",
        );
        return false;
      }
      return send({ type: "set", ...frame });
    },
    [isOperator, send],
  );

  const endSession = useCallback(() => {
    if (!send({ type: "end" })) setNotice("Not connected.");
  }, [send]);

  const clearNotice = useCallback(() => setNotice(null), []);

  // One ping timer for the hook's whole life: it checks the current socket
  // rather than being torn down and rebuilt on every reconnect.
  useEffect(() => {
    pingTimerRef.current = setInterval(() => {
      const socket = socketRef.current;
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: "ping" }));
      }
    }, PING_INTERVAL_MS);
    return () => {
      if (pingTimerRef.current !== null) clearInterval(pingTimerRef.current);
      pingTimerRef.current = null;
    };
  }, []);

  // Leaving the page must not leave a socket open behind it.
  useEffect(() => {
    return () => {
      clearReconnect();
      closingRef.current = true;
      detach(socketRef.current);
      socketRef.current?.close();
      socketRef.current = null;
    };
  }, []);

  return {
    state,
    isOperator,
    notice,
    livePosition,
    isOpen,
    connect,
    disconnect,
    sendPosition,
    endSession,
    clearNotice,
  };
}
