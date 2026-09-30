import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useQueries, useQuery } from "@tanstack/react-query";
import { getApiErrorMessage } from "@/lib/apiErrors";
import {
  fetchEditionTitle,
  fetchLiturgies,
  fetchLiveControlEvent,
  fetchRecitationDetails,
  fetchSegmentPlayTimes,
  fetchTextEditions,
  SUGGESTED_TEXT_IDS,
  toOperatorSegments,
} from "./api/liveControlApi";
import { fetchEditionYigchungs } from "./api/libraryTocApi";
import { ROUTES } from "@/routes/paths";

/**
 * A dry run of autoplay. It reads the same event, liturgies and learned play
 * times as the controller, but never opens the live socket and never publishes:
 * the lines step by on this screen only, each held for its recorded time, so
 * the timings can be checked without moving a room. It runs signed out and
 * needs no emit token: every read here is public.
 */

const toWireLanguage = (code: string) => code.trim().toLowerCase() || "bo";

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2, 3];
/** What a line with no recorded time does: stop, as the controller does, or
 * hold for a fixed time so the rest of the text can still be watched. */
const UNTIMED_OPTIONS = [
  { value: 0, label: "Stop" },
  { value: 2000, label: "Hold 2s" },
  { value: 4000, label: "Hold 4s" },
  { value: 8000, label: "Hold 8s" },
];
const TICK_MS = 50;

