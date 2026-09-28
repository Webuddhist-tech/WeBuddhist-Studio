import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { ACCESS_TOKEN, REFRESH_TOKEN } from "@/lib/constant";

const mockAuth0Logout = vi.fn();
const mockPost = vi.fn();

vi.mock("@/config/auth-context", async () => {
  return await vi.importActual("@/config/auth-context");
});

vi.mock("@/config/axios-config", () => ({
  default: {
    post: (...args: unknown[]) => mockPost(...args),
  },
  REFRESH_TOKEN_ENDPOINT: "/api/v1/cms/auth/refresh-token",
  setUnauthorizedHandler: vi.fn(),
}));

vi.mock("@/config/studio-auth0", () => ({
  StudioAuth0Provider: ({ children }: { children: React.ReactNode }) =>
    children,
  useStudioAuth0: () => ({
    isConfigured: true,
    isAuthenticated: true,
    isLoading: false,
    loginWithRedirect: vi.fn(),
    getAccessTokenSilently: vi.fn(),
    logout: vi.fn(),
  }),
  useStudioAuth0Logout: () => mockAuth0Logout,
}));

/** Unsigned JWT - the provider only reads `exp`, it never verifies. */
const tokenExpiringIn = (seconds: number) => {
  const payload = btoa(
    JSON.stringify({ exp: Math.floor(Date.now() / 1000) + seconds }),
  );
  return `header.${payload}.signature`;
};

const AuthProbe = () => {
  const { logout, isLoggedIn, isAuthLoading } = useAuthHook();
  return (
    <button type="button" onClick={logout}>
      {isAuthLoading ? "loading" : isLoggedIn ? "logged-in" : "logged-out"}
    </button>
  );
};

// Bound in beforeEach so the probe can use the freshly imported hook.
let useAuthHook: (typeof import("@/config/auth-context"))["useAuth"];

const renderProvider = async () => {
  const { PlanAuthProvider, useAuth } = await import("@/config/auth-context");
  useAuthHook = useAuth;
  return render(
    <MemoryRouter>
      <PlanAuthProvider>
        <AuthProbe />
      </PlanAuthProvider>
    </MemoryRouter>,
  );
};

