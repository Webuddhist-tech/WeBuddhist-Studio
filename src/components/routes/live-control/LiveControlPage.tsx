import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useParams } from "react-router-dom";
import { RECITATION_EMIT_TOKEN } from "@/lib/constant";
import { ROUTES } from "@/routes/paths";
import { useQueries, useQuery } from "@tanstack/react-query";
import { useDebounce } from "use-debounce";
import { getApiErrorMessage } from "@/lib/apiErrors";
import {
  fetchAutoplayState,
  fetchEditionTitle,
  fetchRecitationDetails,
  fetchSegmentPlayTimes,
  fetchTextEditions,
  publishMove,
  searchTextsByTitle,
  startAutoplay,
  stopAutoplay,
  SUGGESTED_TEXT_IDS,
  toOperatorSegments,
  type AutoplayPlanStep,
  type AutoplayState,
  type OperatorSegment,
  type PositionToPublish,
  type TextEdition,
} from "./api/liveControlApi";
import {
  fetchEditionSections,
  fetchEditionYigchungs,
  type SegmentYigchung,
  type TocEntry,
} from "./api/libraryTocApi";
import { passageAt, returnButtonForLine, returnPassages } from "./returnJumps";
import { usePositionPublisher, type SendMove } from "./usePositionPublisher";
import { useRecitationSocket } from "./useRecitationSocket";
import { useWakeLock } from "./useWakeLock";

/** A plan the backend is running, as this page laid it out: which line each
 * step is, so the page can follow the backend's step by step. */
interface RunningPlan {
  planId: string | null;
  steps: (AutoplayPlanStep & {
    lineIndex: number;
    round: number;
    passageKey: string | null;
  })[];
  /** Where the plan stops because a line has no recorded time; null when it
   * runs to the end of the text. */
  noTimeAt: number | null;
  /** The move it counts as, so a round reset after it is not undone by it. */
  move: number;
  /** The furthest step heard of: the start's own answer can arrive after the
   * socket has already told of the next step, and must not undo it. */
  lastStep?: number;
}

/** The backend refuses longer plans; a whole puja is far shorter. */
const MAX_PLAN_STEPS = 5000;
/** The backend's bounds on a step's hold - the recorder's own. */
const MIN_PLAN_STEP_MS = 300;
const MAX_PLAN_STEP_MS = 3 * 60 * 1000;
/** How often the backend's autoplay is asked after when the socket is down. */
const AUTOPLAY_POLL_MS = 1500;

/** The emit token is kept per browser, so it is pasted once per machine. It is
 * never put in the link: the URL is shareable, the token must not be. Signing
 * out of Studio clears it, along with the session's own tokens. */
const TOKEN_STORAGE_KEY = RECITATION_EMIT_TOKEN;

/** Recitation languages are lowercase on the wire. */
const toWireLanguage = (code: string) => code.trim().toLowerCase() || "bo";

const readStoredToken = (): string | null => {
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
};

const storeToken = (token: string | null) => {
  try {
    if (token) localStorage.setItem(TOKEN_STORAGE_KEY, token);
    else localStorage.removeItem(TOKEN_STORAGE_KEY);
  } catch {
    // A browser with site data blocked still drives the room this session.
  }
};

/** The languages the room reads in. A new work follows these of its
 * translations from the start; any other edition waits to be ticked. */
const DEFAULT_FOLLOWED_LANGUAGES = ["bo", "en", "zh"];
const followedByDefault = (edition: TextEdition) =>
  DEFAULT_FOLLOWED_LANGUAGES.includes(edition.language.split(/[-_]/)[0]);

/** How big the recitation lines, and separately the liturgy and section
 * titles, are drawn relative to the default. Each is kept per browser, like the
 * token: it suits the screen and the reader's eyes, not the event. */
/** 30% to 150%, a tenth at a time. */
const TEXT_SCALES = Array.from(
  { length: 13 },
  (_, step) => (30 + step * 10) / 100,
);
const TEXT_SCALE_STORAGE_KEY = "live-control-text-scale";
const TITLES_SCALE_STORAGE_KEY = "live-control-titles-scale";
/** Where the titles size was kept before the lines got a size of their own. */
const LEGACY_TITLES_SCALE_STORAGE_KEY = "live-control-title-scale";

const readStoredScale = (key: string, legacyKey?: string): number => {
  try {
    const raw =
      localStorage.getItem(key) ??
      (legacyKey ? localStorage.getItem(legacyKey) : null);
    const stored = raw === null ? NaN : Number(raw);
    if (!Number.isFinite(stored) || stored <= 0) return 1;
    // A size saved from an older list of steps lands on the nearest step.
    return TEXT_SCALES.reduce((nearest, scale) =>
      Math.abs(scale - stored) < Math.abs(nearest - stored) ? scale : nearest,
    );
  } catch {
    return 1;
  }
};

const storeScale = (key: string, scale: number) => {
  try {
    localStorage.setItem(key, String(scale));
  } catch {
    // Blocked site data: the size holds for this session only.
  }
};

/** Texts pasted by id, newest first, kept per browser so an event with no
 * liturgies does not need the id pasted again next time. */
interface RecentText {
  textId: string;
  title?: string;
}
const RECENT_TEXTS_STORAGE_KEY = "live-control-recent-texts";
const MAX_RECENT_TEXTS = 6;

const readRecentTexts = (): RecentText[] => {
  try {
    const parsed: unknown = JSON.parse(
      localStorage.getItem(RECENT_TEXTS_STORAGE_KEY) ?? "[]",
    );
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (item): item is RecentText =>
          typeof item?.textId === "string" && item.textId.length > 0,
      )
      .map(({ textId, title }) => ({
        textId,
        title: typeof title === "string" ? title : undefined,
      }))
      .slice(0, MAX_RECENT_TEXTS);
  } catch {
    return [];
  }
};

const storeRecentTexts = (texts: RecentText[]) => {
  try {
    localStorage.setItem(RECENT_TEXTS_STORAGE_KEY, JSON.stringify(texts));
  } catch {
    // Blocked site data: the list holds for this session only.
  }
};

/** How long after the last timed move the play times are read again. */
const PLAY_TIMES_REFRESH_DELAY_MS = 1500;

/** How long a move waits on the library's yigchung before going without it. */
const YIGCHUNG_WAIT_MS = 8000;

/** How many rounds each return button has been through, kept per browser so a
 * reload mid-puja does not lose the count. A button never pressed is on its
 * first round, so the count starts at one. Counts belong to one event: the same
 * praise recited at another event starts again from the first round. */
const returnCountsStorageKey = (eventId: string | undefined) =>
  `live-control-return-counts:${eventId ?? ""}`;

/** How many rounds each repeated passage is to be recited this puja, set by the
 * operator so autoplay can take its Returns itself. Counted as the Return's
 * badge counts: the first time through is round 1. Kept per event, like the
 * counts. */
const plannedRoundsStorageKey = (eventId: string | undefined) =>
  `live-control-planned-rounds:${eventId ?? ""}`;
/** The most rounds a passage can be set to. */
const MAX_PLANNED_ROUNDS = 21;

const readStoredCounts = (storageKey: string): Record<string, number> => {
  try {
    const parsed: unknown = JSON.parse(
      localStorage.getItem(storageKey) ?? "{}",
    );
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }
    return Object.fromEntries(
      Object.entries(parsed).filter(
        (entry): entry is [string, number] =>
          Number.isInteger(entry[1]) && entry[1] >= 1,
      ),
    );
  } catch {
    return {};
  }
};

const storeCounts = (storageKey: string, counts: Record<string, number>) => {
  try {
    localStorage.setItem(storageKey, JSON.stringify(counts));
  } catch {
    // Blocked site data: the counts hold for this session only.
  }
};

/**
 * Counts by return button, kept under `storageKey`. The counts are tagged with
 * the key they were read for, so moving to another event's page reads that
 * event's own rather than carrying these over.
 */
const useStoredCounts = (storageKey: string) => {
  const [state, setState] = useState(() => ({
    storageKey,
    counts: readStoredCounts(storageKey),
  }));
  const counts =
    state.storageKey === storageKey
      ? state.counts
      : readStoredCounts(storageKey);
  const update = useCallback(
    (change: (current: Record<string, number>) => Record<string, number>) =>
      setState((current) => {
        const next = change(
          current.storageKey === storageKey
            ? current.counts
            : readStoredCounts(storageKey),
        );
        storeCounts(storageKey, next);
        return { storageKey, counts: next };
      }),
    [storageKey],
  );
  return [counts, update] as const;
};

/** How much of an upright phone's height the titles take, above the lines.
 * The operator drags the divider to set it; it is kept per browser. */
const TITLES_SHARE_DEFAULT = 0.35;
const TITLES_SHARE_MIN = 0.12;
const TITLES_SHARE_MAX = 0.7;
const TITLES_SHARE_STORAGE_KEY = "live-control-titles-share";

const clampTitlesShare = (share: number) =>
  Math.min(TITLES_SHARE_MAX, Math.max(TITLES_SHARE_MIN, share));

const readStoredTitlesShare = (): number => {
  try {
    const stored = Number(localStorage.getItem(TITLES_SHARE_STORAGE_KEY));
    return stored > 0 ? clampTitlesShare(stored) : TITLES_SHARE_DEFAULT;
  } catch {
    return TITLES_SHARE_DEFAULT;
  }
};

const storeTitlesShare = (share: number) => {
  try {
    localStorage.setItem(TITLES_SHARE_STORAGE_KEY, share.toFixed(3));
  } catch {
    // Blocked site data: the split holds for this session only.
  }
};

/** A wide screen shows the titles beside the text; a phone shows the text
 * alone and the titles when asked. */
const WIDE_SCREEN_QUERY = "(min-width: 1024px)";

const wideScreenQuery = (): MediaQueryList | null => {
  try {
    return window.matchMedia(WIDE_SCREEN_QUERY);
  } catch {
    return null;
  }
};

const opensWithTitles = () => wideScreenQuery()?.matches ?? false;

/** A line outside any repeated passage, or in one not yet returned to, is in
 * the first round. */
const FIRST_ROUND = 1;

/** Shortcuts drive the liturgy, so they stay off fields and off the controls:
 * Space on "Next" or the token box must do what that control does. Lines are
 * buttons too; those keep the shortcuts. */
const allowsShortcut = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return false;
  if (target.isContentEditable) return false;
  if (target.closest("[data-line]")) return true;
  if (target.closest("[role='separator']")) return false;
  if (target.closest("button, a, [role='button']")) return false;
  return true;
};

/** A line's learned play time, as its badge reads: seconds to a tenth, or
 * minutes and seconds for a long one. */
const formatPlayTime = (ms: number) => {
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const total = Math.round(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
};

/**
 * The live line's hold under autoplay, running down as a bar beneath it, as
 * the autoplay test shows it. It reads the same start and time the autoplay
 * clock does, so the bar fills the moment the room is moved on. While the
 * clock waits (fresh play times, the yigchung) the bar waits too.
 */
const AutoplayProgress = ({
  startedAt,
  duration,
  running,
}: {
  startedAt: number;
  duration: number;
  running: boolean;
}) => {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!running) {
      setElapsed(0);
      return;
    }
    let frame = 0;
    const tick = () => {
      setElapsed(Math.min(duration, performance.now() - startedAt));
      frame = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(frame);
  }, [startedAt, duration, running]);
  const progress = duration > 0 ? Math.max(0, elapsed) / duration : 0;
  return (
    <span
      data-autoplay-progress=""
      className="mt-1.5 flex items-center gap-2 font-sans"
    >
      <span
        role="progressbar"
        aria-label="Autoplay: time spent on this line"
        aria-valuemin={0}
        aria-valuemax={Math.round(duration)}
        aria-valuenow={Math.round(Math.max(0, elapsed))}
        className="block h-1 flex-1 overflow-hidden rounded-full bg-[#2c2c2e]"
      >
        <span
          className="block h-full rounded-full bg-[#30d158]"
          style={{ width: `${Math.min(1, progress) * 100}%` }}
        />
      </span>
      <span className="shrink-0 text-[11px] text-[#aeaeb2] tabular-nums">
        {formatPlayTime(Math.max(0, elapsed))} / {formatPlayTime(duration)}
      </span>
    </span>
  );
};

