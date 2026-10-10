import { useEffect, useRef, useState, type ReactNode } from "react";

/** One tile in the menu. */
export interface TouchMenuItem {
  id: string;
  label: string;
  icon: ReactNode;
  onSelect: () => void;
  disabled?: boolean;
  /** Drawn lit, for the title the screen is in. */
  active?: boolean;
}

/** Where the dot sits, as a share of the room it can move in, so a phone
 * turned sideways keeps it on the same edge rather than off the screen. */
interface DotPosition {
  x: number;
  y: number;
}

const TOUCH_DOT_STORAGE_KEY = "live-control-touch-dot";
const DOT_SIZE = 56;
/** Kept off the very edge of the glass, where a swipe is the system's. */
const EDGE = 8;
/** A press that moves less than this is a tap, not a drag. */
const DRAG_THRESHOLD = 6;
/** Right edge, a little above the middle: clear of Next, which is at the foot. */
const DEFAULT_POSITION: DotPosition = { x: 1, y: 0.4 };

const clampShare = (value: number) => Math.min(1, Math.max(0, value));

const readStoredDotPosition = (): DotPosition => {
  try {
    const raw = localStorage.getItem(TOUCH_DOT_STORAGE_KEY);
    if (!raw) return DEFAULT_POSITION;
    const parsed = JSON.parse(raw) as Partial<DotPosition>;
    if (!Number.isFinite(parsed?.x) || !Number.isFinite(parsed?.y)) {
      return DEFAULT_POSITION;
    }
    return { x: clampShare(parsed.x!), y: clampShare(parsed.y!) };
  } catch {
    return DEFAULT_POSITION;
  }
};

const storeDotPosition = (position: DotPosition) => {
  try {
    localStorage.setItem(TOUCH_DOT_STORAGE_KEY, JSON.stringify(position));
  } catch {
    // Blocked site data: the dot stays put for this session only.
  }
};

const viewport = () => ({
  width: window.innerWidth,
  height: window.innerHeight,
});

/**
 * A dot that floats over the lines, like the phone's own assistive touch: it
 * is dragged anywhere and stays where it was left, and a tap opens the titles
 * as a grid of icons, so any one is a thumb's reach away wherever the screen
 * is held.
 */
export function TouchMenu({
  label,
  title,
  items,
}: {
  /** What the dot is called, for a screen reader. */
  label: string;
  /** The menu's heading, for a screen reader. */
  title: string;
  items: TouchMenuItem[];
}) {
  const [position, setPosition] = useState<DotPosition>(readStoredDotPosition);
  const [size, setSize] = useState(viewport);
  const [open, setOpen] = useState(false);
  /** Where the dot is while a finger drags it, in pixels. */
  const [dragAt, setDragAt] = useState<{ left: number; top: number } | null>(
    null,
  );
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    left: number;
    top: number;
    moved: boolean;
  } | null>(null);
  /** Set when a drag ends, so the click that follows does not open the menu. */
  const justDraggedRef = useRef(false);
  const dotRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  /** Set when the menu is dismissed rather than used, so focus goes back to
   * the dot once it is drawn again. A tile leaves focus to what it opened. */
  const refocusDotRef = useRef(false);

  const dismiss = () => {
    refocusDotRef.current = true;
    setOpen(false);
  };

  useEffect(() => {
    const onResize = () => setSize(viewport());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const roomX = Math.max(0, size.width - DOT_SIZE - EDGE * 2);
  const roomY = Math.max(0, size.height - DOT_SIZE - EDGE * 2);
  const left = dragAt?.left ?? EDGE + position.x * roomX;
  const top = dragAt?.top ?? EDGE + position.y * roomY;

  useEffect(() => {
    if (!open) {
      if (refocusDotRef.current) dotRef.current?.focus();
      refocusDotRef.current = false;
      return;
    }
    menuRef.current
      ?.querySelector<HTMLButtonElement>("button:not(:disabled)")
      ?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      refocusDotRef.current = true;
      setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [open]);

  const onPointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return;
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      left,
      top,
      moved: false,
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const onPointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    if (!drag.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
    drag.moved = true;
    setDragAt({
      left: Math.min(EDGE + roomX, Math.max(EDGE, drag.left + dx)),
      top: Math.min(EDGE + roomY, Math.max(EDGE, drag.top + dy)),
    });
  };

  const endDrag = (event: React.PointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    if (!drag.moved || !dragAt) return;
    justDraggedRef.current = true;
    const next = {
      x: roomX > 0 ? clampShare((dragAt.left - EDGE) / roomX) : 0,
      y: roomY > 0 ? clampShare((dragAt.top - EDGE) / roomY) : 0,
    };
    setPosition(next);
    setDragAt(null);
    storeDotPosition(next);
  };

  const choose = (item: TouchMenuItem) => {
    setOpen(false);
    item.onSelect();
  };

  return (
    <>
      {open ? null : (
        <button
          ref={dotRef}
          type="button"
          aria-label={label}
          aria-haspopup="dialog"
          title={label}
          data-touch-dot=""
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onClick={() => {
            if (justDraggedRef.current) {
              justDraggedRef.current = false;
              return;
            }
            setOpen(true);
          }}
          style={{ left, top, width: DOT_SIZE, height: DOT_SIZE }}
          className={`fixed z-40 flex cursor-pointer touch-none items-center justify-center rounded-[16px] bg-[#1c1c1e]/70 shadow-lg backdrop-blur-md select-none ${
            dragAt ? "opacity-100" : "opacity-60 hover:opacity-100"
          }`}
        >
          <span
            aria-hidden="true"
            className="flex size-10 items-center justify-center rounded-full bg-white/25"
          >
            <span className="size-7 rounded-full bg-white/80" />
          </span>
        </button>
      )}
      {open ? (
        <div
          data-touch-menu-backdrop=""
          onClick={(event) => {
            if (event.target === event.currentTarget) dismiss();
          }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
        >
          <div
            ref={menuRef}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className="grid max-h-full w-[min(22rem,100%)] grid-cols-3 gap-1 overflow-y-auto overscroll-contain rounded-[28px] bg-[#1c1c1e]/85 p-4 font-tibetan-ui sm:w-[min(28rem,100%)] sm:grid-cols-4 text-[#f2f2f7] shadow-2xl backdrop-blur-xl"
          >
            {items.map((item) => (
              <button
                key={item.id}
                type="button"
                data-touch-item={item.id}
                aria-current={item.active ? "true" : undefined}
                title={item.label}
                disabled={item.disabled}
                onClick={() => choose(item)}
                className={`flex min-h-[5.5rem] min-w-0 cursor-pointer flex-col items-center justify-start gap-1.5 rounded-2xl px-1 py-2 text-center text-[12px] leading-snug focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-35 ${
                  item.active
                    ? "bg-[#e5231c] text-white"
                    : "hover:bg-white/10 focus-visible:bg-white/10"
                }`}
              >
                <span aria-hidden="true" className="text-[30px] leading-none">
                  {item.icon}
                </span>
                <span className="line-clamp-2 w-full [overflow-wrap:anywhere]">
                  {item.label}
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </>
  );
}
