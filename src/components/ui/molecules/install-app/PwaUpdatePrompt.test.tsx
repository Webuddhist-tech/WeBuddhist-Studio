import type { ComponentProps } from "react";
import { act, render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import { PwaUpdatePrompt } from "./PwaUpdatePrompt";
import { AppUpdateContext, type AppUpdate } from "./appUpdateContext";
import { DEFERS_APP_UPDATE } from "./defersAppUpdate";

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { dismiss: vi.fn() }),
}));

type Page = "live" | "dashboard";

/** Just what the prompt reads of the router: where it is, and when it moves.
 * A real router's navigate trips over jsdom's AbortSignal. */
const makeRouter = (page: Page) => {
  const listeners = new Set<() => void>();
  const matchesFor = (next: Page) => [
    { route: { handle: next === "live" ? DEFERS_APP_UPDATE : undefined } },
  ];
  const router = {
    state: { matches: matchesFor(page) },
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    navigate: (next: Page) => {
      router.state = { matches: matchesFor(next) };
      listeners.forEach((listener) => listener());
    },
  };
  return router as typeof router &
    ComponentProps<typeof PwaUpdatePrompt>["router"];
};

const closePrompt = vi.fn();
const reload = vi.fn();

const renderPrompt = (
  router: ReturnType<typeof makeRouter>,
  update: Partial<AppUpdate> = {},
) =>
  render(
    <AppUpdateContext
      value={{
        ready: true,
        promptClosed: false,
        closePrompt,
        reload,
        hasUpdateButton: true,
        hostUpdateButton: () => () => {},
        ...update,
      }}
    >
      <PwaUpdatePrompt router={router} />
    </AppUpdateContext>,
  );

type ToastOptions = {
  id: string;
  position: string;
  closeButton: boolean;
  dismissible: boolean;
  onDismiss: () => void;
  action: { onClick: () => void };
};

const lastToastOptions = () =>
  vi.mocked(toast).mock.lastCall?.[1] as unknown as ToastOptions;

describe("PwaUpdatePrompt", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows nothing while the Studio is up to date", () => {
    renderPrompt(makeRouter("dashboard"), { ready: false });
    expect(toast).not.toHaveBeenCalled();
  });

  it("offers a reload at the top, where it can be closed", () => {
    renderPrompt(makeRouter("dashboard"));

    expect(toast).toHaveBeenCalledWith(
      "studio.pwa.ready_toast_title",
      expect.any(Object),
    );
    const options = lastToastOptions();
    expect(options.position).toBe("top-center");
    expect(options.closeButton).toBe(true);

    options.action.onClick();
    expect(reload).toHaveBeenCalled();
  });

  it("hands over to the Update button once closed", () => {
    renderPrompt(makeRouter("dashboard"));
    lastToastOptions().onDismiss();
    expect(closePrompt).toHaveBeenCalled();
  });

  it("does not come back once closed", () => {
    renderPrompt(makeRouter("dashboard"), { promptClosed: true });
    expect(toast).not.toHaveBeenCalled();
  });

  it("cannot be closed on a page without the Update button", () => {
    renderPrompt(makeRouter("dashboard"), { hasUpdateButton: false });

    const options = lastToastOptions();
    expect(options.closeButton).toBe(false);
    expect(options.dismissible).toBe(false);
  });

  it("comes back on a page without the Update button, even once closed", () => {
    renderPrompt(makeRouter("dashboard"), {
      promptClosed: true,
      hasUpdateButton: false,
    });
    expect(toast).toHaveBeenCalledTimes(1);
  });

  it("holds the toast during a live session and leaves it to the button", () => {
    renderPrompt(makeRouter("live"));
    expect(toast).not.toHaveBeenCalled();
    expect(closePrompt).toHaveBeenCalled();
  });

  it("takes the toast down when a live session opens", () => {
    const router = makeRouter("dashboard");
    renderPrompt(router);
    expect(toast).toHaveBeenCalledTimes(1);

    act(() => router.navigate("live"));

    expect(toast.dismiss).toHaveBeenCalledWith(lastToastOptions().id);
    expect(closePrompt).toHaveBeenCalled();
    expect(toast).toHaveBeenCalledTimes(1);
  });
});