/**
 * How many rounds autoplay recites a passage - counted as the Return's badge
 * counts, from 1 - and how many Returns that leaves to take. It stands on a row
 * of its own, apart from the Return and in quieter colours, so setting the
 * count is never a tap on the Return itself.
 */
const ReturnPlan = ({
  label,
  planned,
  left,
  onChange,
}: {
  label: string;
  planned: number;
  left: number;
  onChange: (rounds: number) => void;
}) => {
  const stepClass =
    "size-9 shrink-0 touch-manipulation cursor-pointer rounded-md bg-[#2c2c2e] text-lg leading-none font-semibold text-[#f2f2f7] select-none hover:bg-[#3a3a3c] disabled:cursor-default disabled:opacity-40";
  return (
    <div
      role="group"
      aria-label={`Autoplay rounds: ${label}`}
      data-return-plan=""
      className="mt-1 flex basis-full items-center gap-2 font-sans text-sm text-[#8e8e93]"
    >
      <span>Autoplay rounds</span>
      <button
        type="button"
        aria-label="One round fewer"
        disabled={planned <= FIRST_ROUND}
        onClick={() => onChange(planned - 1)}
        className={stepClass}
      >
        −
      </button>
      <span
        data-planned-rounds=""
        className="min-w-[1.5rem] text-center font-semibold text-[#f2f2f7] tabular-nums"
      >
        {planned}
      </span>
      <button
        type="button"
        aria-label="One round more"
        disabled={planned >= MAX_PLANNED_ROUNDS}
        onClick={() => onChange(planned + 1)}
        className={stepClass}
      >
        +
      </button>
      {planned > FIRST_ROUND ? (
        <span
          data-returns-left=""
          className={`ml-1 rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${
            left > 0 ? "bg-[#1c3a24] text-[#30d158]" : "bg-[#1c1c1e]"
          }`}
        >
          {left > 0 ? `${left} return${left === 1 ? "" : "s"} left` : "done"}
        </span>
      ) : null}
    </div>
  );
};

/** Yigchung is drawn small and in its own colour, as a printed liturgy sets it
 * apart from the verse, so the operator reads past it at a glance. */
const YIGCHUNG_TEXT = "text-[0.72em] text-[#c9a063]";

/**
 * A line's text with any yigchung inside it set apart. The marks are offsets
 * into the library's text, so they are only laid over a line whose text is the
 * same length; anything else is shown plain rather than cut in the wrong place.
 */
const LineContent = ({
  content,
  yigchung,
}: {
  content: string;
  yigchung?: SegmentYigchung;
}) => {
  if (!yigchung || yigchung.full || content.length !== yigchung.length) {
    return <>{content}</>;
  }
  const parts: { text: string; mark: boolean }[] = [];
  let at = 0;
  yigchung.ranges.forEach(({ start, end }) => {
    if (start > at) parts.push({ text: content.slice(at, start), mark: false });
    parts.push({ text: content.slice(start, end), mark: true });
    at = end;
  });
  if (at < content.length) {
    parts.push({ text: content.slice(at), mark: false });
  }
  return (
    <>
      {parts.map((part, index) =>
        part.mark ? (
          <span key={index} data-yigchung="" className={YIGCHUNG_TEXT}>
            {part.text}
          </span>
        ) : (
          <Fragment key={index}>{part.text}</Fragment>
        ),
      )}
    </>
  );
};

