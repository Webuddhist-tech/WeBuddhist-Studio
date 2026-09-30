import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useWakeLock } from "./useWakeLock";

describe("useWakeLock", () => {
  let request: ReturnType<typeof vi.fn>;
  let releases: ReturnType<typeof vi.fn>[];
  let visibility: DocumentVisibilityState;

  beforeEach(() => {
    releases = [];
    visibility = "visible";
    request = vi.fn(async () => {
      const release = vi.fn(async () => {});
      releases.push(release);
      return { release, addEventListener: vi.fn() };
    });
    Object.defineProperty(navigator, "wakeLock", {
      value: { request },
      configurable: true,
    });
    vi.spyOn(document, "visibilityState", "get").mockImplementation(
      () => visibility,
    );
  });

  afterEach(() => {
    Reflect.deleteProperty(navigator, "wakeLock");
    vi.restoreAllMocks();
  });

  it("keeps the screen on while active, and lets it go after", async () => {
    const { rerender } = renderHook(({ active }) => useWakeLock(active), {
      initialProps: { active: true },
    });
    await waitFor(() => expect(request).toHaveBeenCalledWith("screen"));

    rerender({ active: false });

    await waitFor(() => expect(releases[0]).toHaveBeenCalled());
  });

  it("asks nothing while inactive", () => {
    renderHook(() => useWakeLock(false));

    expect(request).not.toHaveBeenCalled();
  });

  it("does not ask again while the first request is still waiting", async () => {
    let resolveRequest: (value: {
      release: ReturnType<typeof vi.fn>;
      addEventListener: ReturnType<typeof vi.fn>;
    }) => void = () => {};
    request.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveRequest = resolve;
        }),
    );
    const { unmount } = renderHook(() => useWakeLock(true));
    await waitFor(() => expect(request).toHaveBeenCalledTimes(1));

    visibility = "hidden";
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    visibility = "visible";
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(request).toHaveBeenCalledTimes(1);

    const release = vi.fn(async () => {});
    await act(async () => {
      resolveRequest({ release, addEventListener: vi.fn() });
    });
    unmount();
    await waitFor(() => expect(release).toHaveBeenCalled());
  });

  it("asks again when the page comes back, since the browser let it go", async () => {
    renderHook(() => useWakeLock(true));
    await waitFor(() => expect(request).toHaveBeenCalledTimes(1));
    // The browser releases the lock when the page is hidden.
    const released = request.mock.results[0].value as Promise<{
      addEventListener: ReturnType<typeof vi.fn>;
    }>;
    const sentinel = await released;
    const onRelease = sentinel.addEventListener.mock.calls[0][1] as () => void;
    act(() => onRelease());

    visibility = "visible";
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });

    await waitFor(() => expect(request).toHaveBeenCalledTimes(2));
  });

  it("does nothing where the browser has no wake lock", () => {
    Reflect.deleteProperty(navigator, "wakeLock");

    expect(() => renderHook(() => useWakeLock(true))).not.toThrow();
  });

  it("takes a refusal quietly", async () => {
    request.mockRejectedValueOnce(new Error("low battery"));

    renderHook(() => useWakeLock(true));

    await waitFor(() => expect(request).toHaveBeenCalled());
  });
});
