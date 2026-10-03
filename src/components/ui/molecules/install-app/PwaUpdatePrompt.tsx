import { useEffect } from "react";
import { toast } from "sonner";
import { useRegisterSW } from "virtual:pwa-register/react";

/** Authors keep the Studio open for days; look for a new deploy this often. */
const UPDATE_CHECK_MS = 60 * 60 * 1000;

/**
 * Registers the service worker and, when a new version has been deployed,
 * offers to reload into it. It never reloads by itself, so nobody loses a
 * half-written plan or post.
 */
export function PwaUpdatePrompt() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (!registration) return;
      setInterval(() => {
        if (navigator.onLine) void registration.update();
      }, UPDATE_CHECK_MS);
    },
  });

  useEffect(() => {
    if (!needRefresh) return;
    toast("A new version of the Studio is ready", {
      id: "pwa-update",
      description: "Reload when you have saved your work.",
      duration: Infinity,
      action: {
        label: "Reload",
        onClick: () => void updateServiceWorker(true),
      },
    });
  }, [needRefresh, updateServiceWorker]);

  return null;
}
