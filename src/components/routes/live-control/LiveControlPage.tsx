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
import { useQueries, useQuery } from "@tanstack/react-query";
import { useDebounce } from "use-debounce";
import { getApiErrorMessage } from "@/lib/apiErrors";
import {
  fetchEditionTitle,
  fetchLiturgies,
  fetchLiveControlEvent,
  fetchRecitationDetails,
  fetchTextEditions,
  searchTextsByTitle,
  toOperatorSegments,
  type Liturgy,
  type OperatorSegment,
  type PositionToPublish,
  type TextEdition,
} from "./api/liveControlApi";
import { fetchEditionSections, type TocEntry } from "./api/libraryTocApi";
import { returnButtonForLine } from "./returnJumps";
import { usePositionPublisher } from "./usePositionPublisher";

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

const readStoredScale = (key: string): number => {
  try {
    const raw = localStorage.getItem(key);
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
/** Offered until they have been opened in this browser, by edition id. */
const SUGGESTED_TEXT_IDS = ["Zt5c0fe1OMJI1Kh8rp2FM", "lEmYv8BrRQkOMPY9ymQpS"];

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

/** A wide screen opens with the titles beside the text; a phone opens on the
 * text alone and shows the titles when asked. */
const opensWithTitles = () => {
  try {
    return window.matchMedia("(min-width: 1024px)").matches;
  } catch {
    return false;
  }
};

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

const LiveControlPage = () => {
  const { eventId } = useParams<{ eventId: string }>();

  const [token, setToken] = useState<string | null>(() => readStoredToken());
  const [tokenDraft, setTokenDraft] = useState("");
  const [showTokenBox, setShowTokenBox] = useState(() => !readStoredToken());
  /** The work the operator is on: a liturgy of the event, or a pasted text id. */
  const [sourceTextId, setSourceTextId] = useState("");
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
  const [round, setRound] = useState(1);
  const [loadError, setLoadError] = useState<string | null>(null);
  /** The liturgy and section titles, shown or put away with one button. */
  const [navOpen, setNavOpen] = useState(() => opensWithTitles());
  /** An upright phone's split between the titles and the lines. */
  const [titlesShare, setTitlesShare] = useState(() => readStoredTitlesShare());
  /** Adding a text and ticking editions is setup, not driving: on a phone it
   * stays folded so the titles get the height. */
  const [setupOpen, setSetupOpen] = useState(false);
  const [textScale, setTextScale] = useState(() =>
    readStoredScale(TEXT_SCALE_STORAGE_KEY),
  );
  const [titlesScale, setTitlesScale] = useState(() =>
    readStoredScale(TITLES_SCALE_STORAGE_KEY),
  );

  const listRef = useRef<HTMLDivElement | null>(null);
  /** The titles-and-lines area the divider splits. */
  const splitRef = useRef<HTMLDivElement | null>(null);
  const sectionListRef = useRef<HTMLDivElement | null>(null);
  /** Editions already asked for, so nothing is fetched twice. */
  const requestedRef = useRef<Set<string>>(new Set());

  const { state, notice, lastSent, publish, endSession, clearNotice } =
    usePositionPublisher(eventId, token);

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

  /** An event with no liturgies opens on nothing: pasting a text id is the only
   * way in, so a phone shows that box rather than folding it two taps away. */
  const needsText =
    Boolean(event) &&
    !sourceTextId &&
    (!event?.collectionId ||
      (liturgies !== undefined && liturgies.length === 0));
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

  const order: Liturgy[] = useMemo(() => liturgies ?? [], [liturgies]);

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

  // The first liturgy of the order is what the puja opens with, so it is on
  // screen before the operator touches anything.
  useEffect(() => {
    if (sourceTextId || order.length === 0) return;
    openWork(order[0].textId);
  }, [order, sourceTextId, openWork]);

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
  const cuesForLine = useCallback(
    (index: number): PositionToPublish[] => {
      const driving = lines[driverTextId]?.[index];
      if (!driving) return [];
      const cues: PositionToPublish[] = [
        {
          textId: driverTextId,
          segmentId: driving.id,
          index,
          roundNumber: round,
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
            roundNumber: round,
          });
        }
      });
      return cues;
    },
    [lines, linesByRow, followed, driverTextId, round],
  );

  const jump = useCallback(
    (index: number) => {
      if (index < 0 || index >= driverLines.length) return;
      setCurrentIndex(index);
      scrollLineIntoBand(index);
      publish(cuesForLine(index));
    },
    [driverLines.length, publish, cuesForLine],
  );

  const step = useCallback(
    (delta: number) => {
      const next = currentIndex + delta;
      if (next < 0 || next >= driverLines.length) return;
      jump(next);
    },
    [currentIndex, driverLines.length, jump],
  );

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
  const { data: textMatches, isFetching: searchingTexts } = useQuery({
    queryKey: ["live-control-text-search", debouncedTextQuery],
    queryFn: () => searchTextsByTitle(debouncedTextQuery),
    enabled: debouncedTextQuery.length >= 2,
    staleTime: 1000 * 60,
    refetchOnWindowFocus: false,
  });
  /** An id pasted into the search box opens as it is, as it always could. */
  const looksLikeId = /^[A-Za-z0-9_-]{15,}$/.test(textQuery.trim());

  const openFirstMatch = () => {
    const query = textQuery.trim();
    if (!query) return;
    if (looksLikeId) {
      openTextById(query);
      return;
    }
    const first = textMatches?.[0];
    if (first) openTextById(first.textId, first.title);
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

  const currentLiturgy = order.find((item) => item.textId === sourceTextId);
  const liturgyNumber =
    order.findIndex((item) => item.textId === sourceTextId) + 1;
  const followedCount = followed.filter((id) => Boolean(lines[id])).length;
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
  const startDividerDrag = (startY: number) => {
    const shareAt = (clientY: number) => {
      const box = splitRef.current?.getBoundingClientRect();
      if (!box || box.height <= 0 || !Number.isFinite(clientY)) return null;
      return clampTitlesShare((clientY - box.top) / box.height);
    };
    let latest = shareAt(startY);
    if (latest !== null) setTitlesShare(latest);
    const onMove = (moveEvent: PointerEvent) => {
      const share = shareAt(moveEvent.clientY);
      if (share === null) return;
      latest = share;
      setTitlesShare(share);
    };
    const onEnd = () => {
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
  const lineClass =
    "px-1.5 py-1 text-[calc(26px*var(--text-scale))] leading-[1.6] lg:text-[calc(23px*var(--text-scale))] lg:leading-[1.7]";
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
          {order.length > 0 || sections.length > 0 ? (
            <label className="mx-2 mb-2 flex shrink-0 items-center gap-2 text-[12px] tracking-[0.08em] text-[#8e8e93] uppercase max-lg:mx-1 max-lg:mb-1">
              <span className="mr-auto">Title size</span>
              {sizePicker("Title size", titlesScale, changeTitlesScale)}
            </label>
          ) : null}

          {order.length > 0 ? (
            <>
              <h2 className="mx-2 mt-1 mb-3 text-[13px] tracking-[0.1em] text-[#8e8e93] uppercase max-lg:mx-1 max-lg:mb-1">
                Liturgies
              </h2>
              <div>
                {order.map((item) => (
                  <button
                    key={item.textId}
                    type="button"
                    onClick={() => {
                      openWork(item.textId);
                    }}
                    className={`mb-0.5 block w-full cursor-pointer rounded-[7px] px-3 py-1.5 text-left ${titleSize} [overflow-wrap:anywhere] max-lg:px-2 max-lg:py-1 ${
                      item.textId === sourceTextId
                        ? "bg-[#e5231c] text-white"
                        : "text-[#8e8e93] hover:bg-[#1a1a1c]"
                    }`}
                  >
                    {item.title}
                  </button>
                ))}
              </div>
            </>
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
                  return (
                    <button
                      key={section.id}
                      type="button"
                      data-section-active={isActive}
                      disabled={!reachable}
                      title={reachable ? undefined : "No segment to go to"}
                      onClick={() => {
                        jump(section.lineIndex);
                      }}
                      // Outlines nest deeply - six levels is ordinary - so the
                      // indent stops after three and the titles keep their width.
                      style={{
                        paddingLeft: 12 + Math.min(section.depth, 3) * 12,
                      }}
                      className={`mb-0.5 block w-full rounded-[7px] py-1.5 pr-3 text-left ${titleSize} [overflow-wrap:anywhere] max-lg:py-1 ${
                        isActive
                          ? "bg-[#e5231c] text-white"
                          : reachable
                            ? "cursor-pointer text-[#8e8e93] hover:bg-[#1a1a1c]"
                            : "cursor-default text-[#5a5a5f]"
                      }`}
                    >
                      {section.title}
                    </button>
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
                {(textMatches ?? []).map((match) => (
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
                ) : searchingTexts ||
                  textQuery.trim() !== debouncedTextQuery ? (
                  <p className="px-3 py-2.5 text-[13px] text-[#8e8e93]">
                    Searching…
                  </p>
                ) : (textMatches ?? []).length === 0 && !looksLikeId ? (
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
              startDividerDrag(e.clientY);
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
            {driverEdition?.title ??
              currentLiturgy?.title ??
              (sourceTextId || "No liturgy loaded")}
          </h1>
          {/* Where the room is, at every width and in both modes: the line that
           * answers "where are we" without reading the text. */}
          <div className="mb-3 text-[13px] text-[#8e8e93] max-lg:mb-1 max-lg:text-[12px]">
            {order.length > 0 && liturgyNumber > 0
              ? `Liturgy ${liturgyNumber}/${order.length} · `
              : null}
            {driverLines.length > 0
              ? `line ${currentIndex + 1}/${driverLines.length}`
              : "nothing loaded yet"}
            {followedCount > 0
              ? ` · ${followedCount} more edition${followedCount === 1 ? "" : "s"} following`
              : null}
            {round > 1 ? ` · round ${round}` : null}
          </div>

          {eventError || editionsError || loadError || notice ? (
            <p className="mb-3 rounded-lg border border-[#3a1f1f] bg-[#2a1515] px-3 py-2 text-sm text-[#e08585] max-lg:mb-2">
              {loadError ??
                notice ??
                getApiErrorMessage(
                  eventError ?? editionsError,
                  "Could not load this event.",
                )}
            </p>
          ) : null}

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
                return (
                  <Fragment key={segment.id}>
                    <button
                      type="button"
                      data-line={index}
                      onClick={() => jump(index)}
                      className={`block w-full cursor-pointer rounded-[5px] text-left break-words ${lineClass} ${
                        index === currentIndex
                          ? // Packed lines need more than a tint to be found at a
                            // glance, so the live one is outlined as well.
                            "bg-[rgba(229,35,28,0.30)] text-white outline-1 outline-[#e5231c]"
                          : "text-[#8e8e93] hover:bg-[#1a1a1c] hover:text-[#f2f2f7]"
                      }`}
                    >
                      {segment.content}
                    </button>
                    {returnTo ? (
                      <button
                        type="button"
                        onClick={() => jump(returnTo.index)}
                        className="mt-1 mb-4 ml-1.5 block cursor-pointer rounded-[9px] border border-[#e5231c] bg-[#2c2c2e] px-5 py-2.5 text-base font-semibold text-[#f2f2f7] hover:bg-[#3a3a3c]"
                      >
                        {returnTo.label}
                      </button>
                    ) : null}
                  </Fragment>
                );
              })
            )}
          </div>

          <div className="border-t border-[#2c2c2e] pt-3 pb-4 max-lg:pt-2 max-lg:pb-2">
            {/* The round, the session and the last cue sent. */}
            <div className="flex flex-wrap items-center gap-3.5 text-[13px] text-[#8e8e93] max-lg:gap-2">
              <span className="flex items-center gap-1.5">
                round
                <button
                  type="button"
                  aria-label="Previous round"
                  onClick={() => setRound((value) => Math.max(1, value - 1))}
                  className="rounded-md bg-[#2c2c2e] px-3 py-2 font-semibold hover:bg-[#3a3a3c] max-lg:px-2.5 max-lg:py-1"
                >
                  −
                </button>
                <input
                  aria-label="Round"
                  type="number"
                  min={1}
                  value={round}
                  onChange={(e) =>
                    setRound(Math.max(1, Number(e.target.value) || 1))
                  }
                  className="w-14 rounded-md border border-[#2c2c2e] bg-[#1c1c1e] px-2 py-1.5 text-center text-sm text-[#f2f2f7] max-lg:text-base"
                />
                <button
                  type="button"
                  aria-label="Next round"
                  onClick={() => setRound((value) => value + 1)}
                  className="rounded-md bg-[#2c2c2e] px-3 py-2 font-semibold hover:bg-[#3a3a3c] max-lg:px-2.5 max-lg:py-1"
                >
                  +
                </button>
              </span>
              <button
                type="button"
                onClick={() => void endSession()}
                className="rounded-[9px] border border-[#e5231c] bg-[#2c2c2e] px-5 py-2.5 text-sm font-semibold hover:bg-[#3a3a3c] max-lg:px-3 max-lg:py-1.5 max-lg:text-[13px]"
              >
                End session
              </button>
              <span className="ml-auto max-lg:hidden">
                {lastSent ? `sent ${lastSent}` : "Tap any line · ← / → / Space"}
              </span>
            </div>

            {/* Next takes the whole width left over and stands tall enough to
             * take a fresh finger each time; Previous stays narrow beside it so
             * it is not the one hit by mistake. */}
            <div className="mt-2 flex items-stretch gap-3 max-lg:gap-2">
              <button
                type="button"
                onClick={() => step(-1)}
                className="w-[28%] max-w-[200px] touch-manipulation cursor-pointer rounded-[9px] bg-[#2c2c2e] py-5 text-lg font-semibold select-none hover:bg-[#3a3a3c] active:bg-[#48484a] max-lg:text-base"
              >
                ← Previous
              </button>
              <button
                type="button"
                onClick={() => step(1)}
                className="flex-1 touch-manipulation cursor-pointer rounded-[9px] bg-[#e5231c] py-5 text-2xl font-semibold text-white select-none hover:bg-[#ff3a33] active:bg-[#ff6b66] max-lg:portrait:min-h-[104px] max-lg:landscape:min-h-[64px]"
              >
                Next →
              </button>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default LiveControlPage;
