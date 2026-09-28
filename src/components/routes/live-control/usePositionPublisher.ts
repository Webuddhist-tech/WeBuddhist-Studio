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
 * twice. A move to a different line supersedes it: the operator has moved on,
 * and the room is better off on the line being read than on the one it missed.
 */
export function usePositionPublisher(
  eventId: string | undefined,
  token: string | null,
): UsePositionPublisherResult {
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

        const keyOf = (cue: PositionToPublish) =>
          `${cue.segmentId}|${cue.roundNumber}`;
        // Whatever the room has already taken needs no second post.
        const pending = cues.filter(
          (cue) => sentKeysRef.current[cue.textId] !== keyOf(cue),
        );
        if (pending.length === 0) continue;

        if (mountedRef.current) setState("publishing");
        // The edition on screen leads, and `cues` carries it first. Everything
        // else goes out together - one gap for the whole move, not one per
        // language - and the leading edition follows, so it is the position the
        // event is left holding.
        const driverTextId = cues[0].textId;
        const followers = pending.filter((cue) => cue.textId !== driverTextId);
        const leaders = pending.filter((cue) => cue.textId === driverTextId);

        const sent: { cue: PositionToPublish; result: PublishResult }[] = [];
        if (followers.length > 0) {
          const followerResults = await Promise.all(
            followers.map((cue) => publishPosition(eventId, currentToken, cue)),
          );
          followers.forEach((cue, index) =>
            sent.push({ cue, result: followerResults[index] }),
          );
        }
        for (const cue of leaders) {
          sent.push({
            cue,
            result: await publishPosition(eventId, currentToken, cue),
          });
        }
        if (!mountedRef.current) return;

        let published = 0;
        let failure: string | null = null;
        sent.forEach(({ cue, result }) => {
          if (result.ok) {
            sentKeysRef.current[cue.textId] = keyOf(cue);
            published += 1;
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
    // Drop whatever is queued and let the move already on the wire finish
    // first. A position accepted after the end request would leave the room
    // following a session the operator has closed, and its "publishing" would
    // replace the notice saying the recitation is over.
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
    } else {
      setState("error");
      setNotice(result.message);
    }
  }, [eventId]);

  const clearNotice = useCallback(() => setNotice(null), []);

  return { state, notice, lastSent, publish, endSession, clearNotice };
}
