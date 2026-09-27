import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useOutletContext, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { LuRadio } from "react-icons/lu";
import { Pecha } from "@/components/ui/shadimport";
import { getApiErrorMessage } from "@/lib/apiErrors";
import { ROUTES } from "@/routes/paths";
import { useLanguages } from "@/hooks/useLanguages";
import type { GroupOutletContext } from "./GroupLayout";
import { canWriteEvents } from "./lib/eventPermissions";
import { fetchCmsEvent, metadataArray } from "./api/eventsApi";
import { fetchChantCollection } from "./api/chantsApi";
import {
  fetchRecitationDetails,
  toOperatorSegments,
  type OperatorSegment,
} from "./api/recitationLiveApi";
import {
  useRecitationSocket,
  type LivePosition,
  type RecitationConnectionState,
} from "./hooks/useRecitationSocket";

const STATE_LABEL: Record<RecitationConnectionState, string> = {
  idle: "Not connected",
  connecting: "Connecting…",
  connected: "Connected",
  reconnecting: "Reconnecting…",
  ended: "Session ended",
  error: "Connection error",
};

/** Recitation languages are lowercase on the wire ("bo"), Studio codes are not. */
const toWireLanguage = (code: string) => code.trim().toLowerCase();

const TOOLBAR_CONTROL_SELECTOR = [
  "button",
  "a",
  "[role='button']",
  "[role='combobox']",
  "[role='option']",
  "[role='menuitem']",
  "[role='listbox']",
].join(", ");

/** Shortcuts drive the liturgy. They stay off fields and toolbar controls so
 * Space can still activate "Load text" or a round button. Line rows are
 * buttons too; those keep the shortcuts. */
const allowsLiveShortcut = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return false;
  if (target.isContentEditable) return false;
  if (target.closest("[data-row]")) return true;
  if (target.closest(TOOLBAR_CONTROL_SELECTOR)) return false;
  return true;
};