const LiveControlPage = () => {
  const { eventId } = useParams<{ eventId: string }>();

  const [token, setToken] = useState<string | null>(() => readStoredToken());
  const [tokenDraft, setTokenDraft] = useState("");
  const [showTokenBox, setShowTokenBox] = useState(() => !readStoredToken());
  /** The work the operator is on: one found by title or pasted by id. The page
   * opens on the one last opened in this browser, so a reload mid-puja lands
   * back on it. */
  const [sourceTextId, setSourceTextId] = useState(
    () => readRecentTexts()[0]?.textId ?? "",
  );
  /** What the operator has typed to find a text: a title, or an edition id. */
  const [textQuery, setTextQuery] = useState("");
  const [debouncedTextQuery] = useDebounce(textQuery.trim(), 300);
  const [recentTexts, setRecentTexts] = useState(() => readRecentTexts());
  /** The edition on screen, which leads the room. */
  const [driverTextId, setDriverTextId] = useState("");
  /** Editions moved by the same key press, in the order they were ticked. */
  const [followed, setFollowed] = useState<string[]>([]);
  /**
   * Every edition's lines, fetched as soon as it is read or ticked. Advancing
   * never waits on the network: by then each edition's lines are already here.
   */
  const [lines, setLines] = useState<Record<string, OperatorSegment[]>>({});
  const [preparing, setPreparing] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  /**
   * When the line on screen went out to the room, on this page's clock. Under
   * autoplay it is the backend's own start for the step, carried over to this
   * clock, so the time bar runs with the backend's hold.
   */
  const [lineStartedAt, setLineStartedAt] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  /** A message the operator closed. It stays closed until the page shows a
   * different one, or the problem goes away and comes back. */
  const [dismissedError, setDismissedError] = useState<string | null>(null);
  /** The liturgy and section titles, shown or put away with one button. */
  const [navOpen, setNavOpen] = useState(() => opensWithTitles());
  // A window widened into the wide-screen layout gets the titles beside the
  // text, and one narrowed to a phone's width gives the text the room. Within
  // either, the operator's own show or hide stands.
  useEffect(() => {
    const query = wideScreenQuery();
    if (!query?.addEventListener) return;
    const onChange = (change: MediaQueryListEvent) =>
      setNavOpen(change.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);
  /** An upright phone's split between the titles and the lines. */
  const [titlesShare, setTitlesShare] = useState(() => readStoredTitlesShare());
  /** Adding a text and ticking editions is setup, not driving: on a phone it
   * stays folded so the titles get the height. */
  const [setupOpen, setSetupOpen] = useState(false);
  const [textScale, setTextScale] = useState(() =>
    readStoredScale(TEXT_SCALE_STORAGE_KEY),
  );
  const [titlesScale, setTitlesScale] = useState(() =>
    readStoredScale(TITLES_SCALE_STORAGE_KEY, LEGACY_TITLES_SCALE_STORAGE_KEY),
  );
  const [returnCounts, updateReturnCounts] = useStoredCounts(
    returnCountsStorageKey(eventId),
  );
  const [plannedRounds, updatePlannedRounds] = useStoredCounts(
    plannedRoundsStorageKey(eventId),
  );
  /** Rounds autoplay recites a passage in: once, unless set otherwise. */
  const plannedRoundsOf = (key: string) => plannedRounds[key] ?? FIRST_ROUND;
  /** Sets how many rounds a passage is recited; once clears it. */
  const planRounds = (key: string, rounds: number) =>
    updatePlannedRounds((current) => {
      const next = { ...current };
      const clamped = Math.min(
        MAX_PLANNED_ROUNDS,
        Math.max(FIRST_ROUND, rounds),
      );
      if (clamped > FIRST_ROUND) next[key] = clamped;
      else delete next[key];
      return next;
    });
  /**
   * Rounds the operator has begun that the room has not yet taken. The badge
   * counts only what the room took, so a return with no token, one the room
   * refused, or one overtaken by the next move before it went out, never moves
   * it - but the moves made in the meantime are still sent in the new round, and
   * the first of them the room takes settles it.
   */
  const [requestedRounds, setRequestedRounds] = useState<
    Record<string, number>
  >({});
  useEffect(() => {
    setRequestedRounds({});
  }, [eventId]);
  /** The round the room has taken for a passage. */
  const acceptedRound = (key: string) => returnCounts[key] ?? FIRST_ROUND;
  /** The round a passage is being recited in: begun, or else taken. */
  const roundOf = useCallback(
    (key: string) =>
      Math.max(
        returnCounts[key] ?? FIRST_ROUND,
        requestedRounds[key] ?? FIRST_ROUND,
      ),
    [returnCounts, requestedRounds],
  );
  /** Returns still to take at a button: one per planned round not yet begun. */
  const returnsLeft = (key: string) =>
    Math.max(0, plannedRoundsOf(key) - roundOf(key));
  /** The room took a position in this round of the passage. */
  const settleRound = (key: string, round: number) => {
    if (round > acceptedRound(key)) {
      updateReturnCounts((current) =>
        round > (current[key] ?? FIRST_ROUND)
          ? { ...current, [key]: round }
          : current,
      );
    }
    setRequestedRounds((current) => {
      if ((current[key] ?? 0) > round) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  };
  /**
   * Every move is numbered as it is sent, and each passage remembers the move it
   * was reset after. A move sent before the reset may still be on the wire when
   * the operator resets; the room taking it later must not put the old count
   * back.
   */
  const moveSequenceRef = useRef(0);
  const cueMoveRef = useRef(new WeakMap<PositionToPublish, number>());
  const resetAfterMoveRef = useRef<Record<string, number>>({});
  /** Back to the first round, for the next puja. */
  const resetReturn = (key: string) => {
    resetAfterMoveRef.current[key] = moveSequenceRef.current;
    updateReturnCounts((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });
    setRequestedRounds((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });
  };

  const listRef = useRef<HTMLDivElement | null>(null);
  /** The titles-and-lines area the divider splits. */
  const splitRef = useRef<HTMLDivElement | null>(null);
  const sectionListRef = useRef<HTMLDivElement | null>(null);
  /** Editions already asked for, so nothing is fetched twice. */
  const requestedRef = useRef<Set<string>>(new Set());

  /**
   * The controller's own line to the room. Moves go over it while it is open,
   * and it says where the room actually is and what autoplay is doing.
   */
  const socket = useRecitationSocket(eventId, token);
  const socketRef = useRef(socket);
  socketRef.current = socket;
  /** A move goes over the socket when it is open; by HTTP when it is not, or
   * when the socket lost it on the way. A move the room refused is not sent
   * again another way. */
  const sendMove = useCallback<SendMove>(async (event, key, positions) => {
    const viaSocket = socketRef.current.sendMove(positions);
    if (viaSocket) {
      const result = await viaSocket;
      if (result.ok || !result.lost) return result;
    }
    return publishMove(event, key, positions);
  }, []);

  /** What to do when the room takes a position; set once the lines are known. */
  const onAcceptedRef = useRef<(cue: PositionToPublish) => void>(() => {});
  const {
    state,
    notice,
    lastSent,
    publish: publishCues,
    clearNotice,
  } = usePositionPublisher(
    eventId,
    token,
    (cue) => onAcceptedRef.current(cue),
    sendMove,
  );
  /** Publishes one move, numbered so an acceptance can be told apart from a
   * later reset. */
  const publish = useCallback(
    (cues: PositionToPublish[]) => {
      if (cues.length > 0) {
        moveSequenceRef.current += 1;
        const move = moveSequenceRef.current;
        cues.forEach((cue) => cueMoveRef.current.set(cue, move));
      }
      publishCues(cues);
    },
    [publishCues],
  );

  /** With no text open, finding one is the only way in, so a phone shows that
   * box rather than folding it two taps away. */
  const needsText = !sourceTextId;
  /** Whether the titles are on screen. */
  const titlesUnfolded = navOpen || needsText;
  const setupUnfolded = setupOpen || needsText;

  // A text and its translations are separate library texts, each with its own
  // segment ids, so the room has to be told about every one it should follow.
  const { data: editionData, error: editionsError } = useQuery({
    queryKey: ["live-control-editions", sourceTextId],
    queryFn: () => fetchTextEditions(sourceTextId),
    enabled: Boolean(sourceTextId),
    refetchOnWindowFocus: false,
  });

  // A remembered text is named once the library says what it is, so the list
  // reads as titles rather than ids.
  useEffect(() => {
    const title = editionData?.text.title;
    if (!title || !sourceTextId) return;
    setRecentTexts((current) => {
      const at = current.findIndex((item) => item.textId === sourceTextId);
      if (at < 0 || current[at].title === title) return current;
      const next = current.map((item, index) =>
        index === at ? { ...item, title } : item,
      );
      storeRecentTexts(next);
      return next;
    });
  }, [editionData, sourceTextId]);

  /** The work itself first, then every translation of it. */
  const editions: TextEdition[] = useMemo(
    () => (editionData ? [editionData.text, ...editionData.editions] : []),
    [editionData],
  );

  /**
   * Loads an edition's lines once and keeps them. Everything on screen or being
   * followed is fetched when it is picked, so a move only reads memory.
   */
  const prepare = useCallback(async (edition: TextEdition) => {
    const { textId } = edition;
    if (!textId || requestedRef.current.has(textId)) return;
    requestedRef.current.add(textId);
    setPreparing((current) => [...current, textId]);
    try {
      const language = toWireLanguage(edition.language);
      const details = await fetchRecitationDetails(textId, language);
      setLines((current) => ({
        ...current,
        [textId]: toOperatorSegments(details, language),
      }));
    } catch (error) {
      // Not held, so ticking it again tries afresh.
      requestedRef.current.delete(textId);
      setFollowed((current) => current.filter((id) => id !== textId));
      setLoadError(
        getApiErrorMessage(error, `Could not load ${edition.title || textId}.`),
      );
    } finally {
      setPreparing((current) => current.filter((id) => id !== textId));
    }
  }, []);

  /**
   * Move to another work. The editions of it are a fetch away, so the one on
   * screen stands down now rather than when they arrive: until then there is
   * nothing to drive, and Next cannot publish a line of the work the operator
   * has just left.
   */
  const openWork = useCallback(
    (textId: string) => {
      if (!textId || textId === sourceTextId) return;
      setSourceTextId(textId);
      setDriverTextId("");
      setFollowed([]);
      setCurrentIndex(-1);
      setLoadError(null);
    },
    [sourceTextId],
  );

  // A new work brings its own editions: the work itself leads, and its Tibetan,
  // English and Chinese translations follow from the start, so readers of those
  // move with the room without the operator ticking anything. Each is fetched
  // now, so the first move already has their lines.
  useEffect(() => {
    if (editions.length === 0) return;
    const [lead, ...translations] = editions;
    const following = translations.filter(followedByDefault);
    setDriverTextId(lead.textId);
    setFollowed(following.map((edition) => edition.textId));
    setCurrentIndex(-1);
    setLoadError(null);
    [lead, ...following].forEach((edition) => void prepare(edition));
  }, [editions, prepare]);

  // One identity per edition's lines, so the outline is not rebuilt on every
  // render of the page.
  const driverLines = useMemo(
    () => lines[driverTextId] ?? [],
    [lines, driverTextId],
  );
  const isPreparingDriver = preparing.includes(driverTextId);
  const driverEdition = editions.find(
    (edition) => edition.textId === driverTextId,
  );

  // The outline of the edition on screen, so the operator can go to a section
  // rather than scrolling for it - the section list of the puja controller. It
  // belongs to this edition alone: each edition is its own library text with its
  // own segment ids, so a translation's outline anchors on different segments.
  const { data: tocSections } = useQuery({
    queryKey: ["live-control-sections", driverTextId, driverEdition?.language],
    queryFn: () => fetchEditionSections(driverTextId, driverEdition?.language),
    enabled: Boolean(driverTextId),
    refetchOnWindowFocus: false,
    retry: false,
    staleTime: 1000 * 60 * 20,
  });

  // The edition's yigchung - instructions for whoever leads, read silently - so
  // Next can step over them and the lines can show them apart. Without it every
  // line is recited, which is how the page behaved before.
  const { data: yigchungs, isPending: yigchungsPending } = useQuery({
    queryKey: ["live-control-yigchungs", driverTextId],
    // Next waits on this, so a library that does not answer is given up on
    // rather than holding the operator: every line is then recited.
    queryFn: () =>
      Promise.race([
        fetchEditionYigchungs(driverTextId),
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error("yigchung lookup timed out")),
            YIGCHUNG_WAIT_MS,
          ),
        ),
      ]),
    enabled: Boolean(driverTextId),
    refetchOnWindowFocus: false,
    retry: false,
    staleTime: 1000 * 60 * 20,
  });
  // How long each line of the edition on screen takes to recite, learned by the
  // backend from earlier pujas: what autoplay paces the room by.
  const { data: playTimes, refetch: refetchPlayTimes } = useQuery({
    queryKey: ["live-control-play-times", driverTextId],
    queryFn: () => fetchSegmentPlayTimes(driverTextId),
    enabled: Boolean(driverTextId),
    refetchOnWindowFocus: false,
    retry: false,
  });
  /**
   * A timed move the room took has taught the backend how long the line before
   * it was held, so the times are read again - once the operator pauses, not on
   * every press of a quick run of them. Joins a read already on its way rather
   * than cancelling it: autoplay's start waits on that one.
   */
  const playTimesRefreshRef = useRef<number | undefined>(undefined);
  const refreshPlayTimesSoon = () => {
    window.clearTimeout(playTimesRefreshRef.current);
    playTimesRefreshRef.current = window.setTimeout(() => {
      void refetchPlayTimes({ cancelRefetch: false });
    }, PLAY_TIMES_REFRESH_DELAY_MS);
  };
  useEffect(() => () => window.clearTimeout(playTimesRefreshRef.current), []);
  // Another edition's times are not this one's: a refresh still waiting is
  // dropped with the edition it was for.
  useEffect(() => {
    window.clearTimeout(playTimesRefreshRef.current);
  }, [driverTextId]);

  /** Until the marks are in, a move cannot tell instruction from verse. */
  const awaitingYigchungs = Boolean(driverTextId) && yigchungsPending;

  /** A line that is instruction from end to end, which Next and Previous pass. */
  const isYigchungLine = useCallback(
    (index: number) => {
      const id = driverLines[index]?.id;
      return Boolean(id && yigchungs?.[id]?.full);
    },
    [driverLines, yigchungs],
  );

  /** Where each line sits, so a section's anchor becomes a position to move to. */
  const indexBySegmentId = useMemo(() => {
    const positions = new Map<string, number>();
    driverLines.forEach((segment, index) => {
      if (!positions.has(segment.id)) positions.set(segment.id, index);
    });
    return positions;
  }, [driverLines]);

  /**
   * The sections as the sidebar draws them, each with the line it goes to.
   * A section whose anchor is not among these lines - nothing resolved under the
   * heading, or the recitation does not carry that segment - keeps its place in
   * the outline but cannot be moved to.
   */
  const sections: (TocEntry & { lineIndex: number })[] = useMemo(
    () =>
      (tocSections ?? []).map((section) => ({
        ...section,
        lineIndex: section.segmentId
          ? (indexBySegmentId.get(section.segmentId) ?? -1)
          : -1,
      })),
    [tocSections, indexBySegmentId],
  );

  /** The section being recited: the last one that starts at or before this line. */
  const activeSectionId = useMemo(() => {
    if (currentIndex < 0) return null;
    const reached = sections.filter(
      (section) => section.lineIndex >= 0 && section.lineIndex <= currentIndex,
    );
    return reached.length > 0 ? reached[reached.length - 1].id : null;
  }, [sections, currentIndex]);

  /**
   * The last line of each section: the line before the next section begins, or
   * the last of the text. Yigchung at its tail is not recited, so a section is
   * finished once its last recited line is reached.
   */
  const sectionLastLine = useMemo(() => {
    const starts = sections
      .map((section) => section.lineIndex)
      .filter((index) => index >= 0);
    const ends = new Map<string, number>();
    sections.forEach((section) => {
      if (section.lineIndex < 0) return;
      const nextStart = starts
        .filter((index) => index > section.lineIndex)
        .reduce((lowest, index) => Math.min(lowest, index), Infinity);
      let end = Math.min(nextStart - 1, driverLines.length - 1);
      while (end > section.lineIndex && isYigchungLine(end)) end -= 1;
      ends.set(section.id, end);
    });
    return ends;
  }, [sections, driverLines.length, isYigchungLine]);

  /**
   * Where the operator last was in each section, by edition, so a section left
   * partway can be picked up again. Each edition is its own library text with
   * its own sections, so one edition's places say nothing about another's.
   */
  const [sectionPositions, setSectionPositions] = useState<
    Record<string, number>
  >({});
  const sectionPositionKey = (sectionId: string) =>
    `${driverTextId}:${sectionId}`;
  useEffect(() => {
    if (!activeSectionId || currentIndex < 0 || !driverTextId) return;
    const key = `${driverTextId}:${activeSectionId}`;
    setSectionPositions((current) =>
      current[key] === currentIndex
        ? current
        : { ...current, [key]: currentIndex },
    );
  }, [activeSectionId, currentIndex, driverTextId]);

  /**
   * The line to resume a section at: one it was left on partway, away from the
   * section being recited. A section left at its start has nothing to resume -
   * its title goes there - and one taken to its end is done.
   */
  const resumeLineFor = (section: TocEntry & { lineIndex: number }) => {
    if (section.lineIndex < 0 || section.id === activeSectionId) return null;
    const last = sectionPositions[sectionPositionKey(section.id)];
    const end = sectionLastLine.get(section.id);
    if (last === undefined || end === undefined) return null;
    if (last <= section.lineIndex || last >= end) return null;
    return last;
  };

  // Keep the live section in view, as the line list does: a long outline scrolls
  // past the operator's place otherwise. An element in a folded panel has no box
  // to scroll, so every move made while the titles were away was a no-op:
  // unfolding runs this again, or the peek opens where the outline was left.
  useEffect(() => {
    if (!activeSectionId) return;
    sectionListRef.current
      ?.querySelector('[data-section-active="true"]')
      ?.scrollIntoView({ block: "nearest" });
  }, [activeSectionId, titlesUnfolded]);

  /** Teleprompter scroll: keep the live line in a band near the upper third,
   * with lookahead below, and only when it has drifted out of that band - so
   * peeking ahead between moves is never fought. */
  const scrollLineIntoBand = (index: number) => {
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

  /**
   * Each edition's lines by the recitation row they came from, so a move can be
   * matched row for row. Position in the array will not do: a row an edition has
   * no recitation for is not among its lines at all, and from there on its
   * positions run one short of the edition being read - one move would then
   * publish a different logical line to each.
   */
  const linesByRow = useMemo(() => {
    const byText: Record<
      string,
      Map<number, { id: string; index: number }>
    > = {};
    Object.entries(lines).forEach(([textId, segments]) => {
      const rows = new Map<number, { id: string; index: number }>();
      segments.forEach((segment, index) => {
        if (!rows.has(segment.row))
          rows.set(segment.row, { id: segment.id, index });
      });
      byText[textId] = rows;
    });
    return byText;
  }, [lines]);

  /**
   * One move, as every edition being followed sees it - the same recitation row,
   * each with its own segment id and its own line number within that edition. An
   * edition that does not carry the row has nothing to send for this move.
   */
  /** The repeated passages of the edition on screen, for the round of a line. */
  const passages = useMemo(() => returnPassages(driverLines), [driverLines]);
  const roundForLine = useCallback(
    (index: number) => {
      const passage = passageAt(passages, index);
      return passage ? roundOf(passage.key) : FIRST_ROUND;
    },
    [passages, roundOf],
  );

  // A position the room took settles the round of the passage it is in - the
  // badge follows the room, not the button.
  onAcceptedRef.current = (cue) => {
    if (cue.textId !== driverTextId) return;
    if (driverLines[cue.index]?.id !== cue.segmentId) return;
    const taken = cueMoveRef.current.get(cue);
    // Only a move carrying how long the last line was held teaches the backend
    // anything; autoplay's own moves never carry it.
    if (cue.elapsedMs !== undefined && !cue.autoplay) refreshPlayTimesSoon();
    const passage = passageAt(passages, cue.index);
    if (!passage) return;
    // Sent before the count was reset: the reset stands.
    const move = taken ?? Infinity;
    if (move <= (resetAfterMoveRef.current[passage.key] ?? 0)) return;
    settleRound(passage.key, cue.roundNumber);
  };

  /** Every edition is in the same round as the one on screen: one recitation. */
  const cuesForLine = useCallback(
    (index: number, round?: number): PositionToPublish[] => {
      const driving = lines[driverTextId]?.[index];
      if (!driving) return [];
      const roundNumber = round ?? roundForLine(index);
      const cues: PositionToPublish[] = [
        {
          textId: driverTextId,
          segmentId: driving.id,
          index,
          roundNumber,
        },
      ];
      followed.forEach((textId) => {
        if (textId === driverTextId) return;
        const match = linesByRow[textId]?.get(driving.row);
        if (match) {
          cues.push({
            textId,
            segmentId: match.id,
            index: match.index,
            roundNumber,
          });
        }
      });
      return cues;
    },
    [lines, linesByRow, followed, driverTextId, roundForLine],
  );

  /**
   * The line the room is on: when the operator arrived at it, and whether
   * autoplay is what put them there. Written by `jump` alone, which is the
   * moment of arrival - deliberately not read off `lineStartedAt`, which
   * autoplay restarts mid-line to pace its own hold. Measuring from that would
   * under-report every line the operator took back by hand after starting
   * autoplay on it.
   *
   * Cleared whenever the page is on no line, which is how opening another work
   * or reading another edition drops a hold that is no longer anybody's.
   */
  const heldLineRef = useRef<{
    index: number;
    enteredAt: number;
    byAutoplay: boolean;
  } | null>(null);
  if (currentIndex < 0) heldLineRef.current = null;

  /** Whether autoplay is meant to be running, for callbacks made between
   * renders. Kept in step with the `autoplay` state below. */
  const autoplayRef = useRef(false);
  /** Hands the backend a new plan from a line: how a move made by hand while
   * autoplay runs reaches the room. Set with the autoplay code below. */
  const autoplayFromRef = useRef<(index: number, round?: number) => void>(
    () => {},
  );
  /** Hands the backend the same plan again, rebuilt, without sending the line
   * the room is on anew: for a change of rounds or editions mid-line. */
  const replanRef = useRef<() => void>(() => {});

  // Yigchung is not recited, so a move passes over it to the next line the room
  // says aloud. Tapping it still goes there: that is the operator's own choice.
  /** The line one move lands on from `from`, or `from` when there is none. */
  const landingFrom = useCallback(
    (from: number, delta: number) => {
      let next = from + delta;
      while (next >= 0 && next < driverLines.length && isYigchungLine(next)) {
        next += delta;
      }
      return next < 0 || next >= driverLines.length ? from : next;
    },
    [driverLines.length, isYigchungLine],
  );

  /**
   * The Return buttons reached from line `from` without reciting another line:
   * the one under it, and any under yigchung passed over on the way on.
   */
  const returnsReachedFrom = useCallback(
    (from: number) => {
      const next = landingFrom(from, 1);
      const upTo = next === from ? driverLines.length : next;
      const reached: { key: string; index: number }[] = [];
      for (let at = from; at < upTo; at += 1) {
        const button = returnButtonForLine(driverLines[at].id, driverLines);
        if (button) reached.push(button);
      }
      return reached;
    },
    [driverLines, landingFrom],
  );

  /**
   * Whether moving from line `from` to `to` follows on in recitation order
   * other than as the very next line, which the backend times by itself: Next
   * over yigchung, or a Return under the line. Either way the line left was
   * recited through, and its hold is its play time.
   */
  const followsOn = useCallback(
    (from: number, to: number, round?: number) =>
      to !== from + 1 &&
      ((to !== from && to === landingFrom(from, 1)) ||
        (round !== undefined &&
          returnsReachedFrom(from).some((button) => button.index === to))),
    [landingFrom, returnsReachedFrom],
  );

  /**
   * Moves to a line. `round` names the round when the move begins a new one.
   * While autoplay runs, the backend is the one moving the room: a move made by
   * hand hands it a new plan from the chosen line instead (see below).
   *
   * The move also carries how long the line it leaves behind was held, which is
   * what the backend records as that line's play time. It is measured here
   * because this is the only place that knows when the operator left the line:
   * the backend can only subtract two request arrivals, and that figure carries
   * the network, its own liveness check and throttle, and the publisher's send
   * pacing - none of which the room spent reciting. `performance.now()` is
   * monotonic, so a clock correction mid-puja cannot distort it either.
   *
   * Nothing is reported for the first move onto a text, or for a line autoplay
   * put the room on: autoplay's hold came from these very figures, so there is
   * no measurement to make.
   */
  const jump = useCallback(
    (index: number, round?: number) => {
      if (index < 0 || index >= driverLines.length) return;
      if (autoplayRef.current) {
        autoplayFromRef.current(index, round);
        return;
      }
      const now = performance.now();
      const held = heldLineRef.current;
      const elapsedMs =
        held && !held.byAutoplay ? Math.round(now - held.enteredAt) : undefined;
      // The line left, row for row in each edition, when this move follows on
      // from it: the backend then times it even though the move is not a step
      // to the very next line.
      const fromRow =
        held && elapsedMs !== undefined && followsOn(held.index, index, round)
          ? driverLines[held.index]?.row
          : undefined;
      const fromIndexIn = (textId: string) =>
        fromRow === undefined
          ? undefined
          : textId === driverTextId
            ? held?.index
            : linesByRow[textId]?.get(fromRow)?.index;
      heldLineRef.current = { index, enteredAt: now, byAutoplay: false };
      setCurrentIndex(index);
      setLineStartedAt(now);
      scrollLineIntoBand(index);
      const cues = cuesForLine(index, round);
      publish(
        elapsedMs !== undefined
          ? cues.map((cue) => {
              const fromIndex = fromIndexIn(cue.textId);
              return {
                ...cue,
                elapsedMs,
                ...(fromIndex === undefined ? {} : { fromIndex }),
              };
            })
          : cues,
      );
    },
    [driverLines, driverTextId, linesByRow, followsOn, publish, cuesForLine],
  );

  // An edition followed from the start, or ticked mid-liturgy, is fetched in
  // the background, and a move made before its lines arrive has nothing to
  // send it. Once they arrive it is sent the line the room is on, so its
  // readers are not a move behind. Editions already sent this line are not
  // posted again: the publisher skips what the room has taken.
  const readyFollowedKey = followed
    .filter((textId) => Boolean(lines[textId]))
    .join("|");
  const latestMoveRef = useRef({ currentIndex, cuesForLine, publish });
  latestMoveRef.current = { currentIndex, cuesForLine, publish };
  useEffect(() => {
    const {
      currentIndex: at,
      cuesForLine: cues,
      publish: send,
    } = latestMoveRef.current;
    if (at < 0 || !readyFollowedKey) return;
    // Under autoplay the backend sends every line: it is given the new edition
    // in a plan of its own rather than one line of it from here.
    if (autoplayRef.current) {
      replanRef.current();
      return;
    }
    send(cues(at));
  }, [readyFollowedKey]);

  // The marks come from the library, apart from the lines, so a move made before
  // they land could publish an instruction to the room. Such a move is held and
  // made once they are in - never dropped, so a press is never lost.
  const [heldMoves, setHeldMoves] = useState<number[]>([]);
  useEffect(() => {
    setHeldMoves([]);
  }, [driverTextId]);
  useEffect(() => {
    if (awaitingYigchungs || heldMoves.length === 0) return;
    const target = heldMoves.reduce(landingFrom, currentIndex);
    setHeldMoves([]);
    if (target !== currentIndex) jump(target);
  }, [awaitingYigchungs, heldMoves, landingFrom, currentIndex, jump]);

  /**
   * A line the operator picked - tapped, a section, Resume or Return. It is
   * where they mean to be, so moves still held for the yigchung are dropped:
   * made after it, they would carry the room past the line just chosen.
   */
  const goTo = (index: number, round?: number) => {
    setHeldMoves((current) => (current.length > 0 ? [] : current));
    jump(index, round);
  };

  /**
   * Return: back to the passage's start, in the next round. A return still on
   * its way to the room counts too - a second return made before the first is
   * taken is the round after it, not the same round sent again.
   */
  const beginNextRound = (key: string, index: number) => {
    const round = roundOf(key) + 1;
    // With no token nothing goes to the room, so no round is begun there.
    if (token) {
      setRequestedRounds((current) => ({ ...current, [key]: round }));
    }
    goTo(index, round);
  };

  const step = useCallback(
    (delta: number) => {
      if (awaitingYigchungs) {
        setHeldMoves((current) => [...current, delta]);
        return;
      }
      const next = landingFrom(currentIndex, delta);
      if (next !== currentIndex) jump(next);
    },
    [awaitingYigchungs, currentIndex, landingFrom, jump],
  );

  /**
   * Autoplay, run by the backend. Pressing Auto lays the puja out from the line
   * on screen - each line with every edition's position and the time it has
   * taken to recite, yigchung passed over, each Return taken for as many rounds
   * as planned - and hands that plan over. From then on the backend moves the
   * room on by itself, whatever this page or the phone it is on does; the page
   * only follows along, from what the backend says of it.
   *
   * The operator can still step in at any time: a move made by hand is a new
   * plan from the line they chose, and a change of rounds or editions is the
   * same plan rebuilt, the line on screen keeping what is left of its time.
   */
  const [autoplay, setAutoplay] = useState(false);
  autoplayRef.current = autoplay;
  const [autoplayNote, setAutoplayNote] = useState<string | null>(null);
  /** Set while a plan is being made and handed over. */
  const [autoplayBusy, setAutoplayBusy] = useState(false);
  /** The plan the backend is running for this page, as the page laid it out. */
  const planRef = useRef<RunningPlan | null>(null);
  /** The backend's autoplay as last heard, from the socket or by asking. */
  const [serverAutoplay, setServerAutoplay] = useState<AutoplayState | null>(
    null,
  );
  /** Counts plan hand-overs, so only the newest one's answer is acted on. */
  const autoplayStartRef = useRef(0);

  /**
   * The plan from line `from`: that line first, `round` naming its round when
   * the move begins a new one. Stops at the end of the text, or at a line with
   * no recorded time - that line is still sent, and the note says why it goes
   * no further.
   */
  const buildPlan = (
    from: number,
    round: number | undefined,
    times: Record<string, number>,
  ): Omit<RunningPlan, "planId"> => {
    const rounds: Record<string, number> = {};
    passages.forEach((passage) => {
      rounds[passage.key] = roundOf(passage.key);
    });
    const firstPassage = passageAt(passages, from);
    if (round !== undefined && firstPassage) rounds[firstPassage.key] = round;
    const steps: RunningPlan["steps"] = [];
    let noTimeAt: number | null = null;
    let at = from;
    while (steps.length < MAX_PLAN_STEPS) {
      const passage = passageAt(passages, at);
      const lineRound =
        at === from && round !== undefined && steps.length === 0
          ? round
          : passage
            ? (rounds[passage.key] ?? FIRST_ROUND)
            : FIRST_ROUND;
      const time = times[driverLines[at]?.id ?? ""];
      const [driving, ...others] = cuesForLine(at, lineRound);
      steps.push({
        lineIndex: at,
        round: lineRound,
        passageKey: passage?.key ?? null,
        // The edition on screen last: the room is left holding it.
        positions: driving ? [...others, driving] : others,
        durationMs:
          time === undefined
            ? MIN_PLAN_STEP_MS
            : Math.min(MAX_PLAN_STEP_MS, Math.max(MIN_PLAN_STEP_MS, time)),
      });
      if (time === undefined) {
        noTimeAt = at;
        break;
      }
      const returnTo = returnsReachedFrom(at).find(
        (button) =>
          plannedRoundsOf(button.key) - (rounds[button.key] ?? FIRST_ROUND) > 0,
      );
      if (returnTo) {
        rounds[returnTo.key] = (rounds[returnTo.key] ?? FIRST_ROUND) + 1;
        at = returnTo.index;
        continue;
      }
      const next = landingFrom(at, 1);
      if (next === at) break;
      at = next;
    }
    moveSequenceRef.current += 1;
    return { steps, noTimeAt, move: moveSequenceRef.current };
  };

  /** Lines the page up with what the backend's autoplay says. */
  const followAutoplay = (next: AutoplayState) => {
    setServerAutoplay(next);
    const plan = planRef.current;
    if (!plan || next.planId !== plan.planId) return;
    if (next.status === "stopped") {
      planRef.current = null;
      setAutoplay(false);
      autoplayRef.current = false;
      if (next.reason === "finished" && plan.noTimeAt !== null) {
        setAutoplayNote(
          `Autoplay stopped at line ${plan.noTimeAt + 1}: it has not been recited here before, so there is no time to hold it for. Move on by hand and it will be learned.`,
        );
      } else if (next.reason === "failed") {
        setAutoplayNote(
          "Autoplay stopped: the server could not send a line to the room. Start it again, or move on by hand.",
        );
      }
      return;
    }
    const step = plan.steps[next.step];
    if (!step || next.stepStartedAtMs === null) return;
    if (plan.lastStep !== undefined && next.step < plan.lastStep) return;
    plan.lastStep = next.step;
    const now = performance.now();
    heldLineRef.current = {
      index: step.lineIndex,
      enteredAt: now,
      byAutoplay: true,
    };
    setCurrentIndex(step.lineIndex);
    setLineStartedAt(
      now - Math.max(0, next.serverTimeMs - next.stepStartedAtMs),
    );
    scrollLineIntoBand(step.lineIndex);
    // The room is on it: its passage's round is settled, unless the count was
    // reset after this plan was made.
    if (
      step.passageKey &&
      plan.move > (resetAfterMoveRef.current[step.passageKey] ?? 0)
    ) {
      settleRound(step.passageKey, step.round);
    }
  };
  const followAutoplayRef = useRef(followAutoplay);
  followAutoplayRef.current = followAutoplay;

  // The backend's word, as it comes over the socket.
  useEffect(() => {
    if (socket.autoplay) followAutoplayRef.current(socket.autoplay);
  }, [socket.autoplay]);

  // Without the socket, the backend is asked instead - often enough for the
  // time bar and the line on screen to keep up.
  const autoplayWatched = autoplay || serverAutoplay?.status === "running";
  useEffect(() => {
    if (!eventId || !token || socket.status === "open") return;
    if (!autoplayWatched) return;
    let cancelled = false;
    const poll = async () => {
      const read = await fetchAutoplayState(eventId, token);
      if (!cancelled && read) followAutoplayRef.current(read);
    };
    const timer = window.setInterval(poll, AUTOPLAY_POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [eventId, token, socket.status, autoplayWatched]);

  // Opened, or reopened, while the backend is already running a plan - a
  // reload mid-puja, another controller: it is shown, and can be paused.
  useEffect(() => {
    if (!eventId || !token) return;
    let cancelled = false;
    void fetchAutoplayState(eventId, token).then((read) => {
      if (!cancelled && read) followAutoplayRef.current(read);
    });
    return () => {
      cancelled = true;
    };
  }, [eventId, token]);

  /** Autoplay running on the backend that this page did not start. */
  const remoteAutoplay =
    !autoplay &&
    serverAutoplay?.status === "running" &&
    serverAutoplay.planId !== planRef.current?.planId;

  /**
   * Makes a plan and hands it to the backend. `keepFirstFor` is how long the
   * room has been on the first line already, when it is not to be sent again.
   */
  const handOver = async (
    from: number,
    round: number | undefined,
    keepFirstFor?: number,
  ) => {
    if (!eventId || !token) return;
    autoplayStartRef.current += 1;
    const handOverId = autoplayStartRef.current;
    setAutoplay(true);
    autoplayRef.current = true;
    setAutoplayBusy(true);
    setAutoplayNote(null);
    // Times learned since the page opened count too.
    const fresh = await refetchPlayTimes({ cancelRefetch: false }).catch(
      () => null,
    );
    if (handOverId !== autoplayStartRef.current) return;
    const plan = buildPlan(from, round, fresh?.data ?? playTimes ?? {});
    if (plan.noTimeAt === from && keepFirstFor === undefined) {
      setAutoplay(false);
      autoplayRef.current = false;
      setAutoplayBusy(false);
      setAutoplayNote(
        `Autoplay cannot start at line ${from + 1}: it has not been recited here before, so there is no time to hold it for. Move on by hand and it will be learned.`,
      );
      return;
    }
    if (keepFirstFor === undefined) {
      heldLineRef.current = {
        index: from,
        enteredAt: performance.now(),
        byAutoplay: true,
      };
      setCurrentIndex(from);
      setLineStartedAt(performance.now());
      scrollLineIntoBand(from);
    }
    const started = await startAutoplay(
      eventId,
      token,
      plan.steps,
      keepFirstFor === undefined
        ? undefined
        : Math.min(MAX_PLAN_STEP_MS, Math.round(keepFirstFor)),
    );
    if (handOverId !== autoplayStartRef.current) return;
    setAutoplayBusy(false);
    if (!started.ok) {
      planRef.current = null;
      setAutoplay(false);
      autoplayRef.current = false;
      setAutoplayNote(`Autoplay could not start: ${started.message}`);
      return;
    }
    planRef.current = { ...plan, planId: started.state.planId };
    // Followed by the newest render's hand: this one's counts may be stale.
    followAutoplayRef.current(started.state);
  };
  autoplayFromRef.current = (index, round) => {
    setHeldMoves((current) => (current.length > 0 ? [] : current));
    void handOver(index, round);
  };
  replanRef.current = () => {
    if (!autoplayRef.current || currentIndex < 0) return;
    const step = planRef.current?.steps.find(
      (planned) => planned.lineIndex === currentIndex,
    );
    void handOver(
      currentIndex,
      step?.round,
      Math.max(0, performance.now() - lineStartedAt),
    );
  };

  // A change of rounds mid-autoplay is the same plan, rebuilt from here.
  const [planChanges, setPlanChanges] = useState(0);
  useEffect(() => {
    if (planChanges > 0) replanRef.current();
  }, [planChanges]);

  /** Stops the backend's autoplay where it is. */
  const pauseAutoplay = async () => {
    autoplayStartRef.current += 1;
    planRef.current = null;
    setAutoplay(false);
    autoplayRef.current = false;
    setAutoplayBusy(false);
    if (!eventId || !token) return;
    const stopped = await stopAutoplay(eventId, token);
    if (!stopped.ok) {
      setAutoplayNote(
        `Autoplay could not be paused: ${stopped.message} It is still moving the room - press Pause again.`,
      );
      setServerAutoplay((current) =>
        current ? { ...current, status: "running" } : current,
      );
      return;
    }
    setServerAutoplay(stopped.state);
  };

  // The plan names this edition's lines: reading another one ends it. Without
  // the token nothing more can be said to the backend, so the page just lets go.
  const stopForRef = useRef({ eventId, token });
  stopForRef.current = { eventId, token };
  useEffect(() => {
    const wasPlaying = autoplayRef.current;
    autoplayStartRef.current += 1;
    planRef.current = null;
    setAutoplay(false);
    autoplayRef.current = false;
    setAutoplayBusy(false);
    const { eventId: event, token: key } = stopForRef.current;
    if (wasPlaying && event && key) void stopAutoplay(event, key);
  }, [driverTextId]);
  useEffect(() => {
    autoplayStartRef.current += 1;
    planRef.current = null;
    setAutoplay(false);
    autoplayRef.current = false;
    setAutoplayBusy(false);
  }, [token]);

  // Whoever is moving the room, the screen stays on while autoplay runs.
  useWakeLock(autoplay || serverAutoplay?.status === "running");

  const toggleAutoplay = () => {
    if (autoplay || remoteAutoplay) {
      void pauseAutoplay();
      return;
    }
    const from = currentIndex < 0 ? landingFrom(-1, 1) : currentIndex;
    if (from < 0 || from >= driverLines.length) return;
    void handOver(from, undefined);
  };

  // Space / right / down advance, left / up go back: the operator drives without
  // leaving the liturgy, exactly as on the puja controller.
  useEffect(() => {
    const onKeyDown = (keyEvent: KeyboardEvent) => {
      if (!allowsShortcut(keyEvent.target)) return;
      const code = keyEvent.code;
      if (code === "Space" || code === "ArrowRight" || code === "ArrowDown") {
        keyEvent.preventDefault();
        step(1);
      } else if (code === "ArrowLeft" || code === "ArrowUp") {
        keyEvent.preventDefault();
        step(-1);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [step]);

  const saveToken = () => {
    const trimmed = tokenDraft.trim();
    if (!trimmed) return;
    setToken(trimmed);
    storeToken(trimmed);
    setTokenDraft("");
    setShowTokenBox(false);
    clearNotice();
  };

  const forgetToken = () => {
    setToken(null);
    storeToken(null);
    setShowTokenBox(true);
  };

  /** Opens a text by edition id and puts it at the top of this browser's list. */
  const openTextById = (textId: string, title?: string) => {
    openWork(textId);
    setTextQuery("");
    setRecentTexts((current) => {
      const known = current.find((item) => item.textId === textId);
      const next = [
        { textId, title: title ?? known?.title },
        ...current.filter((item) => item.textId !== textId),
      ].slice(0, MAX_RECENT_TEXTS);
      storeRecentTexts(next);
      return next;
    });
  };

  /** What the text box offers: this browser's texts, then the suggested ones. */
  const shortcutIds = [
    ...recentTexts,
    ...SUGGESTED_TEXT_IDS.filter(
      (textId) => !recentTexts.some((item) => item.textId === textId),
    ).map((textId): RecentText => ({ textId })),
  ];
  // A text saved before its title arrived, or a suggestion, is named by the
  // library rather than shown as an id.
  const shortcutTitles = useQueries({
    queries: shortcutIds.map((item) => ({
      queryKey: ["live-control-edition-title", item.textId],
      queryFn: () => fetchEditionTitle(item.textId),
      enabled: !item.title,
      staleTime: Infinity,
      retry: false,
      refetchOnWindowFocus: false,
    })),
  });
  const textShortcuts: RecentText[] = shortcutIds.map((item, index) => ({
    textId: item.textId,
    title: item.title ?? shortcutTitles[index]?.data ?? undefined,
  }));

  /** Reading another edition keeps the one it replaces in the room: it was being
   * sent a moment ago, and its readers should not be left behind by the switch. */
  const {
    data: textMatches,
    isFetching: searchingTexts,
    isSuccess: searchSucceeded,
  } = useQuery({
    queryKey: ["live-control-text-search", debouncedTextQuery],
    queryFn: () => searchTextsByTitle(debouncedTextQuery),
    enabled: debouncedTextQuery.length >= 2,
    staleTime: 1000 * 60,
    refetchOnWindowFocus: false,
  });
  /**
   * An id pasted into the search box opens as it is, as it always could.
   * Edition ids are 21 characters mixing digits and both cases - a run-together
   * title such as "RefugePrayerText" is searched for instead.
   */
  const idShaped = /^[A-Za-z0-9_-]{21}$/.test(textQuery.trim());
  const looksLikeId = (() => {
    const query = textQuery.trim();
    return (
      idShaped &&
      /[0-9]/.test(query) &&
      /[a-z]/.test(query) &&
      /[A-Z]/.test(query)
    );
  })();
  /** Results belong to what is in the box only once its search has run: until
   * then they answer what was typed before. */
  const matchesAreCurrent =
    textQuery.trim() === debouncedTextQuery && !searchingTexts;
  const currentMatches = matchesAreCurrent ? (textMatches ?? []) : [];

  const openFirstMatch = () => {
    const query = textQuery.trim();
    if (!query) return;
    if (looksLikeId) {
      openTextById(query);
      return;
    }
    const first = currentMatches[0];
    if (first) {
      openTextById(first.textId, first.title);
      return;
    }
    // An id that happens to lack a digit or one of the cases still opens once
    // the search has answered that no title matches it - not when it failed.
    if (idShaped && matchesAreCurrent && searchSucceeded) openTextById(query);
  };

  const read = (edition: TextEdition) => {
    const previous = driverTextId;
    setDriverTextId(edition.textId);
    setCurrentIndex(-1);
    setFollowed((current) => {
      const rest = current.filter((id) => id !== edition.textId);
      return previous && previous !== edition.textId && !rest.includes(previous)
        ? [...rest, previous]
        : rest;
    });
    void prepare(edition);
  };

  const toggleFollow = (edition: TextEdition) => {
    if (followed.includes(edition.textId)) {
      setFollowed((current) => current.filter((id) => id !== edition.textId));
      return;
    }
    setFollowed((current) => [...current, edition.textId]);
    void prepare(edition);
  };

  /** The one problem the page is showing, if any. */
  const errorMessage =
    editionsError || loadError || notice || autoplayNote
      ? (loadError ??
        notice ??
        autoplayNote ??
        getApiErrorMessage(editionsError, "Could not load this text."))
      : null;
  // Once the problem is gone, closing it is forgotten: if it comes back, it
  // is news again.
  useEffect(() => {
    if (!errorMessage) setDismissedError(null);
  }, [errorMessage]);

  const followedCount = followed.filter((id) => Boolean(lines[id])).length;

  /**
   * The line the room is on, as the socket last said - in the edition on
   * screen, whichever edition's position it was: a followed one is matched
   * row for row. -1 when the room is on none of these lines, or unknown.
   */
  const roomLineIndex = (() => {
    const room = socket.room;
    if (!room) return -1;
    if (room.textId === driverTextId) {
      return indexBySegmentId.get(room.segmentId) ?? -1;
    }
    const row = room.textId
      ? lines[room.textId]?.find((segment) => segment.id === room.segmentId)
          ?.row
      : undefined;
    if (row === undefined) return -1;
    return driverLines.findIndex((segment) => segment.row === row);
  })();

  /** The backend's current step, when it is this page's plan it is running. */
  const autoplayStepDuration =
    autoplay &&
    serverAutoplay?.status === "running" &&
    serverAutoplay.planId === planRef.current?.planId
      ? (planRef.current?.steps[serverAutoplay.step]?.durationMs ?? null)
      : null;

  /** A change to the plan while autoplay runs - rounds, a reset - is handed
   * over as the same plan, rebuilt. */
  const planChanged = () => {
    if (autoplayRef.current) setPlanChanges((count) => count + 1);
  };

  const statusLabel = !token
    ? "no emit token"
    : state === "live"
      ? "publishing"
      : state === "publishing"
        ? "sending…"
        : state === "error"
          ? "not publishing"
          : "ready";
  const online = state === "live" || state === "publishing";

  /** What an edition has ready, and whether it lines up with what is on screen. */
  const editionNote = (edition: TextEdition) => {
    if (preparing.includes(edition.textId)) return "loading…";
    const loaded = lines[edition.textId];
    if (!loaded) return null;
    const misaligned =
      edition.textId !== driverTextId &&
      driverLines.length > 0 &&
      loaded.length !== driverLines.length;
    return misaligned
      ? `${loaded.length} lines — does not line up`
      : `${loaded.length} lines`;
  };
  /**
   * Dragging the divider: the titles end where the finger is. The drag is
   * followed on the window rather than the handle, so a finger that slides off
   * the thin divider keeps dragging, and the split is saved once it lets go.
   */
  const startDividerDrag = (pointerId: number, startY: number) => {
    const shareAt = (clientY: number) => {
      const box = splitRef.current?.getBoundingClientRect();
      if (!box || box.height <= 0 || !Number.isFinite(clientY)) return null;
      return clampTitlesShare((clientY - box.top) / box.height);
    };
    let latest = shareAt(startY);
    if (latest !== null) setTitlesShare(latest);
    const onMove = (moveEvent: PointerEvent) => {
      // A second finger on the glass neither moves the split nor ends it.
      if (moveEvent.pointerId !== pointerId) return;
      const share = shareAt(moveEvent.clientY);
      if (share === null) return;
      latest = share;
      setTitlesShare(share);
    };
    const onEnd = (endEvent: PointerEvent) => {
      if (endEvent.pointerId !== pointerId) return;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onEnd);
      window.removeEventListener("pointercancel", onEnd);
      if (latest !== null) storeTitlesShare(latest);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onEnd);
    window.addEventListener("pointercancel", onEnd);
  };
  const moveTitlesShare = (delta: number) => {
    const next = clampTitlesShare(titlesShare + delta);
    setTitlesShare(next);
    storeTitlesShare(next);
  };

  const changeTextScale = (scale: number) => {
    if (!TEXT_SCALES.includes(scale)) return;
    setTextScale(scale);
    storeScale(TEXT_SCALE_STORAGE_KEY, scale);
  };
  const changeTitlesScale = (scale: number) => {
    if (!TEXT_SCALES.includes(scale)) return;
    setTitlesScale(scale);
    storeScale(TITLES_SCALE_STORAGE_KEY, scale);
  };
  /** The lines are read at arm's length, from a cushion. The titles start at
   * the same size, and each pane is then sized on its own. */
  const lineClass = "mb-3 px-1.5 py-1.5 leading-[1.6] lg:leading-[1.7]";
  const lineSize =
    "text-[calc(26px*var(--text-scale))] lg:text-[calc(23px*var(--text-scale))]";
  /** Yigchung lines are set smaller than the verse, as a printed liturgy does. */
  const yigchungLineSize =
    "text-[calc(19px*var(--text-scale))] lg:text-[calc(17px*var(--text-scale))]";
  const titleSize =
    "text-[calc(26px*var(--titles-scale))] leading-[1.6] lg:text-[calc(23px*var(--titles-scale))] lg:leading-[1.7]";
  const sizePicker = (
    label: string,
    value: number,
    onChange: (scale: number) => void,
  ) => (
    <select
      aria-label={label}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="cursor-pointer rounded-md border border-[#2c2c2e] bg-[#1c1c1e] px-2 py-1.5 text-[13px] font-semibold text-[#f2f2f7] max-lg:py-1 max-lg:text-base"
    >
      {TEXT_SCALES.map((scale) => (
        <option key={scale} value={scale}>
          {Math.round(scale * 100)}%
        </option>
      ))}
    </select>
  );

  return (
    // A phone must not zoom on a quick second tap of Next, nor reload the page
    // when the operator drags down past the first line mid-puja.
    <div
      data-text-scale={textScale}
      data-titles-scale={titlesScale}
      style={{
        ["--text-scale" as string]: textScale,
        ["--titles-scale" as string]: titlesScale,
      }}
      className="flex h-[100dvh] touch-manipulation flex-col overflow-hidden bg-black font-tibetan-ui text-[#f2f2f7]"
    >
      {/* A wide screen and a phone held sideways put the titles beside the text;
       * a phone held upright puts them above it, on a strip of the height. */}
      <div
        ref={splitRef}
        style={{ ["--titles-share" as string]: titlesShare }}
        className="flex min-h-0 flex-1 flex-row max-lg:portrait:flex-col"
      >
        <aside
          data-titles={titlesUnfolded ? "unfolded" : "folded"}
          className={`w-[320px] shrink-0 flex-col overflow-y-auto overscroll-contain border-r border-[#2c2c2e] px-3 py-4 max-lg:w-[212px] max-lg:px-2 max-lg:py-2 max-lg:portrait:h-[calc(var(--titles-share)*100%)] max-lg:portrait:w-full max-lg:portrait:border-r-0 ${
            titlesUnfolded ? "flex" : "hidden"
          }`}
        >
          <div className="mb-2 flex items-center gap-3 border-b border-[#2c2c2e] px-2 pt-1 pb-4 max-lg:hidden">
            <div className="flex min-w-0 flex-col leading-tight">
              <span className="text-lg font-bold">WeBuddhist</span>
              <span className="mt-0.5 text-[11px] font-medium tracking-[0.11em] text-[#8e8e93] uppercase">
                Live control
              </span>
            </div>
          </div>

          {/* The titles are sized on their own, where they are read. */}
          {sections.length > 0 ? (
            <label className="mx-2 mb-2 flex shrink-0 items-center gap-2 text-[12px] tracking-[0.08em] text-[#8e8e93] uppercase max-lg:mx-1 max-lg:mb-1">
              <span className="mr-auto">Title size</span>
              {sizePicker("Title size", titlesScale, changeTitlesScale)}
            </label>
          ) : null}

          {sections.length > 0 ? (
            <>
              <h2 className="mx-2 mt-5 mb-2 text-[13px] tracking-[0.1em] text-[#8e8e93] uppercase max-lg:mx-1 max-lg:mt-2 max-lg:mb-1">
                Sections
              </h2>
              <div ref={sectionListRef}>
                {sections.map((section) => {
                  const isActive = section.id === activeSectionId;
                  const reachable = section.lineIndex >= 0;
                  const resumeAt = resumeLineFor(section);
                  return (
                    <div
                      key={section.id}
                      className="mb-0.5 flex items-center gap-1"
                    >
                      <button
                        type="button"
                        data-section-active={isActive}
                        disabled={!reachable}
                        title={reachable ? undefined : "No segment to go to"}
                        onClick={() => {
                          goTo(section.lineIndex);
                        }}
                        // Outlines nest deeply - six levels is ordinary - so the
                        // indent stops after three and the titles keep their width.
                        style={{
                          paddingLeft: 12 + Math.min(section.depth, 3) * 12,
                        }}
                        className={`block min-w-0 flex-1 rounded-[7px] py-1.5 pr-3 text-left ${titleSize} [overflow-wrap:anywhere] max-lg:py-1 ${
                          isActive
                            ? "bg-[#e5231c] text-white"
                            : reachable
                              ? "cursor-pointer text-[#8e8e93] hover:bg-[#1a1a1c]"
                              : "cursor-default text-[#5a5a5f]"
                        }`}
                      >
                        {section.title}
                      </button>
                      {/* A section left partway is picked up where it was left,
                       * not from its start. */}
                      {resumeAt !== null ? (
                        <button
                          type="button"
                          aria-label={`Resume ${section.title}`}
                          title={`Resume at line ${resumeAt + 1}`}
                          onClick={() => goTo(resumeAt)}
                          className="shrink-0 cursor-pointer rounded-[7px] border border-[#e5231c] px-2.5 py-1 text-[13px] font-semibold text-[#f2f2f7] hover:bg-[#2c2c2e] max-lg:px-2 max-lg:text-[12px]"
                        >
                          Resume
                        </button>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </>
          ) : null}

          <button
            type="button"
            onClick={() => setSetupOpen((open) => !open)}
            className={`mx-1 mt-2 cursor-pointer rounded-[7px] bg-[#1c1c1e] px-2 py-1.5 text-left text-[12px] font-semibold tracking-[0.08em] text-[#8e8e93] uppercase lg:hidden ${
              needsText ? "hidden" : ""
            }`}
          >
            {setupUnfolded ? "Hide setup" : "Setup"}
          </button>

          {/* Setup stays in the page at every width: on a phone it is folded
           * rather than gone, so the titles above it get the height. */}
          <div
            data-setup={setupUnfolded ? "unfolded" : "folded"}
            className={setupUnfolded ? "block" : "hidden lg:block"}
          >
            {/* A dry run of autoplay in its own tab, on the text open here:
             * it plays on that screen alone and never moves the room. */}
            {eventId ? (
              <a
                href={`${ROUTES.liveAutoplayTest(eventId)}${
                  driverTextId || sourceTextId
                    ? `?text=${encodeURIComponent(driverTextId || sourceTextId)}`
                    : ""
                }`}
                target="_blank"
                rel="noopener noreferrer"
                className="mx-2 mt-4 block text-[13px] text-[#0a84ff] hover:underline max-lg:mx-1 max-lg:mt-2"
              >
                Test autoplay without the room ↗
              </a>
            ) : null}
            <h2 className="mx-2 mt-5 mb-2 text-[13px] tracking-[0.1em] text-[#8e8e93] uppercase max-lg:mx-1 max-lg:mt-2">
              Add a text
            </h2>
            <div className="px-2 max-lg:px-1">
              <input
                type="search"
                aria-label="Search texts"
                value={textQuery}
                onChange={(e) => setTextQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") openFirstMatch();
                  if (e.key === "Escape") setTextQuery("");
                }}
                placeholder="Search by name or paste an id"
                autoComplete="off"
                className="w-full rounded-md border border-[#2c2c2e] bg-[#1c1c1e] px-3 py-2 text-sm text-[#f2f2f7] placeholder:text-[#8e8e93] max-lg:text-base"
              />
            </div>
            {textQuery.trim() ? (
              <div
                role="listbox"
                aria-label="Matching texts"
                className="mx-2 mt-1 max-h-72 overflow-y-auto overscroll-contain rounded-md border border-[#2c2c2e] bg-[#111113] max-lg:mx-1 max-lg:max-h-56"
              >
                {looksLikeId ? (
                  <button
                    type="button"
                    role="option"
                    aria-selected={false}
                    onClick={() => openTextById(textQuery.trim())}
                    className="block w-full cursor-pointer border-b border-[#2c2c2e] px-3 py-2.5 text-left text-[14px] text-[#f2f2f7] hover:bg-[#1c1c1e]"
                  >
                    Open id{" "}
                    <span className="font-mono">{textQuery.trim()}</span>
                  </button>
                ) : null}
                {currentMatches.map((match) => (
                  <button
                    key={match.textId}
                    type="button"
                    role="option"
                    aria-selected={match.textId === sourceTextId}
                    title={match.textId}
                    onClick={() => openTextById(match.textId, match.title)}
                    className="block w-full cursor-pointer px-3 py-2.5 text-left text-[14px] leading-snug text-[#f2f2f7] hover:bg-[#1c1c1e]"
                  >
                    {match.title}
                  </button>
                ))}
                {textQuery.trim().length < 2 ? (
                  <p className="px-3 py-2.5 text-[13px] text-[#8e8e93]">
                    Keep typing…
                  </p>
                ) : !matchesAreCurrent ? (
                  <p className="px-3 py-2.5 text-[13px] text-[#8e8e93]">
                    Searching…
                  </p>
                ) : currentMatches.length === 0 && !looksLikeId ? (
                  <p className="px-3 py-2.5 text-[13px] text-[#8e8e93]">
                    No text by that name.
                  </p>
                ) : null}
              </div>
            ) : null}
            {textShortcuts.length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-1.5 px-2 max-lg:px-1">
                {textShortcuts.map((item) => {
                  const isOpen = item.textId === sourceTextId;
                  return (
                    <button
                      key={item.textId}
                      type="button"
                      title={item.textId}
                      aria-label={`Open ${item.title ?? item.textId}`}
                      aria-pressed={isOpen}
                      onClick={() => openTextById(item.textId)}
                      className={`max-w-full cursor-pointer truncate rounded-full border px-3 py-1.5 text-[13px] ${
                        isOpen
                          ? "border-[#e5231c] bg-[#e5231c]/20 text-white"
                          : "border-[#2c2c2e] bg-[#1c1c1e] text-[#f2f2f7] hover:bg-[#2c2c2e]"
                      }`}
                    >
                      {item.title ?? item.textId}
                    </button>
                  );
                })}
              </div>
            ) : null}

            {editions.length > 0 ? (
              <>
                <h2 className="mx-2 mt-5 mb-1 text-[13px] tracking-[0.1em] text-[#8e8e93] uppercase max-lg:mx-1 max-lg:mt-3">
                  Editions
                </h2>
                <p className="mx-2 mb-2 text-[12px] text-[#8e8e93] max-lg:mx-1">
                  Tick every edition the room should follow. One move sends them
                  all.
                </p>
                {editions.map((edition) => {
                  const isDriver = edition.textId === driverTextId;
                  const note = editionNote(edition);
                  return (
                    <div
                      key={edition.textId}
                      className={`mb-0.5 flex items-center gap-2 rounded-[7px] px-2 py-2 max-lg:px-1 max-lg:py-1.5 ${
                        isDriver ? "bg-[#e5231c]/20" : "hover:bg-[#1a1a1c]"
                      }`}
                    >
                      <input
                        type="checkbox"
                        aria-label={`Follow ${edition.title}`}
                        checked={isDriver || followed.includes(edition.textId)}
                        disabled={isDriver}
                        onChange={() => toggleFollow(edition)}
                        className="h-4 w-4 shrink-0 accent-[#e5231c] max-lg:h-5 max-lg:w-5"
                      />
                      <button
                        type="button"
                        onClick={() => read(edition)}
                        className="min-w-0 flex-1 cursor-pointer text-left"
                      >
                        <span
                          className={`block truncate text-[14px] ${
                            isDriver ? "text-white" : "text-[#f2f2f7]"
                          }`}
                        >
                          {edition.title}
                        </span>
                        <span className="block text-[11px] text-[#8e8e93]">
                          {edition.language || "?"}
                          {isDriver ? " · reading" : ""}
                          {note ? ` · ${note}` : ""}
                        </span>
                      </button>
                    </div>
                  );
                })}
              </>
            ) : null}
          </div>
        </aside>

        {/* An upright phone stacks the titles over the lines; this divider
         * between them is dragged to give either one more of the height. */}
        {titlesUnfolded ? (
          <div
            role="separator"
            aria-orientation="horizontal"
            aria-label="Resize titles"
            aria-valuemin={Math.round(TITLES_SHARE_MIN * 100)}
            aria-valuemax={Math.round(TITLES_SHARE_MAX * 100)}
            aria-valuenow={Math.round(titlesShare * 100)}
            tabIndex={0}
            onPointerDown={(e) => {
              e.preventDefault();
              startDividerDrag(e.pointerId, e.clientY);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowUp") moveTitlesShare(-0.05);
              if (e.key === "ArrowDown") moveTitlesShare(0.05);
            }}
            className="hidden h-5 shrink-0 cursor-row-resize touch-none items-center justify-center border-y border-[#2c2c2e] bg-[#111113] select-none max-lg:portrait:flex"
          >
            <span className="h-1 w-12 rounded-full bg-[#5a5a5f]" />
          </div>
        ) : null}

        <main className="flex min-h-0 min-w-0 flex-1 flex-col px-8 pt-5 max-lg:px-3 max-lg:pt-2">
          <div className="flex flex-wrap items-center gap-2 text-[13px] tracking-[0.04em] text-[#8e8e93] max-lg:gap-1.5">
            <button
              type="button"
              onClick={() => setNavOpen((open) => !open)}
              aria-pressed={titlesUnfolded}
              className={`shrink-0 cursor-pointer rounded-md bg-[#2c2c2e] px-3 py-1.5 text-[13px] font-semibold hover:bg-[#3a3a3c] max-lg:px-2.5 ${
                needsText ? "hidden" : ""
              }`}
            >
              {titlesUnfolded ? "Hide titles" : "Show titles"}
            </button>
            <span className="max-lg:hidden">
              The WeBuddhist app follows this controller.
            </span>
            <span
              data-testid="publish-state"
              className={`shrink-0 rounded-full px-2.5 py-1 text-[13px] font-semibold whitespace-nowrap max-lg:px-2 max-lg:text-[12px] ${
                online
                  ? "bg-[#1f3a24] text-[#7fd598]"
                  : "bg-[#3a1f1f] text-[#e08585]"
              }`}
            >
              {statusLabel}
            </span>
            {/* Size and token travel together: on a phone too narrow for one
             * row they wrap as a pair to the right, never one button alone. */}
            <div className="ml-auto flex shrink-0 items-center gap-1.5">
              {/* The text size suits the screen, so it is kept per browser. */}
              <label className="flex shrink-0 items-center gap-1.5">
                <span className="max-lg:hidden">Text size</span>
                {sizePicker("Text size", textScale, changeTextScale)}
              </label>
              {/* A phone has little room for this, so the button says less. */}
              <button
                type="button"
                aria-label={token ? "Change token" : "Add token"}
                onClick={() => (token ? forgetToken() : setShowTokenBox(true))}
                className="shrink-0 rounded-md bg-[#2c2c2e] px-3 py-1.5 text-sm font-semibold whitespace-nowrap hover:bg-[#3a3a3c] max-lg:px-2.5 max-lg:text-[13px]"
              >
                <span className="max-lg:hidden">
                  {token ? "Change token" : "Add token"}
                </span>
                <span className="lg:hidden" aria-hidden="true">
                  Token
                </span>
              </button>
            </div>
          </div>

          {showTokenBox ? (
            <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-[#2c2c2e] bg-[#1c1c1e] p-3 max-lg:mt-2">
              <label className="text-sm text-[#8e8e93]" htmlFor="emit-token">
                Emit token
              </label>
              <input
                id="emit-token"
                type="password"
                value={tokenDraft}
                onChange={(e) => setTokenDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveToken();
                }}
                placeholder="paste the recitation emit token"
                className="min-w-[240px] flex-1 rounded-md border border-[#2c2c2e] bg-black px-3 py-2 text-sm text-[#f2f2f7] placeholder:text-[#8e8e93] max-lg:min-w-0 max-lg:text-base"
              />
              <button
                type="button"
                onClick={saveToken}
                className="rounded-md bg-[#e5231c] px-4 py-2 text-sm font-semibold text-white hover:bg-[#ff3a33]"
              >
                Save
              </button>
              <p className="w-full text-[12px] text-[#8e8e93]">
                Kept in this browser only, never in the link. This one token can
                drive any live recitation, so treat it like a password.
              </p>
            </div>
          ) : null}

          <h1 className="mt-3.5 mb-0.5 text-2xl leading-relaxed [overflow-wrap:anywhere] max-lg:mt-2 max-lg:text-base max-lg:leading-snug">
            {driverEdition?.title ?? (sourceTextId || "No text loaded")}
          </h1>
          {/* Where the room is, at every width and in both modes: the line that
           * answers "where are we" without reading the text. */}
          <div className="mb-3 text-[13px] text-[#8e8e93] max-lg:mb-1 max-lg:text-[12px]">
            {driverLines.length > 0
              ? `line ${currentIndex + 1}/${driverLines.length}`
              : "nothing loaded yet"}
            {followedCount > 0
              ? ` · ${followedCount} more edition${followedCount === 1 ? "" : "s"} following`
              : null}
          </div>
          {/* What the room is shown, as the backend says: the controller's own
           * view of the room, whoever is moving it. */}
          {token ? (
            <div
              data-room=""
              aria-live="polite"
              className="mb-3 flex min-w-0 items-center gap-2 text-[13px] text-[#8e8e93] max-lg:mb-1 max-lg:text-[12px]"
            >
              <span
                aria-hidden="true"
                className={`inline-block size-2 shrink-0 rounded-full ${
                  socket.status === "open" ? "bg-[#30d158]" : "bg-[#636366]"
                }`}
              />
              <span className="shrink-0">
                {socket.status === "open"
                  ? "Room"
                  : socket.status === "connecting"
                    ? "Connecting to the room…"
                    : socket.status === "refused"
                      ? `The room turned the controller away (${
                          socket.refusal ?? "refused"
                        }) · moves go by HTTP. The server may not take the emit token on its socket yet.`
                      : "Room offline · moves go by HTTP"}
              </span>
              {socket.status === "open" ? (
                <span data-room-line className="min-w-0 truncate">
                  {roomLineIndex >= 0
                    ? `line ${roomLineIndex + 1}${
                        socket.room?.roundNumber && socket.room.roundNumber > 1
                          ? ` · round ${socket.room.roundNumber}`
                          : ""
                      } · ${driverLines[roomLineIndex]?.content ?? ""}`
                    : socket.room
                      ? "on another text"
                      : "no line yet"}
                </span>
              ) : null}
              {socket.status === "open" && socket.people !== null ? (
                <span className="shrink-0">· {socket.people} following</span>
              ) : null}
              {remoteAutoplay ? (
                <span className="shrink-0 text-[#7fd598]">
                  · autoplay running
                </span>
              ) : null}
            </div>
          ) : null}

          {errorMessage && errorMessage !== dismissedError ? (
            <div
              role="alert"
              className="mb-3 flex items-start gap-2 rounded-lg border border-[#3a1f1f] bg-[#2a1515] py-2 pr-1.5 pl-3 text-sm text-[#e08585] max-lg:mb-2"
            >
              <p className="min-w-0 flex-1 py-0.5 [overflow-wrap:anywhere]">
                {errorMessage}
              </p>
              <button
                type="button"
                aria-label="Dismiss message"
                onClick={() => setDismissedError(errorMessage)}
                className="-my-0.5 shrink-0 cursor-pointer rounded-md px-2 py-0.5 text-lg leading-none hover:bg-[#3a1f1f]"
              >
                ×
              </button>
            </div>
          ) : null}

          {/* A phone held sideways has height to spare for neither, so the
           * controls stand in a column to the right of the lines. */}
          <div className="flex min-h-0 flex-1 flex-col max-lg:landscape:flex-row max-lg:landscape:gap-2">
            <div
              ref={listRef}
              className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-2 max-lg:pr-0"
            >
              {driverLines.length === 0 ? (
                <p className="py-12 text-center text-sm text-[#8e8e93]">
                  {isPreparingDriver ||
                  (sourceTextId && !driverTextId && !loadError)
                    ? "Loading…"
                    : "Pick a liturgy or add a text id, then tap a line (or press Space) to move the room."}
                </p>
              ) : (
                driverLines.map((segment, index) => {
                  const returnTo = returnButtonForLine(segment.id, driverLines);
                  const yigchung = yigchungs?.[segment.id];
                  const isYigchung = Boolean(yigchung?.full);
                  const playTime = playTimes?.[segment.id];
                  return (
                    <Fragment key={segment.id}>
                      <button
                        type="button"
                        data-line={index}
                        data-yigchung={isYigchung ? "" : undefined}
                        data-room-here={
                          index === roomLineIndex && index !== currentIndex
                            ? ""
                            : undefined
                        }
                        title={
                          isYigchung ? "Yigchung · skipped by Next" : undefined
                        }
                        onClick={() => goTo(index)}
                        className={`block w-full cursor-pointer rounded-[5px] text-left break-words ${lineClass} ${
                          isYigchung
                            ? // Instruction, not recitation: smaller, in its own
                              // colour, and ruled off so the verse around it reads on.
                              `border-l-2 border-dashed border-[#c9a063]/60 pl-3 ${yigchungLineSize}`
                            : lineSize
                        } ${
                          index === currentIndex
                            ? // Packed lines need more than a tint to be found at a
                              // glance, so the live one is outlined as well.
                              "bg-[rgba(229,35,28,0.30)] text-white outline-1 outline-[#e5231c]"
                            : index === roomLineIndex
                              ? // The room is somewhere else than this screen -
                                // a move still on its way, or another controller.
                                "text-[#f2f2f7] outline-1 outline-dashed outline-[#30d158]/70"
                              : isYigchung
                                ? "text-[#c9a063]/80 hover:bg-[#1a1a1c] hover:text-[#e0bd84]"
                                : "text-[#8e8e93] hover:bg-[#1a1a1c] hover:text-[#f2f2f7]"
                        }`}
                      >
                        {/* What autoplay holds the line for; a dash is a line
                         * it stops at, never having been recited through. */}
                        {playTimes && !isYigchung ? (
                          <span
                            data-play-time={playTime ?? ""}
                            title={
                              playTime === undefined
                                ? "No play time yet · autoplay stops here"
                                : "Play time learned from earlier pujas"
                            }
                            className={`float-right mt-1 ml-2 rounded-full px-2 py-0.5 font-sans text-[11px] leading-none tabular-nums ${
                              playTime === undefined
                                ? "text-[#636366]"
                                : "bg-[#1c1c1e] text-[#c7c7cc]"
                            }`}
                          >
                            {playTime === undefined
                              ? "—"
                              : formatPlayTime(playTime)}
                          </span>
                        ) : null}
                        <LineContent
                          content={segment.content}
                          yigchung={yigchung}
                        />
                        {autoplay &&
                        index === currentIndex &&
                        (autoplayStepDuration ?? playTime) !== undefined ? (
                          <AutoplayProgress
                            startedAt={lineStartedAt}
                            duration={autoplayStepDuration ?? playTime ?? 0}
                            running={!autoplayBusy}
                          />
                        ) : null}
                      </button>
                      {returnTo ? (
                        <div className="mt-1 mb-4 ml-1.5 flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            aria-label={`${returnTo.label}, round ${acceptedRound(returnTo.key)}`}
                            onClick={() =>
                              beginNextRound(returnTo.key, returnTo.index)
                            }
                            className="flex cursor-pointer items-center gap-3 rounded-[9px] border border-[#e5231c] bg-[#2c2c2e] py-2.5 pr-2.5 pl-5 text-left text-base font-semibold text-[#f2f2f7] hover:bg-[#3a3a3c]"
                          >
                            <span>{returnTo.label}</span>
                            {/* Which round this is, where the finger lands. */}
                            <span
                              aria-hidden="true"
                              className="min-w-[2.25rem] shrink-0 rounded-full bg-[#e5231c] px-2.5 py-0.5 text-center text-sm font-bold text-white tabular-nums"
                            >
                              {acceptedRound(returnTo.key)}
                            </span>
                            {/* Begun but not yet taken by the room: shown apart,
                             * so the badge never runs ahead of the recitation. */}
                            {roundOf(returnTo.key) >
                            acceptedRound(returnTo.key) ? (
                              <span
                                data-round-pending=""
                                title="Waiting for the room to take this round"
                                className="shrink-0 text-sm font-semibold text-[#8e8e93] tabular-nums"
                              >
                                → {roundOf(returnTo.key)}
                              </span>
                            ) : null}
                          </button>
                          {roundOf(returnTo.key) > FIRST_ROUND ? (
                            <button
                              type="button"
                              aria-label={`Reset count: ${returnTo.label}`}
                              title="Reset the count to 1"
                              onClick={() => {
                                resetReturn(returnTo.key);
                                planChanged();
                              }}
                              className="cursor-pointer rounded-[9px] bg-[#1c1c1e] px-3 py-2.5 text-sm font-semibold text-[#8e8e93] hover:bg-[#2c2c2e] hover:text-[#f2f2f7]"
                            >
                              Reset to 1
                            </button>
                          ) : null}
                          <ReturnPlan
                            label={returnTo.label}
                            planned={plannedRoundsOf(returnTo.key)}
                            left={returnsLeft(returnTo.key)}
                            onChange={(rounds) => {
                              planRounds(returnTo.key, rounds);
                              planChanged();
                            }}
                          />
                        </div>
                      ) : null}
                    </Fragment>
                  );
                })
              )}
            </div>

            <div className="border-t border-[#2c2c2e] pt-3 pb-4 max-lg:pt-2 max-lg:pb-2 max-lg:landscape:flex max-lg:landscape:w-[120px] max-lg:landscape:shrink-0 max-lg:landscape:flex-col max-lg:landscape:border-t-0 max-lg:landscape:border-l max-lg:landscape:pt-0 max-lg:landscape:pl-2">
              <p className="text-[13px] text-[#8e8e93] max-lg:hidden">
                {lastSent ? `sent ${lastSent}` : "Tap any line · ← / → / Space"}
              </p>

              {/* Next takes the room left over and stands tall enough to take a
               * fresh finger each time; Previous stays smaller beside it - or
               * below it, on a phone held sideways - so it is not the one hit by
               * mistake. */}
              <div className="mt-2 flex items-stretch gap-3 max-lg:gap-2 max-lg:landscape:mt-0 max-lg:landscape:min-h-0 max-lg:landscape:flex-1 max-lg:landscape:flex-col-reverse">
                <button
                  type="button"
                  onClick={() => step(-1)}
                  className="w-[28%] max-w-[200px] touch-manipulation cursor-pointer rounded-[9px] bg-[#2c2c2e] py-4 text-base font-semibold select-none hover:bg-[#3a3a3c] active:bg-[#48484a] max-lg:py-3 max-lg:text-[15px] max-lg:landscape:w-full max-lg:landscape:max-w-none"
                >
                  ← Previous
                </button>
                <button
                  type="button"
                  onClick={toggleAutoplay}
                  aria-pressed={autoplay || remoteAutoplay}
                  // Pausing is always allowed; starting waits for the lines and
                  // the yigchung, which the plan is laid out from.
                  disabled={
                    !token ||
                    (!autoplay &&
                      !remoteAutoplay &&
                      (driverLines.length === 0 || awaitingYigchungs))
                  }
                  title={
                    token
                      ? "Move the room on by itself, at the pace this text was recited before. The server keeps it going even if this screen sleeps."
                      : "Add the emit token to use autoplay"
                  }
                  className={`w-[22%] max-w-[160px] touch-manipulation cursor-pointer rounded-[9px] py-4 text-base font-semibold select-none disabled:cursor-not-allowed disabled:opacity-40 max-lg:py-3 max-lg:text-[15px] max-lg:landscape:w-full max-lg:landscape:max-w-none ${
                    autoplay || remoteAutoplay
                      ? "bg-[#1f3a24] text-[#7fd598] hover:bg-[#274a2e]"
                      : "bg-[#2c2c2e] hover:bg-[#3a3a3c] active:bg-[#48484a]"
                  }`}
                >
                  {autoplay || remoteAutoplay ? "❚❚ Pause" : "▶ Auto"}
                </button>
                <button
                  type="button"
                  onClick={() => step(1)}
                  className="flex-1 touch-manipulation cursor-pointer rounded-[9px] bg-[#e5231c] py-4 text-xl font-semibold text-white select-none hover:bg-[#ff3a33] active:bg-[#ff6b66] max-lg:portrait:min-h-[84px] max-lg:landscape:min-h-0"
                >
                  Next →
                </button>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default LiveControlPage;
