import axios, { type AxiosError, type InternalAxiosRequestConfig } from "axios";
import { RESET_PASSWORD, RESET_PASSWORD_TOKEN } from "@/lib/constant";
import { getAccessToken } from "@/lib/auth-storage";

const axiosInstance = axios.create({
  baseURL: import.meta.env.VITE_BACKEND_BASE_URL,
});

export const REFRESH_TOKEN_ENDPOINT = "/api/v1/cms/auth/refresh-token";

/**
 * PlanAuthProvider registers its refresh here. Going through a setter rather
 * than importing the provider keeps the dependency one-way - the provider
 * already imports this instance to perform the exchange.
 */
type UnauthorizedHandler = () => Promise<boolean>;
let onUnauthorized: UnauthorizedHandler | null = null;

export const setUnauthorizedHandler = (handler: UnauthorizedHandler | null) => {
  onUnauthorized = handler;
};

type RetriableConfig = InternalAxiosRequestConfig & { _retried?: boolean };

axiosInstance.interceptors.request.use(
  (config) => {
    // The reset-password token stays in sessionStorage on purpose: it belongs
    // to the one tab that opened the emailed link and must not leak into the
    // author's other tabs.
    const token = window.location.href.includes(RESET_PASSWORD)
      ? sessionStorage.getItem(RESET_PASSWORD_TOKEN)
      : getAccessToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

/**
 * A 401 means the access token died sooner than its `exp` suggested - a clock
 * that drifted while the laptop slept, or a key rotation. Renew once and
 * replay the request so the author never sees it.
 */
axiosInstance.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const config = error.config as RetriableConfig | undefined;

    if (
      error.response?.status !== 401 ||
      !config ||
      config._retried ||
      config.url?.includes(REFRESH_TOKEN_ENDPOINT) ||
      !onUnauthorized
    ) {
      return Promise.reject(error);
    }

    config._retried = true;
    const renewed = await onUnauthorized();
    if (!renewed) {
      return Promise.reject(error);
    }

    const token = getAccessToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return axiosInstance(config);
  },
);

export default axiosInstance;
