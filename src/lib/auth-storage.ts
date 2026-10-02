import {
  ACCESS_TOKEN,
  RECITATION_EMIT_TOKEN,
  REFRESH_TOKEN,
} from "@/lib/constant";

/**
 * Both tokens live in localStorage so every tab of Studio shares one session -
 * opening a second tab, or reopening the installed PWA, must not send the
 * author back to the login form. The access token used to sit in
 * sessionStorage, which is per-tab and empty in every newly opened tab.
 *
 * Reads and writes are wrapped because storage throws in Safari private mode
 * and when a browser is configured to block site data. A token storage refused
 * is kept in memory for the life of the tab: such a Studio loses the session on
 * reload, which is degraded, but it is not broken while the tab is open.
 */

/**
 * Tokens that storage refused to keep. Only a key whose write actually failed
 * is held here, so a value another tab removed is never resurrected from it:
 * where writes succeed, this stays empty and localStorage remains the one
 * source of truth.
 */
const memory = new Map<string, string>();

const read = (key: string): string | null => {
  try {
    const stored = localStorage.getItem(key);
    if (stored !== null) return stored;
  } catch {
    /* unreadable as well as unwritable - the fallback below covers it */
  }
  return memory.get(key) ?? null;
};

const write = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
    memory.delete(key);
  } catch {
    // Storage is blocked - Safari private mode, or site data turned off. Hold
    // the token for this tab so the session the author just opened works;
    // without it login succeeds and every request after it goes out unsigned.
    memory.set(key, value);
  }
};

const remove = (key: string) => {
  memory.delete(key);
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

/**
 * Everything on this browser that can act for the author. The recitation emit
 * secret goes with them: it is one value for the whole backend, so leaving it
 * behind on a shared machine lets whoever signs in next - or simply opens an
 * event's public control page - drive or end any live recitation.
 */
export const clearTokens = () => {
  remove(ACCESS_TOKEN);
  remove(REFRESH_TOKEN);
  remove(RECITATION_EMIT_TOKEN);
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
