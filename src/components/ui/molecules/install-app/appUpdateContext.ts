import { createContext, useContext, useEffect } from "react";

export interface AppUpdate {
  /** A new deploy is installed and waits for a reload. */
  ready: boolean;
  /** The one-off update toast has gone; the Update button carries it now. */
  promptClosed: boolean;
  closePrompt: () => void;
  /** Reloads into the waiting version. */
  reload: () => void;
  /** A page on screen shows the Update button, so the toast may be closed. */
  hasUpdateButton: boolean;
  /** Declares the Update button on screen until the returned cleanup runs. */
  hostUpdateButton: () => () => void;
}

const NO_UPDATE: AppUpdate = {
  ready: false,
  promptClosed: false,
  closePrompt: () => {},
  reload: () => {},
  hasUpdateButton: false,
  hostUpdateButton: () => () => {},
};

/** Outside AppUpdateProvider (tests, storybook-like renders) there is never an update. */
export const AppUpdateContext = createContext<AppUpdate>(NO_UPDATE);

export const useAppUpdate = () => useContext(AppUpdateContext);

/**
 * For the layouts that render an AppUpdateButton (the sidebar, the phone's top
 * bar, live control). The toast can only be closed where one of them is on
 * screen; elsewhere closing it would leave no way to update.
 */
export const useHostsUpdateButton = () => {
  const { hostUpdateButton } = useAppUpdate();
  useEffect(() => hostUpdateButton(), [hostUpdateButton]);
};

/** Whether the Update button should stand in for the closed toast. */
export const useUpdateWaiting = () => {
  const { ready, promptClosed } = useAppUpdate();
  return ready && promptClosed;
};