describe("PlanAuthProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    localStorage.clear();
  });

  it("clears backend tokens and invokes Auth0 logout", async () => {
    localStorage.setItem(ACCESS_TOKEN, tokenExpiringIn(2 * 24 * 60 * 60));
    localStorage.setItem(REFRESH_TOKEN, "refresh");

    await renderProvider();

    const user = userEvent.setup();
    expect(await screen.findByText("logged-in")).toBeInTheDocument();
    await user.click(screen.getByText("logged-in"));

    expect(localStorage.getItem(ACCESS_TOKEN)).toBeNull();
    expect(localStorage.getItem(REFRESH_TOKEN)).toBeNull();
    expect(mockAuth0Logout).toHaveBeenCalledWith(
      expect.stringContaining("/login"),
    );
    expect(screen.getByText("logged-out")).toBeInTheDocument();
  });

  it("restores the session in a tab that has only the refresh token", async () => {
    // A tab opened fresh: the shared refresh token is there, no access token.
    localStorage.setItem(REFRESH_TOKEN, "refresh");
    const renewed = tokenExpiringIn(2 * 24 * 60 * 60);
    mockPost.mockResolvedValue({ data: { access_token: renewed } });

    await renderProvider();

    expect(await screen.findByText("logged-in")).toBeInTheDocument();
    expect(mockPost).toHaveBeenCalledWith("/api/v1/cms/auth/refresh-token", {
      token: "refresh",
    });
    expect(localStorage.getItem(ACCESS_TOKEN)).toBe(renewed);
  });

  it("stays loading until the bootstrap exchange resolves", async () => {
    localStorage.setItem(REFRESH_TOKEN, "refresh");
    let resolvePost: (value: unknown) => void = () => {};
    mockPost.mockReturnValue(
      new Promise((resolve) => {
        resolvePost = resolve;
      }),
    );

    await renderProvider();

    // The route guards must see `loading`, never a premature `logged-out`.
    expect(screen.getByText("loading")).toBeInTheDocument();

    await act(async () => {
      resolvePost({ data: { access_token: tokenExpiringIn(3600) } });
    });

    expect(await screen.findByText("logged-in")).toBeInTheDocument();
  });

  it("renews an access token that expired while the tab was closed", async () => {
    localStorage.setItem(ACCESS_TOKEN, tokenExpiringIn(-60));
    localStorage.setItem(REFRESH_TOKEN, "refresh");
    const renewed = tokenExpiringIn(2 * 24 * 60 * 60);
    mockPost.mockResolvedValue({ data: { access_token: renewed } });

    await renderProvider();

    expect(await screen.findByText("logged-in")).toBeInTheDocument();
    expect(localStorage.getItem(ACCESS_TOKEN)).toBe(renewed);
  });

  it("signs out when the refresh token is rejected", async () => {
    localStorage.setItem(REFRESH_TOKEN, "expired");
    mockPost.mockRejectedValue(new Error("401"));

    await renderProvider();

    expect(await screen.findByText("logged-out")).toBeInTheDocument();
    expect(localStorage.getItem(REFRESH_TOKEN)).toBeNull();
    // A spent refresh token is not an Auth0 session to end.
    expect(mockAuth0Logout).not.toHaveBeenCalled();
  });

  it("does not restore the session with a refresh that answers after sign-out", async () => {
    localStorage.setItem(REFRESH_TOKEN, "refresh");
    let resolvePost: (value: unknown) => void = () => {};
    mockPost.mockReturnValue(
      new Promise((resolve) => {
        resolvePost = resolve;
      }),
    );

    await renderProvider();
    const user = userEvent.setup();
    expect(screen.getByText("loading")).toBeInTheDocument();

    // The author signs out while the exchange is still on the wire.
    await user.click(screen.getByText("loading"));
    expect(localStorage.getItem(REFRESH_TOKEN)).toBeNull();

    await act(async () => {
      resolvePost({ data: { access_token: tokenExpiringIn(3600) } });
    });

    // The late answer must not put the session back, nor leave a token behind.
    expect(await screen.findByText("logged-out")).toBeInTheDocument();
    expect(localStorage.getItem(ACCESS_TOKEN)).toBeNull();
  });

  it("does not restore the session another tab signed out of mid-refresh", async () => {
    localStorage.setItem(ACCESS_TOKEN, tokenExpiringIn(-60));
    localStorage.setItem(REFRESH_TOKEN, "refresh");
    let resolvePost: (value: unknown) => void = () => {};
    mockPost.mockReturnValue(
      new Promise((resolve) => {
        resolvePost = resolve;
      }),
    );

    await renderProvider();

    await act(async () => {
      localStorage.removeItem(ACCESS_TOKEN);
      localStorage.removeItem(REFRESH_TOKEN);
      window.dispatchEvent(
        new StorageEvent("storage", { key: REFRESH_TOKEN, newValue: null }),
      );
    });

    await act(async () => {
      resolvePost({ data: { access_token: tokenExpiringIn(3600) } });
    });

    expect(await screen.findByText("logged-out")).toBeInTheDocument();
    expect(localStorage.getItem(ACCESS_TOKEN)).toBeNull();
  });

  it("follows a sign-out performed in another tab", async () => {
    localStorage.setItem(ACCESS_TOKEN, tokenExpiringIn(2 * 24 * 60 * 60));
    localStorage.setItem(REFRESH_TOKEN, "refresh");

    await renderProvider();
    expect(await screen.findByText("logged-in")).toBeInTheDocument();

    await act(async () => {
      localStorage.removeItem(ACCESS_TOKEN);
      localStorage.removeItem(REFRESH_TOKEN);
      window.dispatchEvent(
        new StorageEvent("storage", { key: REFRESH_TOKEN, newValue: null }),
      );
    });

    await waitFor(() =>
      expect(screen.getByText("logged-out")).toBeInTheDocument(),
    );
  });

  it("follows a sign-in performed in another tab", async () => {
    await renderProvider();
    expect(await screen.findByText("logged-out")).toBeInTheDocument();

    await act(async () => {
      localStorage.setItem(ACCESS_TOKEN, tokenExpiringIn(2 * 24 * 60 * 60));
      localStorage.setItem(REFRESH_TOKEN, "refresh");
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: REFRESH_TOKEN,
          newValue: "refresh",
        }),
      );
    });

    await waitFor(() =>
      expect(screen.getByText("logged-in")).toBeInTheDocument(),
    );
  });
});
