import { createContext, useContext } from "react";

export interface AppUpdate {
  /** A new deploy is installed and waits for a reload. */
  ready: boolean;
  /** The one-off update toast has gone; the Update button carries it now. */
  promptClosed: boolean;
  closePrompt: () => void;
  /** Reloads into the waiting version. */
  reload: () => void;
}

const NO_UPDATE: AppUpdate = {
  ready: false,
  promptClosed: false,
  closePrompt: () => {},
  reload: () => {},
};

/** Outside AppUpdateProvider (tests, storybook-like renders) there is never an update. */
export const AppUpdateContext = createContext<AppUpdate>(NO_UPDATE);

export const useAppUpdate = () => useContext(AppUpdateContext);

/** Whether the Update button should stand in for the closed toast. */
export const useUpdateWaiting = () => {
  const { ready, promptClosed } = useAppUpdate();
  return ready && promptClosed;
};
