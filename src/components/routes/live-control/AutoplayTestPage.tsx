import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQueries, useQuery } from "@tanstack/react-query";
import { getApiErrorMessage } from "@/lib/apiErrors";
import {
  fetchEditionTitle,
  fetchRecitationDetails,
  fetchSegmentPlayTimes,
  fetchTextEditions,
  SUGGESTED_TEXT_IDS,
  toOperatorSegments,
} from "./api/liveControlApi";
import { fetchEditionYigchungs } from "./api/libraryTocApi";

/**
 * A dry run of autoplay. It reads the same texts and learned play times as the
 * controller, but never opens the live socket and never publishes:
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
/** How long the clock waits on the library's yigchung before going without. */
const YIGCHUNG_WAIT_MS = 8000;

/** The controller's texts opened in this browser, newest first - the same list
 * it keeps under this key - so a text in use there is one tap away here. */
const RECENT_TEXTS_STORAGE_KEY = "live-control-recent-texts";
const readRecentTexts = (): { textId: string; title: string | null }[] => {
  try {
    const parsed: unknown = JSON.parse(
      localStorage.getItem(RECENT_TEXTS_STORAGE_KEY) ?? "[]",
    );
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((item) =>
      item && typeof item === "object" && typeof item.textId === "string"
        ? [
            {
              textId: item.textId,
              title: typeof item.title === "string" ? item.title : null,
            },
          ]
        : [],
    );
  } catch {
    return [];
  }
};

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
  /** `?text=<text_id>` is the text on screen; with none, the page opens on the
   * picker. Picking a text writes it here, so the link reopens it. */
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
        // A history entry per text, so Back returns to the picker.
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

  const [recentTexts] = useState(readRecentTexts);

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

  /** What the picker offers: the texts opened in the controller here, then
   * the suggested ones. */
  const choices = [
    ...recentTexts.map((text) => ({
      ...text,
      group: "Opened in the controller",
    })),
    ...SUGGESTED_TEXT_IDS.filter(
      (textId) => !recentTexts.some((text) => text.textId === textId),
    ).map((textId) => ({
      textId,
      title: suggestionTitles[SUGGESTED_TEXT_IDS.indexOf(textId)]?.data ?? null,
      group: "Suggested",
    })),
  ];

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

  const { data: yigchungs, isPending: yigchungsPending } = useQuery({
    queryKey: ["live-control-yigchungs", editionId],
    // The clock waits on this, so a library that does not answer is given up
    // on, as the controller does: every line is then recited.
    queryFn: () =>
      Promise.race([
        fetchEditionYigchungs(editionId),
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error("yigchung lookup timed out")),
            YIGCHUNG_WAIT_MS,
          ),
        ),
      ]),
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

  /** Until the marks are in, a line cannot be told apart from an instruction. */
  const awaitingMarks = Boolean(editionId) && yigchungsPending;
  /** Set while the play times are read afresh for a start. */
  const [refreshing, setRefreshing] = useState(false);

  // A new text starts from the top, stopped.
  useEffect(() => {
    setPlaying(false);
    indexRef.current = -1;
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

  // Skipped lines play no time, so none of theirs is counted.
  const recitedCount = useMemo(
    () => lines.filter((_, index) => !isYigchungLine(index)).length,
    [lines, isYigchungLine],
  );
  const timedCount = useMemo(
    () =>
      lines.filter(
        (line, index) =>
          !isYigchungLine(index) && playTimes?.[line.id] !== undefined,
      ).length,
    [lines, playTimes, isYigchungLine],
  );
  const timeBefore = useCallback(
    (end: number) => {
      let sum = 0;
      for (let index = 0; index < end; index += 1) {
        if (!isYigchungLine(index)) sum += playTimes?.[lines[index]?.id] ?? 0;
      }
      return sum;
    },
    [lines, playTimes, isYigchungLine],
  );
  const totalTimed = useMemo(
    () => timeBefore(lines.length),
    [timeBefore, lines.length],
  );
  const reachedTimed = useMemo(
    () => (currentIndex < 0 ? 0 : timeBefore(currentIndex)),
    [timeBefore, currentIndex],
  );

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

  /** The line on screen, as the clock reads it between renders. */
  const indexRef = useRef(currentIndex);
  indexRef.current = currentIndex;

  const goTo = (index: number) => {
    indexRef.current = index;
    setCurrentIndex(index);
    elapsedRef.current = 0;
    setElapsed(0);
    scrollToLine(index);
  };

  /** How long a line is held: its recorded time, else the untimed hold. */
  const durationAt = useCallback(
    (index: number) => durationOf(index) ?? (untimedHold || undefined),
    [durationOf, untimedHold],
  );
  const currentDuration =
    currentIndex >= 0 ? durationAt(currentIndex) : undefined;

  /** The clock waits, rather than guesses, while either is still loading. */
  const clockReady = playing && !refreshing && !awaitingMarks;

  // The clock: while playing, the current line's hold runs down and the next
  // recited line takes over when it is spent.
  const clockRef = useRef({ durationAt, speed, nextRecited });
  clockRef.current = { durationAt, speed, nextRecited };
  useEffect(() => {
    if (!clockReady) return;
    // The first line is chosen only now, once instruction lines are known.
    if (indexRef.current < 0) {
      const first = clockRef.current.nextRecited(-1, 1);
      if (first === null) {
        setPlaying(false);
        return;
      }
      goTo(first);
    }
    let last = performance.now();
    const timer = window.setInterval(() => {
      const now = performance.now();
      const dt = now - last;
      last = now;
      const {
        durationAt: holdOf,
        speed: rate,
        nextRecited: next,
      } = clockRef.current;
      const at = indexRef.current;
      const duration = holdOf(at);
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
      goTo(target);
    }, TICK_MS);
    return () => window.clearInterval(timer);
    // goTo only touches refs and state setters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clockReady]);

  const togglePlay = () => {
    if (playing) {
      setPlaying(false);
      return;
    }
    setNote(null);
    // Times learned since the page opened count too, so no line is judged
    // untimed until the fresh ones are in.
    setRefreshing(true);
    void refetchPlayTimes().finally(() => setRefreshing(false));
    setPlaying(true);
  };

  const step = (delta: number) => {
    if (awaitingMarks) return;
    const target = nextRecited(currentIndex, delta);
    if (target !== null) goTo(target);
  };

  const restart = () => {
    setPlaying(false);
    indexRef.current = -1;
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
    linesError || playTimesError
      ? getApiErrorMessage(
          linesError ?? playTimesError,
          linesError
            ? "Could not load this text."
            : "Could not load the play times.",
        )
      : null;

  const progress =
    currentDuration && currentDuration > 0
      ? Math.min(1, elapsed / currentDuration)
      : 0;

  const selectClass =
    "cursor-pointer rounded-md border border-[#2c2c2e] bg-[#1c1c1e] px-2 py-1.5 text-[13px] font-semibold text-[#f2f2f7]";
  const iconButtonClass =
    "flex h-11 w-11 items-center justify-center rounded-full bg-[#1c1c1e] text-lg text-[#f2f2f7] hover:bg-[#2c2c2e] disabled:cursor-not-allowed disabled:opacity-40";

  // Start: nothing but the texts to choose from, large enough to tap.
  if (!liturgyId) {
    return (
      <div className="min-h-[100dvh] bg-black font-tibetan-ui text-[#f2f2f7]">
        <div className="mx-auto flex max-w-3xl flex-col gap-4 px-5 py-10">
          <div className="mb-2">
            <h1 className="text-2xl font-bold">Choose a text</h1>
            <p className="mt-1 text-sm text-[#8e8e93]">
              Autoplay test · plays on this screen only
            </p>
          </div>
          {choices.map((choice) => (
            <button
              key={choice.textId}
              type="button"
              onClick={() => setLiturgyId(choice.textId)}
              className="flex w-full flex-col items-start gap-1 rounded-2xl border border-[#2c2c2e] bg-[#111113] px-6 py-5 text-left hover:border-[#30d158] hover:bg-[#15201a]"
            >
              <span className="text-[11px] font-medium tracking-[0.11em] text-[#8e8e93] uppercase">
                {choice.group}
              </span>
              <span className="text-[26px] leading-[1.5] break-words">
                {choice.title ?? choice.textId}
              </span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[100dvh] touch-manipulation flex-col overflow-hidden bg-black font-tibetan-ui text-[#f2f2f7]">
      <div
        ref={listRef}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pt-6 pb-48 lg:px-10"
      >
        {lines.length === 0 ? (
          <p className="py-12 text-center text-sm text-[#8e8e93]">
            {loadingLines ? "Loading…" : "This text has no lines."}
          </p>
        ) : null}
        <div className="mx-auto max-w-4xl">
          {lines.map((line, index) => {
            const duration = playTimes?.[line.id];
            const yigchung = isYigchungLine(index);
            const active = index === currentIndex;
            return (
              <button
                key={`${line.id}-${index}`}
                type="button"
                data-line={index}
                aria-current={active ? "true" : undefined}
                onClick={() => goTo(index)}
                className={`mb-2 block w-full rounded-md px-2 py-1.5 text-left break-words ${
                  active
                    ? "bg-[#1c3a24] ring-1 ring-[#30d158]"
                    : "hover:bg-[#111]"
                }`}
              >
                {!yigchung ? (
                  <span
                    data-play-time={duration ?? ""}
                    className={`float-right mt-1 ml-3 font-sans text-[11px] tabular-nums ${
                      duration === undefined
                        ? "text-[#ff453a]"
                        : "text-[#636366]"
                    }`}
                  >
                    {duration === undefined ? "—" : formatMs(duration)}
                  </span>
                ) : null}
                <span
                  className={`leading-[1.6] ${
                    yigchung
                      ? "text-[17px] text-[#c9a063]"
                      : active
                        ? "text-[23px] text-white"
                        : "text-[23px] text-[#aeaeb2]"
                  }`}
                >
                  {line.content}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Every control in one bar, fixed at the foot, so the text has the page. */}
      <div className="fixed inset-x-0 bottom-0 border-t border-[#2c2c2e] bg-[#0b0b0c]/95 backdrop-blur">
        <div className="h-1 w-full bg-[#1c1c1e]">
          <div
            className="h-full bg-[#30d158]"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
        {errorMessage || note ? (
          <p className="px-4 pt-2 text-center text-[12px] text-[#ffd60a]">
            {errorMessage ?? note}
          </p>
        ) : null}
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setLiturgyId("")}
              className="rounded-md px-2 py-1.5 text-[13px] font-semibold text-[#0a84ff] hover:bg-[#1c1c1e]"
            >
              ← Texts
            </button>
            {editions.length > 1 ? (
              <select
                aria-label="Edition"
                value={editionId}
                onChange={(e) => setEditionId(e.target.value)}
                className={`${selectClass} max-w-[10rem]`}
              >
                {editions.map((item) => (
                  <option key={item.textId} value={item.textId}>
                    {item.language || "?"} · {item.title}
                  </option>
                ))}
              </select>
            ) : null}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => step(-1)}
              className={iconButtonClass}
              disabled={lines.length === 0 || awaitingMarks}
              aria-label="Previous line"
            >
              ⏮
            </button>
            <button
              type="button"
              onClick={togglePlay}
              disabled={lines.length === 0 || !playTimes}
              aria-label={playing ? "Pause" : "Play"}
              className={`flex h-14 w-14 items-center justify-center rounded-full text-xl font-bold text-black disabled:cursor-not-allowed disabled:opacity-40 ${
                playing ? "bg-[#ff9f0a]" : "bg-[#30d158] hover:bg-[#28b84c]"
              }`}
            >
              {playing ? "❚❚" : "▶"}
            </button>
            <button
              type="button"
              onClick={() => step(1)}
              className={iconButtonClass}
              disabled={lines.length === 0 || awaitingMarks}
              aria-label="Next line"
            >
              ⏭
            </button>
          </div>

          <div className="flex items-center gap-2">
            <select
              aria-label="Speed"
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
            <select
              aria-label="Untimed lines"
              title="What a line with no recorded time does"
              value={untimedHold}
              onChange={(e) => setUntimedHold(Number(e.target.value))}
              className={selectClass}
            >
              {UNTIMED_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  Untimed: {option.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={restart}
              disabled={currentIndex < 0}
              aria-label="Restart"
              className={iconButtonClass}
            >
              ↺
            </button>
          </div>
        </div>
        <p className="pb-2 text-center font-sans text-[11px] text-[#636366] tabular-nums">
          {playing && (refreshing || awaitingMarks)
            ? "Waiting for the play times and instruction marks… · "
            : ""}
          {loadingPlayTimes
            ? "Loading play times…"
            : `${timedCount}/${recitedCount} lines timed · total ${formatMs(totalTimed)}`}
          {currentIndex >= 0
            ? ` · line ${currentIndex + 1} ${formatMs(elapsed)}${
                currentDuration ? ` / ${formatMs(currentDuration)}` : ""
              } · elapsed ${formatMs(reachedTimed + elapsed)}`
            : ""}
        </p>
      </div>
    </div>
  );
};

export default AutoplayTestPage;