const GroupEventLivePage = () => {
  const { groupId, eventId } = useParams<{
    groupId: string;
    eventId: string;
  }>();
  const navigate = useNavigate();
  const { myRole, userInfo, readOnlyPlatform } =
    useOutletContext<GroupOutletContext>();
  const canWrite =
    !readOnlyPlatform && canWriteEvents(myRole, userInfo?.platform_role);

  const { languageOptions } = useLanguages();
  const [language, setLanguage] = useState("BO");
  const [textId, setTextId] = useState("");
  const [loadedTextId, setLoadedTextId] = useState<string | null>(null);
  const [segments, setSegments] = useState<OperatorSegment[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [round, setRound] = useState(1);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoadingText, setIsLoadingText] = useState(false);
  const [lastSent, setLastSent] = useState<string | null>(null);

  const listRef = useRef<HTMLDivElement | null>(null);
  /** Which language the lines on screen were loaded in. */
  const loadedLanguageRef = useRef<string | null>(null);
  /** Latest language, read when a response arrives so a late one can be dropped. */
  const languageRef = useRef(language);
  languageRef.current = language;
  /** Bumped on every load so an older response cannot replace a newer one. */
  const loadRequestRef = useRef(0);
  /** Text the operator asked for, including a load that has not landed yet. */
  const requestedTextIdRef = useRef<string | null>(null);
  /** The room's last known position, read when a load lands. */
  const livePositionRef = useRef<LivePosition | null>(null);

  const {
    state,
    isOperator,
    notice,
    livePosition,
    isOpen,
    connect,
    disconnect,
    sendPosition,
    endSession,
  } = useRecitationSocket(eventId);
  livePositionRef.current = livePosition;

  const { data: event } = useQuery({
    queryKey: ["cms-event", eventId],
    queryFn: () => fetchCmsEvent(eventId ?? ""),
    enabled: Boolean(eventId),
    refetchOnWindowFocus: false,
  });

  const collectionId = event?.group_recitation_collection_id;

  // The liturgies of the event's own collection, which is what the operator
  // works through in order — no text id to paste in the common case.
  const { data: collection } = useQuery({
    queryKey: ["cms-chant-collection", groupId, collectionId],
    queryFn: () => fetchChantCollection(groupId ?? "", collectionId ?? ""),
    enabled: Boolean(groupId) && Boolean(collectionId),
    refetchOnWindowFocus: false,
  });

  const collectionItems = useMemo(
    () =>
      [...(collection?.items ?? [])].sort(
        (a, b) => a.display_order - b.display_order,
      ),
    [collection?.items],
  );

  const eventTitle = useMemo(() => {
    const rows = event ? metadataArray(event.metadata) : [];
    const preferred =
      rows.find((row) => row.language?.toUpperCase() === "EN") ?? rows[0];
    return preferred?.name?.trim() || "Untitled event";
  }, [event]);

  const eventPath =
    groupId && eventId ? ROUTES.groupEvent(groupId, eventId) : ROUTES.groups;

  const loadText = useCallback(async (requestedTextId: string) => {
    const trimmed = requestedTextId.trim();
    if (!trimmed) {
      setLoadError("Choose a liturgy, or enter a text id.");
      return;
    }
    const request = ++loadRequestRef.current;
    const requestedLanguage = languageRef.current;
    requestedTextIdRef.current = trimmed;
    setIsLoadingText(true);
    setLoadError(null);
    try {
      const details = await fetchRecitationDetails(
        trimmed,
        toWireLanguage(requestedLanguage),
      );
      // A liturgy or language chosen since this request started owns the screen.
      if (loadRequestRef.current !== request) return;
      if (languageRef.current !== requestedLanguage) return;
      const loaded = toOperatorSegments(
        details,
        toWireLanguage(requestedLanguage),
      );
      setSegments(loaded);
      setLoadedTextId(trimmed);
      loadedLanguageRef.current = requestedLanguage;
      // A session already under way is somewhere in this liturgy: start from
      // the room's line and round, so the next press advances the recitation
      // instead of sending it back to line one.
      const live = livePositionRef.current;
      const joined = live?.textId === trimmed;
      if (joined && live?.roundNumber != null && live.roundNumber >= 1) {
        setRound(live.roundNumber);
      }
      const liveIndex = joined && live?.index != null ? live.index : -1;
      setCurrentIndex(
        liveIndex >= 0 && liveIndex < loaded.length ? liveIndex : -1,
      );
    } catch (error) {
      if (loadRequestRef.current !== request) return;
      if (languageRef.current !== requestedLanguage) return;
      setSegments([]);
      setLoadedTextId(null);
      loadedLanguageRef.current = null;
      requestedTextIdRef.current = null;
      setLoadError(getApiErrorMessage(error, "Could not load this text."));
    } finally {
      if (
        loadRequestRef.current === request &&
        languageRef.current === requestedLanguage
      ) {
        setIsLoadingText(false);
      }
    }
  }, []);

  // Segment ids are per language, so the lines on screen have to be reloaded
  // when the operator switches language - otherwise they would be publishing
  // ids from the text they are no longer reading. A load still in flight counts:
  // its text id is not in state yet, and the old response must not land instead.
  useEffect(() => {
    const textToReload = requestedTextIdRef.current;
    if (!textToReload) return;
    if (loadedLanguageRef.current === language) return;
    void loadText(textToReload);
  }, [language, loadedTextId, loadText]);

  const scrollRowIntoView = (index: number) => {
    const node = listRef.current?.querySelector(`[data-row="${index}"]`);
    node?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const publish = useCallback(
    (index: number) => {
      if (index < 0 || index >= segments.length) return;
      const segment = segments[index];
      const sent = sendPosition({
        text_id: loadedTextId ?? textId.trim(),
        segment_id: segment.id,
        index,
        round_number: round,
      });
      if (!sent) return;
      setCurrentIndex(index);
      scrollRowIntoView(index);
      setLastSent(`line ${index + 1} at ${new Date().toLocaleTimeString()}`);
    },
    [segments, sendPosition, loadedTextId, textId, round],
  );

  // space / ↓ advance, ↑ goes back — the operator drives without leaving the
  // liturgy. Fields and toolbar controls keep their own keys: Space on
  // "Load text" or a round button must activate that control, not the next line.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!allowsLiveShortcut(event.target)) return;
      if (event.code === "Space" || event.code === "ArrowDown") {
        event.preventDefault();
        publish(currentIndex + 1);
      } else if (event.code === "ArrowUp") {
        event.preventDefault();
        publish(currentIndex - 1);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [publish, currentIndex]);

  // A position from the room names the liturgy it belongs to; adopt it when the
  // operator has not picked one yet (a session someone else started).
  useEffect(() => {
    if (livePosition?.textId && !textId.trim() && !loadedTextId) {
      setTextId(livePosition.textId);
    }
  }, [livePosition?.textId, textId, loadedTextId]);

  if (!canWrite) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 py-10 text-center">
        <p className="text-muted-foreground">
          You do not have permission to drive this event&apos;s recitation.
        </p>
        <Pecha.Button variant="outline" onClick={() => navigate(eventPath)}>
          Back to event
        </Pecha.Button>
      </div>
    );
  }

  const statusLabel = STATE_LABEL[state];
  const online = state === "connected";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => navigate(eventPath)}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Event
        </button>
        <div className="flex items-center gap-2">
          {/* The server decides who may publish, so the role is only known
              once a socket is up. */}
          {isOpen || state === "ended" ? (
            <Pecha.Badge variant={isOperator ? "secondary" : "destructive"}>
              {isOperator ? "operator" : "cannot publish"}
            </Pecha.Badge>
          ) : null}
          {livePosition?.roundNumber ? (
            <Pecha.Badge variant="outline">
              round {livePosition.roundNumber}
            </Pecha.Badge>
          ) : null}
        </div>
      </div>

      <div className="flex flex-col overflow-hidden rounded-2xl border bg-card">
        <div className="border-b px-4 py-3">
          <div className="flex items-center gap-2">
            <LuRadio className="h-4 w-4 text-muted-foreground" />
            <h1 className="text-base font-semibold">Live recitation control</h1>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span
              aria-hidden
              className={`inline-block h-2.5 w-2.5 rounded-full ${
                online ? "animate-pulse bg-emerald-500" : "bg-red-500"
              }`}
            />
            <span data-testid="connection-state">{statusLabel}</span>
            <span>·</span>
            <span className="truncate">{eventTitle}</span>
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-2 border-b bg-muted/30 px-4 py-3">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground" htmlFor="language">
              Language
            </label>
            <Pecha.Select value={language} onValueChange={setLanguage}>
              <Pecha.SelectTrigger id="language" className="w-28">
                <Pecha.SelectValue />
              </Pecha.SelectTrigger>
              <Pecha.SelectContent>
                {languageOptions.map((option) => (
                  <Pecha.SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </Pecha.SelectItem>
                ))}
              </Pecha.SelectContent>
            </Pecha.Select>
          </div>

          {isOpen ? (
            <Pecha.Button variant="outline" onClick={disconnect}>
              Disconnect
            </Pecha.Button>
          ) : (
            <Pecha.Button onClick={connect}>
              {state === "connecting" || state === "reconnecting"
                ? "Connecting…"
                : "Connect"}
            </Pecha.Button>
          )}

          <Pecha.Button
            variant="destructive"
            disabled={!isOpen || !isOperator}
            onClick={endSession}
            className="ml-auto"
          >
            End session
          </Pecha.Button>
        </div>

        <div className="flex flex-wrap items-end gap-2 border-b bg-muted/30 px-4 py-3">
          {collectionItems.length > 0 ? (
            <div className="min-w-[240px] flex-1 space-y-1">
              <label
                className="text-xs text-muted-foreground"
                htmlFor="liturgy"
              >
                Liturgy
              </label>
              <Pecha.Select
                value={textId || undefined}
                onValueChange={(value) => {
                  setTextId(value);
                  void loadText(value);
                }}
              >
                <Pecha.SelectTrigger id="liturgy" className="w-full">
                  <Pecha.SelectValue placeholder="Pick from this event's chant collection" />
                </Pecha.SelectTrigger>
                <Pecha.SelectContent>
                  {collectionItems.map((item) => (
                    <Pecha.SelectItem key={item.id} value={item.text_id}>
                      {item.title}
                    </Pecha.SelectItem>
                  ))}
                </Pecha.SelectContent>
              </Pecha.Select>
            </div>
          ) : (
            <div className="min-w-[240px] flex-1 space-y-1">
              <label className="text-xs text-muted-foreground" htmlFor="textId">
                Text id
              </label>
              <Pecha.Input
                id="textId"
                value={textId}
                onChange={(e) => setTextId(e.target.value)}
                placeholder="text_id of the liturgy to recite"
              />
            </div>
          )}

          <Pecha.Button
            variant="outline"
            disabled={isLoadingText}
            onClick={() => void loadText(textId)}
          >
            {isLoadingText ? "Loading…" : "Load text"}
          </Pecha.Button>

          <div className="space-y-1">
            <span className="block text-xs text-muted-foreground">Round</span>
            <div className="flex items-center gap-1">
              <Pecha.Button
                variant="outline"
                size="icon"
                aria-label="Previous round"
                onClick={() => setRound((value) => Math.max(1, value - 1))}
              >
                −
              </Pecha.Button>
              <Pecha.Input
                aria-label="Round"
                className="w-16 text-center"
                type="number"
                min={1}
                value={round}
                onChange={(e) =>
                  setRound(Math.max(1, Number(e.target.value) || 1))
                }
              />
              <Pecha.Button
                variant="outline"
                size="icon"
                aria-label="Next round"
                onClick={() => setRound((value) => value + 1)}
              >
                +
              </Pecha.Button>
            </div>
          </div>
        </div>

        {notice || loadError ? (
          <p className="border-b bg-amber-50 px-4 py-2 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
            {loadError ?? notice}
          </p>
        ) : null}

        <div ref={listRef} className="h-[min(60vh,32rem)] overflow-y-auto">
          {segments.length === 0 ? (
            <p className="px-4 py-12 text-center text-sm text-muted-foreground">
              Load a liturgy, then click a line (or press space / ↓) to advance
              the room.
            </p>
          ) : (
            segments.map((segment, index) => (
              <button
                key={segment.id}
                type="button"
                data-row={index}
                onClick={() => publish(index)}
                className={`block w-full cursor-pointer border-l-4 px-4 py-2.5 text-left text-[15px] leading-relaxed whitespace-pre-wrap hover:bg-muted/60 ${
                  index === currentIndex
                    ? "border-l-primary bg-primary/10 font-semibold"
                    : "border-l-transparent"
                }`}
              >
                <span className="mr-2 text-xs text-muted-foreground">
                  {index + 1}
                </span>
                {segment.content}
              </button>
            ))
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t bg-muted/30 px-4 py-2 text-xs text-muted-foreground">
          <span>space / ↓ next · ↑ previous · click any line to jump</span>
          <span className="ml-auto">
            {lastSent ? `sent ${lastSent}` : null}
            {livePosition && !lastSent
              ? `live line ${
                  livePosition.index != null ? livePosition.index + 1 : "?"
                }`
              : null}
          </span>
        </div>
      </div>
    </div>
  );
};

export default GroupEventLivePage;
