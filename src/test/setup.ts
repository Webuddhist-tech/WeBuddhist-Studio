import "@testing-library/jest-dom";
import { afterEach, vi } from "vitest";

afterEach(() => {
  document.body.removeAttribute("data-scroll-locked");
  document.body.style.pointerEvents = "";
});

vi.mock("@/config/auth-context", () => ({
  useAuth: () => ({
    login: vi.fn(),
    logout: vi.fn(),
    isLoggedIn: false,
    isAuthLoading: false,
  }),
}));

vi.mock("@/config/studio-auth0", () => ({
  StudioAuth0Provider: ({ children }: { children: React.ReactNode }) =>
    children,
  useStudioAuth0: () => ({
    isConfigured: true,
    isAuthenticated: false,
    isLoading: false,
    loginWithRedirect: vi.fn(),
    getAccessTokenSilently: vi.fn(),
    logout: vi.fn(),
  }),
  useStudioAuth0Logout: () => vi.fn(),
}));

vi.mock("@auth0/auth0-react", () => ({
  Auth0Provider: ({ children }: { children: React.ReactNode }) => children,
  useAuth0: () => ({
    isAuthenticated: false,
    isLoading: false,
    loginWithRedirect: vi.fn(),
    getAccessTokenSilently: vi.fn(),
    logout: vi.fn(),
  }),
}));

vi.mock("@/config/axios-config", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
  REFRESH_TOKEN_ENDPOINT: "/api/v1/cms/auth/refresh-token",
  setUnauthorizedHandler: vi.fn(),
}));

vi.mock("@tolgee/react", () => ({
  useTranslate: () => ({
    t: (key: string) => key,
  }),
  useTolgee: () => ({
    getLanguage: () => "en",
    changeLanguage: vi.fn(),
  }),
}));

vi.mock("@/i18n/tolgee", () => ({
  tolgee: {
    t: (key: string) => key,
    getLanguage: () => "en",
    changeLanguage: vi.fn(),
  },
}));

vi.mock("@/hooks/useUserInfo", () => ({
  USER_INFO_QUERY_KEY: ["userInfo"],
  fetchUserInfo: vi.fn(),
  useUserInfo: () => ({
    data: {
      id: "test-user-id",
      email: "test@example.com",
      platform_role: "SUPER_ADMIN",
      is_verified: true,
      is_active: true,
      has_group: true,
      can_create_content: true,
    },
    isLoading: false,
  }),
}));

global.URL.createObjectURL = vi.fn(() => "mock-blob-url");
global.URL.revokeObjectURL = vi.fn();

global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};
