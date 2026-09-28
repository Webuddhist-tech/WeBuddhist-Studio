import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getApiErrorMessage } from "@/lib/apiErrors";
import {
  fetchLiturgies,
  fetchLiveControlEvent,
  fetchRecitationDetails,
  fetchTextEditions,
  toOperatorSegments,
  type Liturgy,
  type OperatorSegment,
  type PositionToPublish,
  type TextEdition,
} from "./api/liveControlApi";
import { fetchEditionSections, type TocEntry } from "./api/libraryTocApi";
import { usePositionPublisher } from "./usePositionPublisher";

/** The emit token is kept per browser, so it is pasted once per machine. It is
 * never put in the link: the URL is shareable, the token must not be. */
const TOKEN_STORAGE_KEY = "recitation_emit_token";

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

/** Shortcuts drive the liturgy, so they stay off fields and off the controls:
 * Space on "Next" or the token box must do what that control does. Lines are
 * buttons too; those keep the shortcuts. */
const allowsShortcut = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return false;
  if (target.isContentEditable) return false;
  if (target.closest("[data-line]")) return true;
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
  const [textIdDraft, setTextIdDraft] = useState("");
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

  const listRef = useRef<HTMLDivElement | null>(null);
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

  // A text and its translations are separate library texts, each with its own
  // segment ids, so the room has to be told about every one it should follow.
  const { data: editionData, error: editionsError } = useQuery({
    queryKey: ["live-control-editions", sourceTextId],
    queryFn: () => fetchTextEditions(sourceTextId),
    enabled: Boolean(sourceTextId),
    refetchOnWindowFocus: false,
  });

  const order: Liturgy[] = useMemo(() => liturgies ?? [], [liturgies]);

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

  // The first liturgy of the order is what the puja opens with, so it is on
  // screen before the operator touches anything.
  useEffect(() => {
    if (sourceTextId || order.length === 0) return;
    setSourceTextId(order[0].textId);
  }, [order, sourceTextId]);

  // A new work brings its own editions: the work itself leads, and anything
  // followed belonged to the work before it.
  useEffect(() => {
    if (editions.length === 0) return;
    setDriverTextId(editions[0].textId);
    setFollowed([]);
    setCurrentIndex(-1);
    setLoadError(null);
    void prepare(editions[0]);
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
  // past the operator's place otherwise.
  useEffect(() => {
    if (!activeSectionId) return;
    sectionListRef.current
      ?.querySelector('[data-section-active="true"]')
      ?.scrollIntoView({ block: "nearest" });
  }, [activeSectionId]);

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
   * One move, as every edition being followed sees it. Editions are aligned row
   * for row - the same alignment the recitation API itself publishes - so line N
   * of the leading edition is line N of each of the others. An edition that is
   * shorter simply has nothing to send for that line.
   */
  const cuesForLine = useCallback(
    (index: number): PositionToPublish[] => {
      const cues: PositionToPublish[] = [];
      const add = (textId: string) => {
        const segment = lines[textId]?.[index];
        if (segment) {
          cues.push({
            textId,
            segmentId: segment.id,
            index,
            roundNumber: round,
          });
        }
      };
      add(driverTextId);
      followed.forEach((textId) => {
        if (textId !== driverTextId) add(textId);
      });
      return cues;
    },
    [lines, followed, driverTextId, round],
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

  const addTextId = () => {
    const trimmed = textIdDraft.trim();
    if (!trimmed) return;
    setSourceTextId(trimmed);
    setTextIdDraft("");
  };

  const read = (edition: TextEdition) => {
    setDriverTextId(edition.textId);
    setCurrentIndex(-1);
    setFollowed((current) => current.filter((id) => id !== edition.textId));
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

  return (
    <div className="grid h-screen grid-cols-[320px_1fr] bg-black font-sans text-[#f2f2f7]">
      <aside className="overflow-y-auto border-r border-[#2c2c2e] px-3 py-4">
        <div className="mb-2 flex items-center gap-3 border-b border-[#2c2c2e] px-2 pt-1 pb-4">
          <div className="flex min-w-0 flex-col leading-tight">
            <span className="text-lg font-bold">WeBuddhist</span>
            <span className="mt-0.5 text-[11px] font-medium tracking-[0.11em] text-[#8e8e93] uppercase">
              Live control
            </span>
          </div>
        </div>

        {order.length > 0 ? (
          <>
            <h2 className="mx-2 mt-1 mb-3 text-[13px] tracking-[0.1em] text-[#8e8e93] uppercase">
              Liturgies
            </h2>
            {order.map((item) => (
              <button
                key={item.textId}
                type="button"
                onClick={() => setSourceTextId(item.textId)}
                className={`mb-0.5 block w-full cursor-pointer rounded-[7px] px-3 py-2.5 text-left text-[15px] leading-relaxed ${
                  item.textId === sourceTextId
                    ? "bg-[#e5231c] text-white"
                    : "text-[#8e8e93] hover:bg-[#1a1a1c]"
                }`}
              >
                {item.title}
              </button>
            ))}
          </>
        ) : null}

        {sections.length > 0 ? (
          <>
            <h2 className="mx-2 mt-5 mb-2 text-[13px] tracking-[0.1em] text-[#8e8e93] uppercase">
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
                    onClick={() => jump(section.lineIndex)}
                    // Outlines nest deeply - six levels is ordinary - so the
                    // indent stops after three and the titles keep their width.
                    style={{
                      paddingLeft: 12 + Math.min(section.depth, 3) * 12,
                    }}
                    className={`mb-0.5 block w-full rounded-[7px] py-2.5 pr-3 text-left text-[15px] leading-relaxed ${
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

        <h2 className="mx-2 mt-5 mb-2 text-[13px] tracking-[0.1em] text-[#8e8e93] uppercase">
          Add a text
        </h2>
        <div className="flex gap-2 px-2">
          <input
            aria-label="Text id"
            value={textIdDraft}
            onChange={(e) => setTextIdDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") addTextId();
            }}
            placeholder="text_id"
            className="min-w-0 flex-1 rounded-md border border-[#2c2c2e] bg-[#1c1c1e] px-3 py-2 text-sm text-[#f2f2f7] placeholder:text-[#8e8e93]"
          />
          <button
            type="button"
            onClick={addTextId}
            className="rounded-md bg-[#2c2c2e] px-3 py-2 text-sm font-semibold hover:bg-[#3a3a3c]"
          >
            Add
          </button>
        </div>

        {editions.length > 0 ? (
          <>
            <h2 className="mx-2 mt-5 mb-1 text-[13px] tracking-[0.1em] text-[#8e8e93] uppercase">
              Editions
            </h2>
            <p className="mx-2 mb-2 text-[12px] text-[#8e8e93]">
              Tick every edition the room should follow. One move sends them
              all.
            </p>
            {editions.map((edition) => {
              const isDriver = edition.textId === driverTextId;
              const note = editionNote(edition);
              return (
                <div
                  key={edition.textId}
                  className={`mb-0.5 flex items-center gap-2 rounded-[7px] px-2 py-2 ${
                    isDriver ? "bg-[#e5231c]/20" : "hover:bg-[#1a1a1c]"
                  }`}
                >
                  <input
                    type="checkbox"
                    aria-label={`Follow ${edition.title}`}
                    checked={isDriver || followed.includes(edition.textId)}
                    disabled={isDriver}
                    onChange={() => toggleFollow(edition)}
                    className="h-4 w-4 shrink-0 accent-[#e5231c]"
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
      </aside>

      <main className="flex h-screen min-w-0 flex-col px-8 pt-5">
        <div className="flex flex-wrap items-center gap-2 text-[13px] tracking-[0.04em] text-[#8e8e93]">
          <span>The WeBuddhist app follows this controller.</span>
          <span
            data-testid="publish-state"
            className={`rounded-full px-2.5 py-1 text-[13px] font-semibold ${
              online
                ? "bg-[#1f3a24] text-[#7fd598]"
                : "bg-[#3a1f1f] text-[#e08585]"
            }`}
          >
            {statusLabel}
          </span>
          <button
            type="button"
            onClick={() => (token ? forgetToken() : setShowTokenBox(true))}
            className="ml-auto rounded-md bg-[#2c2c2e] px-3 py-1.5 text-sm font-semibold hover:bg-[#3a3a3c]"
          >
            {token ? "Change token" : "Add token"}
          </button>
        </div>

        {showTokenBox ? (
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-[#2c2c2e] bg-[#1c1c1e] p-3">
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
              className="min-w-[240px] flex-1 rounded-md border border-[#2c2c2e] bg-black px-3 py-2 text-sm text-[#f2f2f7] placeholder:text-[#8e8e93]"
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

        <h1 className="mt-3.5 mb-0.5 text-2xl leading-relaxed">
          {driverEdition?.title ??
            currentLiturgy?.title ??
            (sourceTextId || "No liturgy loaded")}
        </h1>
        <div className="mb-3 text-[13px] text-[#8e8e93]">
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
          <p className="mb-3 rounded-lg border border-[#3a1f1f] bg-[#2a1515] px-3 py-2 text-sm text-[#e08585]">
            {loadError ??
              notice ??
              getApiErrorMessage(
                eventError ?? editionsError,
                "Could not load this event.",
              )}
          </p>
        ) : null}

        <div ref={listRef} className="flex-1 overflow-y-auto pr-2">
          {driverLines.length === 0 ? (
            <p className="py-12 text-center text-sm text-[#8e8e93]">
              {isPreparingDriver
                ? "Loading…"
                : "Pick a liturgy or add a text id, then tap a line (or press Space) to move the room."}
            </p>
          ) : (
            driverLines.map((segment, index) => (
              <button
                key={segment.id}
                type="button"
                data-line={index}
                onClick={() => jump(index)}
                className={`block w-full cursor-pointer rounded-[5px] px-1.5 py-1 text-left text-[23px] leading-[1.7] break-words ${
                  index === currentIndex
                    ? "bg-[rgba(229,35,28,0.30)] text-white"
                    : "text-[#8e8e93] hover:bg-[#1a1a1c] hover:text-[#f2f2f7]"
                }`}
              >
                {segment.content}
              </button>
            ))
          )}
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-3.5 border-t border-[#2c2c2e] py-4">
          <button
            type="button"
            onClick={() => step(-1)}
            className="rounded-[9px] bg-[#2c2c2e] px-6 py-3 text-base font-semibold hover:bg-[#3a3a3c]"
          >
            ← Previous
          </button>
          <button
            type="button"
            onClick={() => step(1)}
            className="rounded-[9px] bg-[#e5231c] px-6 py-3 text-base font-semibold text-white hover:bg-[#ff3a33]"
          >
            Next →
          </button>
          <span className="flex items-center gap-1.5 text-[13px] text-[#8e8e93]">
            round
            <button
              type="button"
              aria-label="Previous round"
              onClick={() => setRound((value) => Math.max(1, value - 1))}
              className="rounded-md bg-[#2c2c2e] px-3 py-2 font-semibold hover:bg-[#3a3a3c]"
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
              className="w-14 rounded-md border border-[#2c2c2e] bg-[#1c1c1e] px-2 py-1.5 text-center text-sm text-[#f2f2f7]"
            />
            <button
              type="button"
              aria-label="Next round"
              onClick={() => setRound((value) => value + 1)}
              className="rounded-md bg-[#2c2c2e] px-3 py-2 font-semibold hover:bg-[#3a3a3c]"
            >
              +
            </button>
          </span>
          <button
            type="button"
            onClick={() => void endSession()}
            className="rounded-[9px] border border-[#e5231c] bg-[#2c2c2e] px-5 py-3 text-sm font-semibold hover:bg-[#3a3a3c]"
          >
            End session
          </button>
          <span className="ml-auto text-[13px] text-[#8e8e93]">
            {lastSent ? `sent ${lastSent}` : "Tap any line · ← / → / Space"}
          </span>
        </div>
      </main>
    </div>
  );
};

export default LiveControlPage;
