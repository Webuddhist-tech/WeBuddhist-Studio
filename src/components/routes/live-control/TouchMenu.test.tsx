import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TouchMenu, type TouchMenuItem } from "./TouchMenu";

const STORAGE_KEY = "live-control-touch-dot";

const renderMenu = (items: Partial<TouchMenuItem>[] = []) => {
  const full: TouchMenuItem[] = items.map((item, index) => ({
    id: `item-${index}`,
    label: `Item ${index}`,
    icon: null,
    onSelect: vi.fn(),
    ...item,
  }));
  render(<TouchMenu label="Quick menu dot" title="Quick menu" items={full} />);
  return full;
};

const dot = () => screen.getByRole("button", { name: "Quick menu dot" });

describe("TouchMenu", () => {
  beforeEach(() => {
    // jsdom has no PointerEvent, so a pointer's position would be lost.
    class TestPointerEvent extends MouseEvent {
      pointerId: number;
      constructor(type: string, init: PointerEventInit = {}) {
        super(type, init);
        this.pointerId = init.pointerId ?? 0;
      }
    }
    vi.stubGlobal("PointerEvent", TestPointerEvent);
    localStorage.clear();
    Object.defineProperty(window, "innerWidth", {
      value: 1000,
      configurable: true,
    });
    Object.defineProperty(window, "innerHeight", {
      value: 800,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it("opens the titles on a tap, and jumps to the one chosen", () => {
    const [first, second] = renderMenu([
      { label: "Mandala", icon: "🪷", active: true },
      { label: "Praise", icon: "☸️" },
    ]);

    fireEvent.click(dot());

    expect(screen.getByRole("dialog", { name: "Quick menu" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Quick menu dot" })).toBeNull();
    expect(screen.getByRole("button", { name: "Mandala" })).toHaveAttribute(
      "aria-current",
      "true",
    );
    fireEvent.click(screen.getByRole("button", { name: "Praise" }));

    expect(second.onSelect).toHaveBeenCalledTimes(1);
    expect(first.onSelect).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(dot()).toBeTruthy();
  });

  it("closes on Escape or a tap beside the tiles, and gives focus back", () => {
    const [item] = renderMenu([{ label: "Mandala" }]);

    fireEvent.click(dot());
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(dot());

    fireEvent.click(dot());
    fireEvent.click(
      document.querySelector("[data-touch-menu-backdrop]") as HTMLElement,
    );
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(item.onSelect).not.toHaveBeenCalled();
  });

  it("does not jump to a title with nothing to land on", () => {
    const [item] = renderMenu([{ label: "Mandala", disabled: true }]);

    fireEvent.click(dot());
    fireEvent.click(screen.getByRole("button", { name: "Mandala" }));

    expect(item.onSelect).not.toHaveBeenCalled();
  });

  it("is dragged, stays where it was left, and a drag does not open it", () => {
    renderMenu([{ label: "Mandala" }]);
    const start = { left: dot().style.left, top: dot().style.top };

    fireEvent.pointerDown(dot(), {
      pointerId: 1,
      button: 0,
      clientX: 500,
      clientY: 400,
    });
    fireEvent.pointerMove(dot(), { pointerId: 1, clientX: 100, clientY: 100 });
    fireEvent.pointerUp(dot(), { pointerId: 1, clientX: 100, clientY: 100 });
    fireEvent.click(dot());

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(dot().style.left).not.toBe(start.left);
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
    expect(stored.x).toBeGreaterThanOrEqual(0);
    expect(stored.x).toBeLessThan(1);
    expect(stored.y).toBeGreaterThanOrEqual(0);
    expect(stored.y).toBeLessThan(0.4);
  });

  it("starts where it was last left, and ignores a broken record", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ x: 0, y: 0 }));
    const { unmount } = render(
      <TouchMenu label="Quick menu dot" title="Quick menu" items={[]} />,
    );
    expect(dot().style.left).toBe("8px");
    expect(dot().style.top).toBe("8px");
    unmount();

    localStorage.setItem(STORAGE_KEY, "not json");
    render(<TouchMenu label="Quick menu dot" title="Quick menu" items={[]} />);
    // The right edge: 1000 wide, less the 56px dot and the 8px margin.
    expect(dot().style.left).toBe("936px");
  });
});
