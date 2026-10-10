import { useCallback, useEffect, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { tolgee } from "@/i18n/tolgee";
import { useAppUpdate } from "./appUpdateContext";
import { defersAppUpdate, type StudioRouter } from "./defersAppUpdate";

const TOAST_ID = "pwa-update";

/**
 * Announces a new deploy once, at the top of the screen. Closed - or held back
 * on a live session, where it would cover Next - it leaves the Update button to
 * carry the update until the author reloads. On a page without that button
 * (sign-in, the autoplay test) it cannot be closed, so the update stays in reach.
 */
export function PwaUpdatePrompt({
  router,
}: Readonly<{ router: StudioRouter }>) {
  const { ready, promptClosed, closePrompt, reload, hasUpdateButton } =
    useAppUpdate();

  const subscribe = useCallback(
    (onChange: () => void) => router.subscribe(onChange),
    [router],
  );
  const deferred = useSyncExternalStore(subscribe, () =>
    defersAppUpdate(router),
  );

  useEffect(() => {
    if (!ready) return;
    if (deferred || (promptClosed && hasUpdateButton)) {
      toast.dismiss(TOAST_ID);
      closePrompt();
      return;
    }
    toast(tolgee.t("studio.pwa.ready_toast_title"), {
      id: TOAST_ID,
      description: tolgee.t("studio.pwa.ready_toast_description"),
      duration: Infinity,
      // At the bottom it sits over the page's own controls on a phone.
      position: "top-center",
      // Only where the Update button can take over once it is gone.
      closeButton: hasUpdateButton,
      dismissible: hasUpdateButton,
      onDismiss: closePrompt,
      action: { label: tolgee.t("studio.pwa.reload"), onClick: reload },
    });
  }, [ready, promptClosed, deferred, hasUpdateButton, closePrompt, reload]);

  return null;
}
