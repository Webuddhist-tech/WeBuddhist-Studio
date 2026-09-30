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
    let disposed = false;

    const acquire = async () => {
      if (document.visibilityState !== "visible" || sentinel) return;
      try {
        const held = await wakeLock.request("screen");
        if (disposed) {
          void held.release();
          return;
        }
        sentinel = held;
        held.addEventListener?.("release", () => {
          if (sentinel === held) sentinel = null;
        });
      } catch {
        // Refused - low battery, a policy, a background tab. Not worth a word.
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
