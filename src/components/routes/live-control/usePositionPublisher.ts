import { useCallback, useEffect, useRef, useState } from "react";
import {
  endRecitationSession,
  publishPosition,
  type PositionToPublish,
  type PublishResult,
} from "./api/liveControlApi";

/**
 * Held between one move and the next, never between the editions of a single
 * move. The event accepts a handful of positions a second, so a held-down key
 * is paced; the editions of one move still go out together.
 */
const MOVE_MIN_GAP_MS = 150;

/**
 * A fresh run id. `crypto.randomUUID` exists only on secure pages, and an
 * operator may drive the room from a tablet on a plain local HTTP address, so
 * the same v4 shape is built from `getRandomValues` where it is missing.
 */
const newRunId = (): string => {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0"));
  return [
    hex.slice(0, 4),
    hex.slice(4, 6),
    hex.slice(6, 8),
    hex.slice(8, 10),
    hex.slice(10, 16),
  ]
    .map((part) => part.join(""))
    .join("-");
};

export type PublishState = "idle" | "publishing" | "live" | "error";

export interface UsePositionPublisherResult {
  state: PublishState;
  /** Why the last publish did not land, when it did not. */
  notice: string | null;
  /** The last position the room accepted, for the operator to read back. */
  lastSent: string | null;
  /**
   * Queues one move: the line in the driving text plus the same line in every
   * other edition being followed. The newest move wins; older ones are dropped.
   */
  publish: (cues: PositionToPublish[]) => void;
  endSession: () => Promise<void>;
  clearNotice: () => void;
}

/**
 * The operator's end of the room's position.
 *
 * Follows the puja controller's pump: one move at a time, the newest move
 * replacing anything still queued behind it, and a position marked sent only
 * once the room has taken it - so a throttled or failed publish is retried on
 * the next move instead of being silently dropped.
 *
 * Each edition is a separate library text with its own segment ids, so a move is
 * published once per edition: readers of each language then find their own line.
 * The event holds a single position, though, so the last post the room accepts
 * is the one it keeps and the one anybody joining later resumes on. The edition
 * on screen is therefore published last, after the followed ones have landed -
 * the room settles on the line the operator is actually reading, never on a
 * translation that merely happened to answer last.
 *
 * Sent positions are remembered per text, so an edition the room refused is
 * retried on the next move of that same line while the others are not published
 * twice - except the edition on screen, which is sent again behind any follower
 * so that the room is left on it. A move to a different line supersedes a
 * refused position: the operator has moved on, and the room is better off on the
 * line being read than on the one it missed.
 */
