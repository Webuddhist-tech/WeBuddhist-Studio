import type { createBrowserRouter } from "react-router-dom";

/**
 * Route `handle` for pages an operator drives through a live recitation. A
 * toast there would cover Next, so it is not shown: the page's own Update
 * button carries a new deploy instead, there and after the operator leaves.
 */
export const DEFERS_APP_UPDATE = { defersAppUpdate: true } as const;

/** What the update prompt reads of the router: where it is, and when it moves. */
export type StudioRouter = Pick<
  ReturnType<typeof createBrowserRouter>,
  "state" | "subscribe"
>;

/** Whether any route on screen asks to hold back a new deploy. */
export const defersAppUpdate = (router: StudioRouter) =>
  router.state.matches.some(
    ({ route }) =>
      (route.handle as Partial<typeof DEFERS_APP_UPDATE> | undefined)
        ?.defersAppUpdate === true,
  );
