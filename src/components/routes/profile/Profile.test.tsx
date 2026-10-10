import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { vi, beforeEach, describe, expect, it } from "vitest";
import { BrowserRouter } from "react-router-dom";
import userEvent from "@testing-library/user-event";
import Profile from "./Profile";
import axiosInstance from "@/config/axios-config";
import { AUTH0_INTENT, setAuth0Intent } from "@/config/auth0-config";

const mockLoginWithRedirect = vi.fn();
const mockGetAccessTokenSilently = vi.fn();
const auth0State = {
  isConfigured: true,
  isAuthenticated: false,
  isLoading: false,
};

vi.mock("@/hooks/useUserInfo", () => ({
  USER_INFO_QUERY_KEY: ["userInfo"],
  fetchUserInfo: vi.fn(),
  useUserInfo: () => ({
    data: {
      id: "author-123",
      firstname: "Tenzin",
      lastname: "la",
      email: "test@example.com",
      bio: "Test bio",
      image_url: "https://example.com/image.jpg",
      social_profiles: [
        {
          account: "youtube",
          url: "https://youtube.com/tenzinla",
        },
      ],
    },
    isLoading: false,
  }),
}));

vi.mock("@/config/studio-auth0", () => ({
  useStudioAuth0: () => ({
    isConfigured: auth0State.isConfigured,
    isAuthenticated: auth0State.isAuthenticated,
    isLoading: auth0State.isLoading,
    loginWithRedirect: mockLoginWithRedirect,
    getAccessTokenSilently: mockGetAccessTokenSilently,
    logout: vi.fn(),
  }),
}));

vi.mock("@/components/ui/molecules/user-card/UserCard", () => ({
  default: ({ userInfo }: any) => (
    <div data-testid="user-card">
      <div>
        {userInfo?.firstname} {userInfo?.lastname}
      </div>
      <div>{userInfo?.email}</div>
    </div>
  ),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const renderWithProviders = (component: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>{component}</BrowserRouter>
    </QueryClientProvider>,
  );
};

describe("Profile Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    auth0State.isConfigured = true;
    auth0State.isAuthenticated = false;
    auth0State.isLoading = false;
    mockGetAccessTokenSilently.mockResolvedValue("fresh-auth0-token");
    mockLoginWithRedirect.mockResolvedValue(undefined);
  });

  it("renders profile with user info when data is loaded", async () => {
    renderWithProviders(<Profile />);
    await waitFor(() => {
      expect(screen.getByText("studio.profile.title")).toBeInTheDocument();
    });
    expect(screen.getByTestId("user-card")).toBeInTheDocument();
    expect(screen.getByText("Tenzin la")).toBeInTheDocument();
    expect(screen.getByText("test@example.com")).toBeInTheDocument();
    expect(screen.getByText("studio.common.edit")).toBeInTheDocument();
    expect(screen.getByText("studio.profile.link_phone")).toBeInTheDocument();
  });

  it("starts Auth0 SMS Universal Login for phone linking", async () => {
    const user = userEvent.setup();
    renderWithProviders(<Profile />);

    await user.click(screen.getByText("studio.profile.link_phone"));

    expect(mockLoginWithRedirect).toHaveBeenCalledWith(
      expect.objectContaining({
        authorizationParams: expect.objectContaining({
          connection: "sms",
        }),
        appState: expect.objectContaining({
          intent: AUTH0_INTENT.phoneLink,
          returnTo: "/profile",
        }),
      }),
    );
  });

  it("links phone after Auth0 callback using backend bearer session", async () => {
    setAuth0Intent(AUTH0_INTENT.phoneLink);
    auth0State.isAuthenticated = true;
    vi.mocked(axiosInstance.post).mockResolvedValue({
      data: {
        author_id: "author-123",
        phone_number: "+15551234567",
        message: "Phone identity linked",
      },
    });

    renderWithProviders(<Profile />);

    await waitFor(() => {
      expect(mockGetAccessTokenSilently).toHaveBeenCalled();
      expect(axiosInstance.post).toHaveBeenCalledWith(
        "/api/v1/cms/auth/phone/link",
        { auth0_token: "fresh-auth0-token" },
      );
      expect(screen.getByText("Phone identity linked")).toBeInTheDocument();
    });
  });

  it("shows link failure messages from the API", async () => {
    setAuth0Intent(AUTH0_INTENT.phoneLink);
    auth0State.isAuthenticated = true;
    vi.mocked(axiosInstance.post).mockRejectedValue({
      response: {
        data: {
          detail: "Phone identity is already linked to another author",
        },
      },
    });

    renderWithProviders(<Profile />);

    await waitFor(() => {
      expect(
        screen.getByText("Phone identity is already linked to another author"),
      ).toBeInTheDocument();
    });
  });
});
