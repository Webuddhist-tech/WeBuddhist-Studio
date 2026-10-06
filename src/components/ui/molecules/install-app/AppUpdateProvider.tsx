import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRegisterSW } from "virtual:pwa-register/react";
import { AppUpdateContext } from "./appUpdateContext";

/** Authors keep the Studio open for days; look for a new deploy this often. */
const UPDATE_CHECK_MS = 60 * 60 * 1000;

/**
 * Registers the service worker, once for the whole Studio, and shares whether a
 * new deploy is waiting. It never reloads by itself, so nobody loses a
 * half-written plan or post: the toast and the Update button ask first.
 */
export function AppUpdateProvider({
  children,
}: Readonly<{ children: ReactNode }>) {
  const registrationRef = useRef<ServiceWorkerRegistration | undefined>(
    undefined,
  );
  const updateCheckRef = useRef<ReturnType<typeof setInterval> | undefined>(
    undefined,
  );

  const {
    needRefresh: [ready],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (!registration) return;
      registrationRef.current = registration;
      clearInterval(updateCheckRef.current);
      updateCheckRef.current = setInterval(() => {
        if (navigator.onLine) void registration.update();
      }, UPDATE_CHECK_MS);
    },
  });

  useEffect(() => () => clearInterval(updateCheckRef.current), []);

  const [promptClosed, setPromptClosed] = useState(false);
  const closePrompt = useCallback(() => setPromptClosed(true), []);

  const [updateButtons, setUpdateButtons] = useState(0);
  const hostUpdateButton = useCallback(() => {
    setUpdateButtons((count) => count + 1);
    return () => setUpdateButtons((count) => count - 1);
  }, []);

  const reload = useCallback(() => {
    // Promoting the waiting worker reloads every open tab into it. When another
    // tab - the Studio beside live control - has already done that, nothing is
    // left waiting, and a plain reload is what loads the new version.
    if (registrationRef.current?.waiting) void updateServiceWorker(true);
    else window.location.reload();
  }, [updateServiceWorker]);

  const hasUpdateButton = updateButtons > 0;
  const value = useMemo(
    () => ({
      ready,
      promptClosed,
      closePrompt,
      reload,
      hasUpdateButton,
      hostUpdateButton,
    }),
    [
      ready,
      promptClosed,
      closePrompt,
      reload,
      hasUpdateButton,
      hostUpdateButton,
    ],
  );

  return <AppUpdateContext value={value}>{children}</AppUpdateContext>;
}
