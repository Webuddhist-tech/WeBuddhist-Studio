import { useCallback, useEffect, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { useAppUpdate } from "./appUpdateContext";
import { defersAppUpdate, type StudioRouter } from "./defersAppUpdate";

const TOAST_ID = "pwa-update";

/**
 * Announces a new deploy once, at the top of the screen. Closed - or held back
 * on a live session, where it would cover Next - it leaves the Update button to
 * carry the update until the author reloads.
 */
export function PwaUpdatePrompt({
  router,
}: Readonly<{ router: StudioRouter }>) {
  const { ready, promptClosed, closePrompt, reload } = useAppUpdate();

  const subscribe = useCallback(
    (onChange: () => void) => router.subscribe(onChange),
    [router],
  );
  const deferred = useSyncExternalStore(subscribe, () =>
    defersAppUpdate(router),
  );

  useEffect(() => {
    if (!ready) return;
    if (promptClosed || deferred) {
      toast.dismiss(TOAST_ID);
      closePrompt();
      return;
    }
    toast("A new version of the Studio is ready", {
      id: TOAST_ID,
      description: "Reload when you have saved your work.",
      duration: Infinity,
      // At the bottom it sits over the page's own controls on a phone.
      position: "top-center",
      closeButton: true,
      onDismiss: closePrompt,
      action: { label: "Reload", onClick: reload },
    });
  }, [ready, promptClosed, deferred, closePrompt, reload]);

  return null;
}
