import { ACCESS_TOKEN, REFRESH_TOKEN } from "@/lib/constant";

/**
 * Both tokens live in localStorage so every tab of Studio shares one session -
 * opening a second tab, or reopening the installed PWA, must not send the
 * author back to the login form. The access token used to sit in
 * sessionStorage, which is per-tab and empty in every newly opened tab.
 *
 * Reads and writes are wrapped because storage throws in Safari private mode
 * and when a browser is configured to block site data; a Studio that cannot
 * persist is degraded, not broken.
 */

const read = (key: string): string | null => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

const write = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage unavailable - the token stays in memory for this tab only */
  }
};

const remove = (key: string) => {
  try {
    localStorage.removeItem(key);
  } catch {
    /* nothing to clean up if storage is unavailable */
  }
};

export const getAccessToken = () => read(ACCESS_TOKEN);
export const getRefreshToken = () => read(REFRESH_TOKEN);

export const setAccessToken = (token: string) => write(ACCESS_TOKEN, token);
export const setRefreshToken = (token: string) => write(REFRESH_TOKEN, token);

export const clearTokens = () => {
  remove(ACCESS_TOKEN);
  remove(REFRESH_TOKEN);
};

/** `Bearer` header for the api modules that build headers by hand. */
export const getAuthHeaders = () => ({
  Authorization: `Bearer ${getAccessToken()}`,
});

/**
 * Seconds until the access token expires, from its `exp` claim. Returns 0 when
 * the token is missing or unreadable so the caller refreshes immediately
 * rather than trusting a token it cannot inspect.
 */
export const getAccessTokenTtlSeconds = (): number => {
  const token = getAccessToken();
  if (!token) return 0;
  try {
    const [, payload] = token.split(".");
    if (!payload) return 0;
    const claims = JSON.parse(
      atob(payload.replace(/-/g, "+").replace(/_/g, "/")),
    );
    if (typeof claims.exp !== "number") return 0;
    return claims.exp - Math.floor(Date.now() / 1000);
  } catch {
    return 0;
  }
};

/** True when the token is gone, expired, or inside its renewal window. */
export const shouldRefreshAccessToken = (
  renewalWindowSeconds = 5 * 60,
): boolean => getAccessTokenTtlSeconds() <= renewalWindowSeconds;