export function usePositionPublisher(
  eventId: string | undefined,
  token: string | null,
  /** Told of each position once the room has taken it - never before. A move
   * to the position the room already holds is not posted again, but is told
   * of as taken. */
  onAccepted?: (cue: PositionToPublish) => void,
): UsePositionPublisherResult {
  const onAcceptedRef = useRef(onAccepted);
  onAcceptedRef.current = onAccepted;
  const [state, setState] = useState<PublishState>("idle");
  const [notice, setNotice] = useState<string | null>(null);
  const [lastSent, setLastSent] = useState<string | null>(null);

  /** The newest move awaiting a publish; latest always wins. */
  const targetRef = useRef<PositionToPublish[] | null>(null);
  const pumpingRef = useRef(false);
  /** The run of the pump now in flight, so ending a session can wait for it. */
  const pumpRef = useRef<Promise<void> | null>(null);
  /** Per text, the last position the room accepted, so it is not sent twice. */
  const sentKeysRef = useRef<Record<string, string>>({});
  /**
   * Per text, the run it is in: kept for as long as every move includes the
   * text, dropped by the first move that leaves it out. The backend times one
   * line against the next only within a run, so a text the operator left and
   * came back to is not billed for the time spent on the other one.
   */
  const runsRef = useRef<Record<string, string>>({});
  /** Set while a session is being ended, so no later move overtakes the end. */
  const endingRef = useRef(false);
  const tokenRef = useRef(token);
  tokenRef.current = token;
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // A new token is a new chance for positions the room refused.
  useEffect(() => {
    sentKeysRef.current = {};
  }, [token]);

  const pump = useCallback(async () => {
    if (pumpingRef.current) return;
    pumpingRef.current = true;
    try {
      while (targetRef.current) {
        // Take the newest move and drop anything older: a fast operator's
        // earlier lines are already superseded.
        const cues = targetRef.current;
        targetRef.current = null;
        const currentToken = tokenRef.current;
        if (!eventId || !currentToken) return;

        // Every text in this move carries its run on; any text left out of it
        // loses its run, so returning to it later starts a new one. A move
        // with nothing left to post still counts: its texts stayed with the
        // room.
        const runs: Record<string, string> = {};
        cues.forEach((cue) => {
          runs[cue.textId] = runsRef.current[cue.textId] ?? newRunId();
        });
        runsRef.current = runs;

        const keyOf = (cue: PositionToPublish) =>
          `${cue.segmentId}|${cue.roundNumber}`;
        // Whatever the room has already taken needs no second post.
        const pending = cues.filter(
          (cue) => sentKeysRef.current[cue.textId] !== keyOf(cue),
        );
        if (pending.length === 0) {
          // Nothing to post: the room already holds every one of these. Said
          // so, all the same - whoever made the move is waiting on the room
          // taking it, and the room has.
          cues.forEach((cue) => onAcceptedRef.current?.(cue));
          continue;
        }

        if (mountedRef.current) setState("publishing");
        // The edition on screen leads, and `cues` carries it first. Everything
        // else goes out together - one gap for the whole move, not one per
        // language - and the leading edition follows, so it is the position the
        // event is left holding.
        const driverTextId = cues[0].textId;
        const followers = pending.filter((cue) => cue.textId !== driverTextId);
        // Whenever a follower is published, the leading edition is published
        // behind it even if the room already took it: ticking another edition on
        // the line being read would otherwise send the follower alone, and the
        // event would be left holding that translation's segment.
        const leaders = (followers.length > 0 ? cues : pending).filter(
          (cue) => cue.textId === driverTextId,
        );

        const sent: { cue: PositionToPublish; result: PublishResult }[] = [];
        if (followers.length > 0) {
          const followerResults = await Promise.all(
            followers.map((cue) =>
              publishPosition(eventId, currentToken, cue, runs[cue.textId]),
            ),
          );
          followers.forEach((cue, index) =>
            sent.push({ cue, result: followerResults[index] }),
          );
        }
        for (const cue of leaders) {
          sent.push({
            cue,
            result: await publishPosition(
              eventId,
              currentToken,
              cue,
              runs[cue.textId],
            ),
          });
        }
        if (!mountedRef.current) return;

        let published = 0;
        let failure: string | null = null;
        sent.forEach(({ cue, result }) => {
          if (result.ok) {
            sentKeysRef.current[cue.textId] = keyOf(cue);
            published += 1;
            onAcceptedRef.current?.(cue);
          } else {
            // Not marked sent, so moving to this line again publishes it again.
            failure = result.message;
          }
        });

        if (failure) {
          setState("error");
          setNotice(failure);
        } else if (published > 0) {
          setState("live");
          setNotice(null);
          const line = cues[0]?.index ?? 0;
          const editions = published > 1 ? ` · ${published} editions` : "";
          setLastSent(
            `line ${line + 1} at ${new Date().toLocaleTimeString()}${editions}`,
          );
        }

        // Only when another move is already waiting: a held-down key is paced,
        // a single move is never delayed.
        if (targetRef.current) {
          await new Promise((resolve) => setTimeout(resolve, MOVE_MIN_GAP_MS));
        }
      }
    } finally {
      pumpingRef.current = false;
      pumpRef.current = null;
    }
  }, [eventId]);

  const publish = useCallback(
    (cues: PositionToPublish[]) => {
      if (cues.length === 0) return;
      if (!tokenRef.current) {
        setNotice("Paste the emit token before driving the room.");
        return;
      }
      // The operator has closed the session: a move made while the end request
      // is being waited on must not follow it out to the room.
      if (endingRef.current) return;
      // A text this move leaves out loses its run now, not when the pump takes
      // the move: a newer move may replace this one in the queue first, and a
      // text left and returned to meanwhile must still start a new run.
      // A new object, not an edit: the move in flight still reads its own.
      const kept: Record<string, string> = {};
      cues.forEach((cue) => {
        const run = runsRef.current[cue.textId];
        if (run) kept[cue.textId] = run;
      });
      runsRef.current = kept;
      targetRef.current = cues;
      // A pump already running will take this target on its next turn; starting
      // a second one would only find the first holding the lock.
      if (!pumpingRef.current) pumpRef.current = pump();
    },
    [pump],
  );

  const endSession = useCallback(async () => {
    if (!eventId || !tokenRef.current) {
      setNotice("Paste the emit token before driving the room.");
      return;
    }
    // Drop whatever is queued, take no further move, and let the one already on
    // the wire finish first. A position accepted after the end request would
    // leave the room following a session the operator has closed, and its
    // "publishing" would replace the notice saying the recitation is over - and
    // the operator pressing Next during the wait must not smuggle one out.
    endingRef.current = true;
    try {
      targetRef.current = null;
      if (pumpRef.current) {
        await pumpRef.current;
        if (!mountedRef.current) return;
      }
      const result = await endRecitationSession(eventId, tokenRef.current);
      if (!mountedRef.current) return;
      if (result.ok) {
        setState("idle");
        setNotice("This recitation session has ended.");
        setLastSent(null);
        sentKeysRef.current = {};
        runsRef.current = {};
      } else {
        setState("error");
        setNotice(result.message);
      }
    } finally {
      // An end that did not land leaves the operator driving, so moves are
      // taken again.
      endingRef.current = false;
    }
  }, [eventId]);

  const clearNotice = useCallback(() => setNotice(null), []);

  return { state, notice, lastSent, publish, endSession, clearNotice };
}
