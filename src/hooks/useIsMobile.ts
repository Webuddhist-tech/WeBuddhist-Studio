import { useSyncExternalStore } from "react";

/** Below Tailwind's `md`, where the Studio switches to its phone layout. */
export const MOBILE_QUERY = "(max-width: 767.98px)";

const mobileQuery = (): MediaQueryList | null => {
  try {
    return typeof window === "undefined" || !window.matchMedia
      ? null
      : window.matchMedia(MOBILE_QUERY);
  } catch {
    return null;
  }
};

const subscribe = (onChange: () => void) => {
  const query = mobileQuery();
  query?.addEventListener("change", onChange);
  return () => query?.removeEventListener("change", onChange);
};

/** Without `matchMedia` (tests, SSR) there is no phone to lay out for. */
const isMobileNow = () => mobileQuery()?.matches ?? false;

/** True on a phone-sized viewport, and follows the viewport as it changes. */
export function useIsMobile(): boolean {
  return useSyncExternalStore(subscribe, isMobileNow, () => false);
}