const formatMs = (ms: number) => {
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const total = Math.round(ms / 1000);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = String(total % 60).padStart(2, "0");
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${seconds}`
    : `${minutes}:${seconds}`;
};

const AutoplayTestPage = () => {
  const { eventId } = useParams<{ eventId: string }>();

  /** `?text=<text_id>` opens that text straight away, liturgy of the event or
   * not; picking another text writes it back, so the link reopens it. */
  const [searchParams, setSearchParams] = useSearchParams();
  const liturgyId = searchParams.get("text")?.trim() ?? "";
  const setLiturgyId = useCallback(
    (textId: string) =>
      setSearchParams(
        (current) => {
          const next = new URLSearchParams(current);
          if (textId) next.set("text", textId);
          else next.delete("text");
          return next;
        },
        { replace: true },
      ),
    [setSearchParams],
  );
  const [editionId, setEditionId] = useState("");
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [playing, setPlaying] = useState(false);
  /** How long the current line has been held, in text time (speed applied). */
  const [elapsed, setElapsed] = useState(0);
  const elapsedRef = useRef(0);
  const [speed, setSpeed] = useState(1);
  const [untimedHold, setUntimedHold] = useState(0);
  const [note, setNote] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  const { data: event, error: eventError } = useQuery({
    queryKey: ["live-control-event", eventId],
    queryFn: () => fetchLiveControlEvent(eventId ?? ""),
    enabled: Boolean(eventId),
    refetchOnWindowFocus: false,
  });

  const { data: liturgies } = useQuery({
    queryKey: ["live-control-liturgies", event?.collectionId],
    queryFn: () => fetchLiturgies(event?.collectionId ?? ""),
    enabled: Boolean(event?.collectionId),
    refetchOnWindowFocus: false,
  });

  // The puja opens on the first liturgy of the order, so the test does too.
  useEffect(() => {
    if (!liturgyId && liturgies && liturgies.length > 0) {
      setLiturgyId(liturgies[0].textId);
    }
  }, [liturgies, liturgyId, setLiturgyId]);

  // Named by the library, under the same key as the controller's shortcuts.
  const suggestionTitles = useQueries({
    queries: SUGGESTED_TEXT_IDS.map((textId) => ({
      queryKey: ["live-control-edition-title", textId],
      queryFn: () => fetchEditionTitle(textId),
      staleTime: Infinity,
      retry: false,
      refetchOnWindowFocus: false,
    })),
  });

  const { data: editionData } = useQuery({
    queryKey: ["live-control-editions", liturgyId],
    queryFn: () => fetchTextEditions(liturgyId),
    enabled: Boolean(liturgyId),
    refetchOnWindowFocus: false,
  });
  const editions = useMemo(
    () => (editionData ? [editionData.text, ...editionData.editions] : []),
    [editionData],
  );
  // The work itself leads, as it does on the controller.
  useEffect(() => {
    setEditionId(editions[0]?.textId ?? "");
  }, [editions]);
  const edition = editions.find((item) => item.textId === editionId);

  const {
    data: lines = [],
    isFetching: loadingLines,
    error: linesError,
  } = useQuery({
    queryKey: ["autoplay-test-lines", editionId, edition?.language],
    queryFn: async () => {
      const language = toWireLanguage(edition?.language ?? "");
      const details = await fetchRecitationDetails(editionId, language);
      return toOperatorSegments(details, language);
    },
    enabled: Boolean(edition),
    refetchOnWindowFocus: false,
  });

  const { data: yigchungs } = useQuery({
    queryKey: ["live-control-yigchungs", editionId],
    queryFn: () => fetchEditionYigchungs(editionId),
    enabled: Boolean(editionId),
    refetchOnWindowFocus: false,
    retry: false,
    staleTime: 1000 * 60 * 20,
  });

  const {
    data: playTimes,
    error: playTimesError,
    refetch: refetchPlayTimes,
    isFetching: loadingPlayTimes,
  } = useQuery({
    queryKey: ["live-control-play-times", editionId],
    queryFn: () => fetchSegmentPlayTimes(editionId),
    enabled: Boolean(editionId),
    refetchOnWindowFocus: false,
    retry: false,
  });

  // A new text starts from the top, stopped.
  useEffect(() => {
    setPlaying(false);
    setCurrentIndex(-1);
    elapsedRef.current = 0;
    setElapsed(0);
    setNote(null);
  }, [editionId]);

  /** Instruction lines are not recited, so autoplay steps over them - the
   * recorded time of a line runs to the next line the room says aloud. */
  const isYigchungLine = useCallback(
    (index: number) => {
      const id = lines[index]?.id;
      return Boolean(id && yigchungs?.[id]?.full);
    },
    [lines, yigchungs],
  );

  const nextRecited = useCallback(
    (from: number, delta: number) => {
      let next = from + delta;
      while (next >= 0 && next < lines.length && isYigchungLine(next)) {
        next += delta;
      }
      return next < 0 || next >= lines.length ? null : next;
    },
    [lines.length, isYigchungLine],
  );

  const durationOf = useCallback(
    (index: number): number | undefined => {
      const id = lines[index]?.id;
      return id ? playTimes?.[id] : undefined;
    },
    [lines, playTimes],
  );

  const timedCount = useMemo(
    () => lines.filter((line) => playTimes?.[line.id] !== undefined).length,
    [lines, playTimes],
  );
  const totalTimed = useMemo(
    () =>
      lines.reduce((sum, line) => sum + (playTimes?.[line.id] ?? 0), 0),
    [lines, playTimes],
  );
  const reachedTimed = useMemo(() => {
    let sum = 0;
    for (let index = 0; index < currentIndex; index += 1) {
      sum += playTimes?.[lines[index]?.id] ?? 0;
    }
    return sum;
  }, [lines, playTimes, currentIndex]);

  const scrollToLine = (index: number) => {
    const box = listRef.current;
    const node = box?.querySelector(`[data-line="${index}"]`);
    if (!box || !node) return;
    const relativeTop =
      node.getBoundingClientRect().top - box.getBoundingClientRect().top;
    const height = box.clientHeight;
    if (relativeTop < height * 0.2 || relativeTop > height * 0.65) {
      box.scrollTo({
        top: box.scrollTop + relativeTop - height * 0.3,
        behavior: "smooth",
      });
    }
  };

  const goTo = (index: number) => {
    setCurrentIndex(index);
    elapsedRef.current = 0;
    setElapsed(0);
    scrollToLine(index);
  };

  const currentDuration =
    currentIndex >= 0
      ? (durationOf(currentIndex) ?? (untimedHold || undefined))
      : undefined;

  // The clock: while playing, the current line's hold runs down and the next
  // recited line takes over when it is spent.
  const clockRef = useRef({ currentDuration, currentIndex, speed, nextRecited });
  clockRef.current = { currentDuration, currentIndex, speed, nextRecited };
  useEffect(() => {
    if (!playing) return;
    let last = performance.now();
    const timer = window.setInterval(() => {
      const now = performance.now();
      const dt = now - last;
      last = now;
      const {
        currentDuration: duration,
        currentIndex: at,
        speed: rate,
        nextRecited: next,
      } = clockRef.current;
      if (duration === undefined) {
        setPlaying(false);
        setNote(
          `Stopped at line ${at + 1}: it has no recorded play time. Pick a hold for untimed lines to play through it.`,
        );
        return;
      }
      const grown = elapsedRef.current + dt * rate;
      if (grown < duration) {
        elapsedRef.current = grown;
        setElapsed(grown);
        return;
      }
      const target = next(at, 1);
      if (target === null) {
        setPlaying(false);
        setNote("Reached the end of the text.");
        elapsedRef.current = duration;
        setElapsed(duration);
        return;
      }
      // Moved on here rather than on the next render, so a slow render never
      // lets the old line's hold be spent twice.
      clockRef.current = { ...clockRef.current, currentIndex: target };
      elapsedRef.current = 0;
      setElapsed(0);
      setCurrentIndex(target);
      scrollToLine(target);
    }, TICK_MS);
    return () => window.clearInterval(timer);
  }, [playing]);

  const togglePlay = () => {
    if (playing) {
      setPlaying(false);
      return;
    }
    setNote(null);
    void refetchPlayTimes();
    if (currentIndex < 0) {
      const first = nextRecited(-1, 1);
      if (first === null) return;
      goTo(first);
    }
    setPlaying(true);
  };

  const step = (delta: number) => {
    const target = nextRecited(currentIndex, delta);
    if (target !== null) goTo(target);
  };

  const restart = () => {
    setPlaying(false);
    setCurrentIndex(-1);
    elapsedRef.current = 0;
    setElapsed(0);
    setNote(null);
    listRef.current?.scrollTo({ top: 0 });
  };

  // Space plays and pauses; the arrows step, as on the controller.
  const shortcutsRef = useRef({ togglePlay, step });
  shortcutsRef.current = { togglePlay, step };
  useEffect(() => {
    const onKeyDown = (keyEvent: KeyboardEvent) => {
      const target = keyEvent.target as HTMLElement | null;
      if (target?.closest("input, select, textarea, button")) return;
      if (keyEvent.code === "Space") {
        keyEvent.preventDefault();
        shortcutsRef.current.togglePlay();
      } else if (
        keyEvent.code === "ArrowRight" ||
        keyEvent.code === "ArrowDown"
      ) {
        keyEvent.preventDefault();
        shortcutsRef.current.step(1);
      } else if (keyEvent.code === "ArrowLeft" || keyEvent.code === "ArrowUp") {
        keyEvent.preventDefault();
        shortcutsRef.current.step(-1);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  const errorMessage =
    eventError || linesError || playTimesError
      ? getApiErrorMessage(
          eventError ?? linesError ?? playTimesError,
          playTimesError && !eventError && !linesError
            ? "Could not load the play times."
            : "Could not load this event.",
        )
      : null;

  const progress =
    currentDuration && currentDuration > 0
      ? Math.min(1, elapsed / currentDuration)
      : 0;

  const selectClass =
    "cursor-pointer rounded-md border border-[#2c2c2e] bg-[#1c1c1e] px-2 py-1.5 text-[13px] font-semibold text-[#f2f2f7]";
  const buttonClass =
    "rounded-md border border-[#2c2c2e] bg-[#1c1c1e] px-3 py-1.5 text-[13px] font-semibold text-[#f2f2f7] hover:bg-[#2c2c2e] disabled:cursor-not-allowed disabled:opacity-40";

  return (
    <div className="flex h-[100dvh] touch-manipulation flex-col overflow-hidden bg-black font-tibetan-ui text-[#f2f2f7]">
      <header className="flex flex-wrap items-center gap-3 border-b border-[#2c2c2e] px-4 py-3">
        <div className="mr-auto flex min-w-0 flex-col leading-tight">
          <span className="truncate text-lg font-bold">
            {event?.title ?? "Loading event…"}
          </span>
          <span className="mt-0.5 text-[11px] font-medium tracking-[0.11em] text-[#8e8e93] uppercase">
            Autoplay test · not connected to the room
          </span>
        </div>
        {eventId ? (
          <Link
            to={ROUTES.liveControl(eventId)}
            className="text-[13px] text-[#0a84ff] hover:underline"
          >
            Open live control
          </Link>
        ) : null}
      </header>

      <div className="flex flex-wrap items-center gap-2 border-b border-[#2c2c2e] px-4 py-3">
        <select
          aria-label="Liturgy"
          value={liturgyId}
          onChange={(e) => setLiturgyId(e.target.value)}
          className={`${selectClass} max-w-[16rem]`}
          disabled={!liturgies?.length}
        >
          {/* A text from the link that is not in the event's order still shows. */}
          {liturgyId &&
          !liturgies?.some((liturgy) => liturgy.textId === liturgyId) ? (
            <option value={liturgyId}>
              {editionData?.text.title ?? liturgyId}
            </option>
          ) : !liturgies?.length ? (
            <option value="">
              {event && !event.collectionId ? "No liturgies" : "Loading…"}
            </option>
          ) : null}
          {liturgies?.map((liturgy, index) => (
            <option key={liturgy.textId} value={liturgy.textId}>
              {index + 1}. {liturgy.title}
            </option>
          ))}
        </select>
        <select
          aria-label="Edition"
          value={editionId}
          onChange={(e) => setEditionId(e.target.value)}
          className={`${selectClass} max-w-[14rem]`}
          disabled={editions.length === 0}
        >
          {editions.map((item) => (
            <option key={item.textId} value={item.textId}>
              {item.language || "?"} · {item.title}
            </option>
          ))}
        </select>

        <span className="mx-1 h-6 w-px bg-[#2c2c2e]" />

        <button
          type="button"
          onClick={() => step(-1)}
          className={buttonClass}
          disabled={lines.length === 0}
          aria-label="Previous line"
        >
          ◀
        </button>
        <button
          type="button"
          onClick={togglePlay}
          disabled={lines.length === 0 || !playTimes}
          className={`rounded-md px-4 py-1.5 text-[13px] font-bold disabled:cursor-not-allowed disabled:opacity-40 ${
            playing
              ? "bg-[#ff9f0a] text-black"
              : "bg-[#30d158] text-black hover:bg-[#28b84c]"
          }`}
        >
          {playing ? "❚❚ Pause" : "▶ Play"}
        </button>
        <button
          type="button"
          onClick={() => step(1)}
          className={buttonClass}
          disabled={lines.length === 0}
          aria-label="Next line"
        >
          ▶
        </button>
        <button
          type="button"
          onClick={restart}
          className={buttonClass}
          disabled={currentIndex < 0}
        >
          Restart
        </button>

        <label className="flex items-center gap-1.5 text-[12px] text-[#8e8e93]">
          Speed
          <select
            value={speed}
            onChange={(e) => setSpeed(Number(e.target.value))}
            className={selectClass}
          >
            {SPEEDS.map((value) => (
              <option key={value} value={value}>
                {value}×
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1.5 text-[12px] text-[#8e8e93]">
          Untimed lines
          <select
            value={untimedHold}
            onChange={(e) => setUntimedHold(Number(e.target.value))}
            className={selectClass}
          >
            {UNTIMED_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-b border-[#2c2c2e] px-4 py-2">
        <span className="text-[12px] text-[#8e8e93]">Suggested</span>
        {SUGGESTED_TEXT_IDS.map((textId, index) => (
          <button
            key={textId}
            type="button"
            onClick={() => setLiturgyId(textId)}
            aria-pressed={liturgyId === textId}
            className={`max-w-[18rem] truncate rounded-full border px-3 py-1 text-[13px] ${
              liturgyId === textId
                ? "border-[#30d158] bg-[#1c3a24] text-white"
                : "border-[#2c2c2e] bg-[#1c1c1e] text-[#f2f2f7] hover:bg-[#2c2c2e]"
            }`}
          >
            {suggestionTitles[index]?.data ?? textId}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2 text-[12px] text-[#8e8e93]">
        <span>
          {loadingLines
            ? "Loading lines…"
            : `${lines.length} lines · ${timedCount} with a play time`}
        </span>
        <span>
          {loadingPlayTimes
            ? "Loading play times…"
            : `Recorded total ${formatMs(totalTimed)}`}
        </span>
        {currentIndex >= 0 ? (
          <span>
            Line {currentIndex + 1} · {formatMs(elapsed)}
            {currentDuration ? ` / ${formatMs(currentDuration)}` : ""} ·
            elapsed {formatMs(reachedTimed + elapsed)}
          </span>
        ) : null}
      </div>
      <div className="h-1 w-full bg-[#1c1c1e]">
        <div
          className="h-full bg-[#30d158]"
          style={{ width: `${progress * 100}%` }}
        />
      </div>

      {errorMessage || note ? (
        <div className="border-b border-[#2c2c2e] bg-[#2a1a00] px-4 py-2 text-[13px] text-[#ffd60a]">
          {errorMessage ?? note}
        </div>
      ) : null}

      <div
        ref={listRef}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4"
      >
        {lines.map((line, index) => {
          const duration = playTimes?.[line.id];
          const yigchung = isYigchungLine(index);
          const active = index === currentIndex;
          return (
            <button
              key={`${line.id}-${index}`}
              type="button"
              data-line={index}
              onClick={() => goTo(index)}
              className={`mb-2 flex w-full items-start gap-3 rounded-md px-2 py-1.5 text-left ${
                active
                  ? "bg-[#1c3a24] ring-1 ring-[#30d158]"
                  : "hover:bg-[#111]"
              }`}
            >
              <span className="w-10 shrink-0 pt-1 text-right text-[11px] text-[#636366]">
                {index + 1}
              </span>
              <span
                className={`flex-1 leading-[1.6] ${
                  yigchung
                    ? "text-[17px] text-[#c9a063]"
                    : active
                      ? "text-[23px] text-white"
                      : "text-[23px] text-[#aeaeb2]"
                }`}
              >
                {line.content}
              </span>
              <span
                className={`w-14 shrink-0 pt-1 text-right text-[11px] tabular-nums ${
                  yigchung
                    ? "text-[#636366]"
                    : duration === undefined
                      ? "text-[#ff453a]"
                      : "text-[#8e8e93]"
                }`}
              >
                {yigchung
                  ? "skip"
                  : duration === undefined
                    ? "—"
                    : formatMs(duration)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default AutoplayTestPage;
