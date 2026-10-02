import { afterEach, describe, expect, it, vi, beforeEach } from "vitest";
import {
  ACCESS_TOKEN,
  RECITATION_EMIT_TOKEN,
  REFRESH_TOKEN,
} from "@/lib/constant";
import {
  clearTokens,
  getAccessToken,
  getAccessTokenTtlSeconds,
  getAuthHeaders,
  getRefreshToken,
  setAccessToken,
  setRefreshToken,
  shouldRefreshAccessToken,
} from "@/lib/auth-storage";

const tokenExpiringIn = (seconds: number) =>
  `header.${btoa(
    JSON.stringify({ exp: Math.floor(Date.now() / 1000) + seconds }),
  )}.signature`;

describe("auth-storage", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    // Also empties the in-memory fallback, which outlives localStorage.clear().
    clearTokens();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("keeps both tokens in localStorage so every tab shares the session", () => {
    setAccessToken("access");
    setRefreshToken("refresh");

    expect(localStorage.getItem(ACCESS_TOKEN)).toBe("access");
    expect(localStorage.getItem(REFRESH_TOKEN)).toBe("refresh");
    // The old per-tab home must stay empty, or a second tab reads nothing.
    expect(sessionStorage.getItem(ACCESS_TOKEN)).toBeNull();
    expect(getAccessToken()).toBe("access");
    expect(getRefreshToken()).toBe("refresh");
  });

  it("clears both tokens", () => {
    setAccessToken("access");
    setRefreshToken("refresh");
    clearTokens();

    expect(getAccessToken()).toBeNull();
    expect(getRefreshToken()).toBeNull();
  });

  it("clears the recitation emit secret with them", () => {
    // One value drives every event's recitation, so a sign-out on a shared
    // browser must not leave it for whoever opens a control page next.
    localStorage.setItem(RECITATION_EMIT_TOKEN, "emit-secret");
    clearTokens();

    expect(localStorage.getItem(RECITATION_EMIT_TOKEN)).toBeNull();
  });

  it("keeps a token this tab could not store, so the session still works", () => {
    // Safari private mode, or site data turned off: setItem throws.
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("storage blocked");
    });

    setAccessToken("access");
    setRefreshToken("refresh");

    expect(getAccessToken()).toBe("access");
    expect(getAuthHeaders()).toEqual({ Authorization: "Bearer access" });
    expect(getRefreshToken()).toBe("refresh");
  });

  it("forgets a token held in memory when the session is cleared", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("storage blocked");
    });
    setAccessToken("access");

    clearTokens();

    expect(getAccessToken()).toBeNull();
  });

  it("builds a bearer header from the stored token", () => {
    setAccessToken("access");
    expect(getAuthHeaders()).toEqual({ Authorization: "Bearer access" });
  });

  it("reads the remaining lifetime from the exp claim", () => {
    setAccessToken(tokenExpiringIn(2 * 24 * 60 * 60));
    const ttl = getAccessTokenTtlSeconds();
    expect(ttl).toBeGreaterThan(2 * 24 * 60 * 60 - 10);
    expect(ttl).toBeLessThanOrEqual(2 * 24 * 60 * 60);
  });

  it.each([
    ["missing", null],
    ["not a jwt", "opaque-token"],
    ["no exp claim", `header.${btoa(JSON.stringify({ sub: "1" }))}.sig`],
  ])("treats a %s token as due for renewal", (_label, token) => {
    if (token) setAccessToken(token);
    expect(getAccessTokenTtlSeconds()).toBe(0);
    expect(shouldRefreshAccessToken()).toBe(true);
  });

  it("flags a token inside the renewal window but not a fresh one", () => {
    setAccessToken(tokenExpiringIn(60));
    expect(shouldRefreshAccessToken(5 * 60)).toBe(true);

    setAccessToken(tokenExpiringIn(2 * 24 * 60 * 60));
    expect(shouldRefreshAccessToken(5 * 60)).toBe(false);
  });
});
