import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import type {
  AxiosAdapter,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from "axios";
import { AxiosError } from "axios";
import axiosInstance, {
  REFRESH_TOKEN_ENDPOINT,
  setUnauthorizedHandler,
} from "@/config/axios-config";
import { ACCESS_TOKEN } from "@/lib/constant";

// setup.ts mocks this module for every other suite; here we exercise the real one.
vi.unmock("@/config/axios-config");

/** Replaces the network with a scripted list of statuses, one per call, and
 *  records the config each request went out with. */
const scriptAdapter = (statuses: number[]) => {
  const seen: InternalAxiosRequestConfig[] = [];
  let call = 0;

  const adapter: AxiosAdapter = (config) => {
    seen.push(config);
    const status = statuses[Math.min(call, statuses.length - 1)];
    call += 1;
    const response = {
      data: { ok: status < 400 },
      status,
      statusText: String(status),
      headers: {},
      config,
    } as AxiosResponse;

    if (status >= 400) {
      return Promise.reject(
        new AxiosError(
          `status ${status}`,
          String(status),
          config,
          null,
          response,
        ),
      );
    }
    return Promise.resolve(response);
  };

  return { adapter, seen };
};

const originalAdapter = axiosInstance.defaults.adapter;

describe("axiosInstance 401 handling", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  afterEach(() => {
    axiosInstance.defaults.adapter = originalAdapter;
    setUnauthorizedHandler(null);
  });

  it("attaches the shared access token", async () => {
    localStorage.setItem(ACCESS_TOKEN, "access");
    const { adapter, seen } = scriptAdapter([200]);
    axiosInstance.defaults.adapter = adapter;

    await axiosInstance.get("/thing");

    expect(seen[0].headers.Authorization).toBe("Bearer access");
  });

  it("renews once and replays the request after a 401", async () => {
    localStorage.setItem(ACCESS_TOKEN, "stale");
    const renew = vi.fn(async () => {
      localStorage.setItem(ACCESS_TOKEN, "fresh");
      return true;
    });
    setUnauthorizedHandler(renew);

    const { adapter, seen } = scriptAdapter([401, 200]);
    axiosInstance.defaults.adapter = adapter;

    const { data } = await axiosInstance.get("/thing");

    expect(data).toEqual({ ok: true });
    expect(renew).toHaveBeenCalledTimes(1);
    expect(seen).toHaveLength(2);
    expect(seen[1].headers.Authorization).toBe("Bearer fresh");
  });

  it("gives up when the renewal fails, without a second attempt", async () => {
    const renew = vi.fn(async () => false);
    setUnauthorizedHandler(renew);

    const { adapter, seen } = scriptAdapter([401]);
    axiosInstance.defaults.adapter = adapter;

    await expect(axiosInstance.get("/thing")).rejects.toThrow();
    expect(renew).toHaveBeenCalledTimes(1);
    expect(seen).toHaveLength(1);
  });

  it("retries a 401 only once", async () => {
    const renew = vi.fn(async () => true);
    setUnauthorizedHandler(renew);

    // Both the original and the replay come back 401 - a spent session, not a
    // stale token. One renewal, then the error surfaces.
    const { adapter, seen } = scriptAdapter([401, 401]);
    axiosInstance.defaults.adapter = adapter;

    await expect(axiosInstance.get("/thing")).rejects.toThrow();
    expect(renew).toHaveBeenCalledTimes(1);
    expect(seen).toHaveLength(2);
  });

  it("does not retry the refresh endpoint itself", async () => {
    const renew = vi.fn(async () => true);
    setUnauthorizedHandler(renew);

    const { adapter, seen } = scriptAdapter([401]);
    axiosInstance.defaults.adapter = adapter;

    await expect(
      axiosInstance.post(REFRESH_TOKEN_ENDPOINT, { token: "spent" }),
    ).rejects.toThrow();
    // Renewing through the exchange that just failed would loop.
    expect(renew).not.toHaveBeenCalled();
    expect(seen).toHaveLength(1);
  });

  it("leaves non-401 failures alone", async () => {
    const renew = vi.fn(async () => true);
    setUnauthorizedHandler(renew);

    const { adapter } = scriptAdapter([500]);
    axiosInstance.defaults.adapter = adapter;

    await expect(axiosInstance.get("/thing")).rejects.toThrow();
    expect(renew).not.toHaveBeenCalled();
  });
});
