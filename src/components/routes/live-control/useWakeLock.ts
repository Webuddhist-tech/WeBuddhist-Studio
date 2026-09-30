import { useEffect } from "react";

interface WakeLockSentinelLike {
  release: () => Promise<void>;
  addEventListener?: (type: "release", listener: () => void) => void;
}

interface WakeLockLike {
  request: (type: "screen") => Promise<WakeLockSentinelLike>;
}

/**
 * Keeps the screen on while `active`. The browser lets the lock go whenever
 * the page is hidden, so it is asked for again each time the page comes back.
 * Where there is no Wake Lock - an older browser, a plain-HTTP page - nothing
 * happens: the screen simply sleeps as it would have.
 */
export function useWakeLock(active: boolean): void {
  useEffect(() => {
    const wakeLock = (navigator as Navigator & { wakeLock?: WakeLockLike })
      .wakeLock;
    if (!active || !wakeLock) return;
    let sentinel: WakeLockSentinelLike | null = null;
    let pending = false;
    let disposed = false;

    const acquire = async () => {
      // A second ask while the first request is still out would replace its
      // lock, and cleanup would release only the later one.
      if (document.visibilityState !== "visible" || sentinel || pending) return;
      pending = true;
      try {
        const held = await wakeLock.request("screen");
        if (disposed || sentinel) {
          void held.release().catch(() => {});
          return;
        }
        sentinel = held;
        held.addEventListener?.("release", () => {
          if (sentinel === held) sentinel = null;
        });
      } catch {
        // Refused - low battery, a policy, a background tab. Not worth a word.
      } finally {
        pending = false;
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") void acquire();
    };

    void acquire();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      disposed = true;
      document.removeEventListener("visibilitychange", onVisibility);
      const held = sentinel;
      sentinel = null;
      if (held) void held.release().catch(() => {});
    };
  }, [active]);
}
