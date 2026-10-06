import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppUpdateProvider } from "./AppUpdateProvider";
import { useAppUpdate, type AppUpdate } from "./appUpdateContext";

type RegisterOptions = {
  onRegisteredSW?: (
    url: string,
    registration?: ServiceWorkerRegistration,
  ) => void;
};

const updateServiceWorker = vi.fn();
let needRefresh = false;
let registerOptions: RegisterOptions = {};

vi.mock("virtual:pwa-register/react", () => ({
  useRegisterSW: (options: RegisterOptions) => {
    registerOptions = options;
    return {
      needRefresh: [needRefresh, vi.fn()],
      offlineReady: [false, vi.fn()],
      updateServiceWorker,
    };
  },
}));

let seen: AppUpdate;
const Probe = () => {
  seen = useAppUpdate();
  return null;
};

const renderProvider = () =>
  render(
    <AppUpdateProvider>
      <Probe />
    </AppUpdateProvider>,
  );

/** What the browser hands over once the service worker is registered. */
const register = (registration: Partial<ServiceWorkerRegistration>) =>
  registerOptions.onRegisteredSW?.(
    "/sw.js",
    registration as ServiceWorkerRegistration,
  );

const HOUR = 60 * 60 * 1000;
const originalLocation = window.location;

describe("AppUpdateProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    needRefresh = false;
    registerOptions = {};
    Object.defineProperty(window, "location", {
      value: { ...originalLocation, reload: vi.fn() },
      configurable: true,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    Object.defineProperty(window, "location", {
      value: originalLocation,
      configurable: true,
    });
  });

  it("shares that no update is waiting", () => {
    renderProvider();
    expect(seen.ready).toBe(false);
    expect(seen.promptClosed).toBe(false);
  });

  it("reloads into the waiting version", () => {
    needRefresh = true;
    renderProvider();
    register({ waiting: {} as ServiceWorker, update: vi.fn() });
    expect(seen.ready).toBe(true);

    seen.reload();

    expect(updateServiceWorker).toHaveBeenCalledWith(true);
    expect(window.location.reload).not.toHaveBeenCalled();
  });

  it("reloads the page when another tab has already taken the update", () => {
    needRefresh = true;
    renderProvider();
    register({ waiting: null, update: vi.fn() });

    seen.reload();

    expect(updateServiceWorker).not.toHaveBeenCalled();
    expect(window.location.reload).toHaveBeenCalled();
  });

  it("remembers that the toast was closed", () => {
    needRefresh = true;
    renderProvider();

    act(() => seen.closePrompt());

    expect(seen.promptClosed).toBe(true);
  });

  it("knows while a page shows the Update button", () => {
    renderProvider();
    expect(seen.hasUpdateButton).toBe(false);

    let leave = () => {};
    act(() => {
      leave = seen.hostUpdateButton();
    });
    expect(seen.hasUpdateButton).toBe(true);

    act(() => leave());
    expect(seen.hasUpdateButton).toBe(false);
  });

  it("looks for a new deploy every hour until it unmounts", () => {
    vi.useFakeTimers();
    const update = vi.fn().mockResolvedValue(undefined);
    const { unmount } = renderProvider();
    register({ waiting: null, update });

    vi.advanceTimersByTime(HOUR);
    expect(update).toHaveBeenCalledTimes(1);

    unmount();
    vi.advanceTimersByTime(HOUR);
    expect(update).toHaveBeenCalledTimes(1);
  });
});
