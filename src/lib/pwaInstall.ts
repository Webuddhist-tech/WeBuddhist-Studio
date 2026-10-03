import { useSyncExternalStore } from "react";

/**
 * Installing the Studio as an app (PWA).
 *
 * Chrome and Edge (Android, desktop) fire `beforeinstallprompt` once, often
 * before any menu has mounted, so it is caught here at import time and kept
 * for the "Install app" button. iOS has no prompt: the app is added from
 * Safari's Share menu, so there the button explains how instead.
 */

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/** "prompt": the browser can install it now. "ios": show the Share-menu steps. */
export type InstallMode = "prompt" | "ios" | null;

let deferredPrompt: BeforeInstallPromptEvent | null = null;
let installed = false;
const listeners = new Set<() => void>();

const notify = () => listeners.forEach((listener) => listener());

/** Already running as the installed app. */
export const isStandalone = (): boolean => {
  if (typeof window === "undefined") return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return (
    nav.standalone === true ||
    window.matchMedia?.("(display-mode: standalone)").matches === true
  );
};

/** iPhone, iPod or iPad (which reports itself as a Mac with touch). */
export const isIos = (): boolean => {
  if (typeof navigator === "undefined") return false;
  return (
    /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
};

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    // Ours to show from the menu, instead of the browser's own banner.
    event.preventDefault();
    deferredPrompt = event as BeforeInstallPromptEvent;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    installed = true;
    notify();
  });
}

export const getInstallMode = (): InstallMode => {
  if (installed || isStandalone()) return null;
  if (deferredPrompt) return "prompt";
  if (isIos()) return "ios";
  return null;
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/** How the Studio can be installed here, or null when it cannot (or is). */
export const useInstallMode = (): InstallMode =>
  useSyncExternalStore(subscribe, getInstallMode, () => null);

/** Shows the browser's install prompt. True when the person installed it. */
export const promptInstall = async (): Promise<boolean> => {
  const event = deferredPrompt;
  if (!event) return false;
  // A prompt can be shown once; the browser fires a new event if it may ask again.
  deferredPrompt = null;
  notify();
  await event.prompt();
  const { outcome } = await event.userChoice;
  return outcome === "accepted";
};
