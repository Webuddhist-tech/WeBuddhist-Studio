import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  useEffect,
} from "react";
import { REFRESH_TOKEN } from "@/lib/constant";
import { ROUTES } from "@/routes/paths";
import { clearPendingAuth0Token } from "@/config/auth0-config";
import { useStudioAuth0Logout } from "@/config/studio-auth0";
import axiosInstance, {
  REFRESH_TOKEN_ENDPOINT,
  setUnauthorizedHandler,
} from "@/config/axios-config";
import {
  clearTokens,
  getAccessToken,
  getAccessTokenTtlSeconds,
  getRefreshToken,
  setAccessToken,
  setRefreshToken,
  shouldRefreshAccessToken,
} from "@/lib/auth-storage";

type AuthContextValue = {
  isLoggedIn: boolean;
  isAuthLoading: boolean;
  login: (accessToken: string, refreshToken?: string | null) => void;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

/** Renew this far before the access token expires, so a slow network or a
 *  clock a few minutes out never leaves a request holding a dead token. */
const RENEWAL_WINDOW_SECONDS = 5 * 60;
/** setTimeout overflows past ~24.8 days; a day is well inside that and gives
 *  a long-lived tab a periodic checkpoint. */
const MAX_TIMER_SECONDS = 24 * 60 * 60;

export const PlanAuthProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const auth0Logout = useStudioAuth0Logout();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  /** Bumped on every token change. The renewal timer keys off this so a
   *  refresh that leaves `isLoggedIn` at true still reschedules itself -
   *  without it a tab renews once and then never again. */
  const [tokenVersion, setTokenVersion] = useState(0);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** One in-flight refresh per tab: a burst of 401s or a wake-up that races
   *  the timer must not fan out into several exchanges. */
  const inFlightRefresh = useRef<Promise<boolean> | null>(null);

  const clearRefreshTimer = useCallback(() => {
    if (refreshTimer.current) {
      clearTimeout(refreshTimer.current);
      refreshTimer.current = null;
    }
  }, []);

  const login = useCallback(
    (accessToken: string, refreshToken?: string | null) => {
      setAccessToken(accessToken);
      if (refreshToken) {
        setRefreshToken(refreshToken);
      }
      setIsLoggedIn(true);
      setTokenVersion((version) => version + 1);
    },
    [],
  );

  /** Local sign-out: drop the tokens and the session flag without bouncing
   *  through Auth0. Used when another tab signed out, or when the refresh
   *  token is spent - there is no live Auth0 session left to end. */
  const endSession = useCallback(() => {
    clearRefreshTimer();
    clearTokens();
    clearPendingAuth0Token();
    setIsLoggedIn(false);
  }, [clearRefreshTimer]);

  const logout = useCallback(() => {
    endSession();
    auth0Logout(`${window.location.origin}${ROUTES.login}`);
  }, [auth0Logout, endSession]);

  /** Exchange the refresh token for a fresh access token. Resolves to whether
   *  the session survived. */
  const refreshSession = useCallback(async (): Promise<boolean> => {
    if (inFlightRefresh.current) return inFlightRefresh.current;

    const refreshToken = getRefreshToken();
    if (!refreshToken) {
      endSession();
      return false;
    }

    const attempt = (async () => {
      try {
        const { data } = await axiosInstance.post(REFRESH_TOKEN_ENDPOINT, {
          token: refreshToken,
        });
        setAccessToken(data.access_token);
        setIsLoggedIn(true);
        setTokenVersion((version) => version + 1);
        return true;
      } catch {
        // The refresh token is expired or rejected - a month is up, or it was
        // revoked. Nothing to salvage, so clear and let the guard redirect.
        endSession();
        return false;
      } finally {
        inFlightRefresh.current = null;
      }
    })();

    inFlightRefresh.current = attempt;
    return attempt;
  }, [endSession]);

  /** Let the axios 401 interceptor renew through the same single-flight
   *  exchange instead of opening its own. */
  useEffect(() => {
    setUnauthorizedHandler(refreshSession);
    return () => setUnauthorizedHandler(null);
  }, [refreshSession]);

  /** Bootstrap. A tab that has a refresh token but no usable access token -
   *  a newly opened tab before tokens were shared, or a token that expired
   *  while the PWA was closed - must resolve the exchange before the route
   *  guards see `isLoggedIn`, otherwise they redirect to login mid-flight. */
  useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      const refreshToken = getRefreshToken();
      if (!refreshToken) {
        if (!cancelled) {
          setIsLoggedIn(false);
          setIsAuthLoading(false);
        }
        return;
      }

      if (
        getAccessToken() &&
        !shouldRefreshAccessToken(RENEWAL_WINDOW_SECONDS)
      ) {
        if (!cancelled) {
          setIsLoggedIn(true);
          setIsAuthLoading(false);
        }
        return;
      }

      await refreshSession();
      if (!cancelled) setIsAuthLoading(false);
    };

    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, [refreshSession]);

  /** Renew on the token's own schedule rather than polling. */
  useEffect(() => {
    clearRefreshTimer();
    if (!isLoggedIn || isAuthLoading) return;

    const ttl = getAccessTokenTtlSeconds();
    const delaySeconds = Math.min(
      Math.max(ttl - RENEWAL_WINDOW_SECONDS, 30),
      MAX_TIMER_SECONDS,
    );

    refreshTimer.current = setTimeout(() => {
      void refreshSession();
    }, delaySeconds * 1000);

    return clearRefreshTimer;
  }, [
    isLoggedIn,
    isAuthLoading,
    tokenVersion,
    refreshSession,
    clearRefreshTimer,
  ]);

  /** Timers do not survive a sleeping laptop or a backgrounded PWA, so also
   *  check whenever the tab comes back to the foreground. */
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      if (!getRefreshToken()) return;
      if (shouldRefreshAccessToken(RENEWAL_WINDOW_SECONDS)) {
        void refreshSession();
      }
    };

    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [refreshSession]);

  /** Keep tabs in step: signing out in one tab signs out the rest, and
   *  signing in propagates without a reload. `storage` only fires in the
   *  tabs that did not make the change, which is exactly what we want. */
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== null && event.key !== REFRESH_TOKEN) return;
      if (getRefreshToken()) {
        if (getAccessToken()) {
          setIsLoggedIn(true);
          setTokenVersion((version) => version + 1);
        }
      } else {
        clearRefreshTimer();
        setIsLoggedIn(false);
      }
    };

    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [clearRefreshTimer]);

  const contextValue = useMemo(
    () => ({ isLoggedIn, login, logout, isAuthLoading }),
    [isLoggedIn, login, logout, isAuthLoading],
  );

  return (
    <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within PlanAuthProvider");
  }
  return context;
};
