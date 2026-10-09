import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, MemoryRouter, useNavigate } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SIDEBAR_EXPANDED, SIDEBAR_OPEN_SECTIONS } from "@/lib/constant";
import Navbar from "./Navbar";

vi.mock("@/hooks/useUserInfo", () => ({
  useUserInfo: vi.fn(),
}));

vi.mock("@/components/routes/groups/api/groupsApi", () => ({
  fetchGroup: vi.fn(),
}));

import { useUserInfo } from "@/hooks/useUserInfo";
import {
  fetchGroup,
  type AuthorGroupDetailDTO,
} from "@/components/routes/groups/api/groupsApi";

const withQueryClient = (children: ReactNode) => (
  <QueryClientProvider
    client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
  >
    {children}
  </QueryClientProvider>
);

const renderNavbar = () =>
  render(
    withQueryClient(
      <BrowserRouter>
        <Navbar />
      </BrowserRouter>,
    ),
  );

const renderNavbarAt = (path: string) =>
  render(
    withQueryClient(
      <MemoryRouter initialEntries={[path]}>
        <Navbar />
      </MemoryRouter>,
    ),
  );

/**
 * The sidebar opens expanded with its sections closed. Tests about role gating
 * want every section open, so what is missing is missing because of the role.
 */
const openAllSections = () =>
  localStorage.setItem(
    SIDEBAR_OPEN_SECTIONS,
    JSON.stringify(["content", "configuration", "administration"]),
  );

/** Lets a test move between routes the way an in-app link would. */
const GoTo = ({ to }: { to: string }) => {
  const navigate = useNavigate();
  return (
    <button type="button" onClick={() => navigate(to)}>
      go elsewhere
    </button>
  );
};

describe("Navbar", () => {
  beforeEach(() => {
    localStorage.clear();
    // jsdom's default, restored for the tests that narrow it.
    window.innerWidth = 1024;
  });

  it("shows only the Practice spaces link for a CREATOR account", () => {
    vi.mocked(useUserInfo).mockReturnValue({
      data: { id: "1", platform_role: "CREATOR" },
      isLoading: false,
    } as ReturnType<typeof useUserInfo>);
    openAllSections();

    renderNavbar();

    expect(
      screen.getByRole("link", { name: /manage practice spaces/i }),
    ).toHaveAttribute("href", "/groups");
    expect(
      screen.queryByRole("link", { name: /manage pages/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /go to dashboard/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /view analytics/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /manage tags/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /manage traditions/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /manage accumulator presets/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /manage text audio/i }),
    ).not.toBeInTheDocument();
  });

  it("points the logo link to Practice spaces for a CREATOR account", () => {
    vi.mocked(useUserInfo).mockReturnValue({
      data: { id: "1", platform_role: "CREATOR" },
      isLoading: false,
    } as ReturnType<typeof useUserInfo>);

    renderNavbar();

    expect(
      screen.getByRole("link", { name: /webuddhist studio logo/i }),
    ).toHaveAttribute("href", "/groups");
  });

  it("shows the full nav for a SUPER_ADMIN account", () => {
    vi.mocked(useUserInfo).mockReturnValue({
      data: { id: "1", platform_role: "SUPER_ADMIN" },
      isLoading: false,
    } as ReturnType<typeof useUserInfo>);
    openAllSections();

    renderNavbar();

    expect(
      screen.getByRole("link", { name: /go to dashboard/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /view analytics/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /manage tags/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /manage practice spaces/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /author administration/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /manage ambient sound catalog/i }),
    ).toBeInTheDocument();
  });

  it("keeps the ambient sound catalogue out of a REVIEWER's nav", () => {
    // Reviewers reach the admin section, but the catalogue writes shared,
    // sitewide media, so it stays Super Admin only.
    vi.mocked(useUserInfo).mockReturnValue({
      data: { id: "1", platform_role: "REVIEWER" },
      isLoading: false,
    } as ReturnType<typeof useUserInfo>);
    openAllSections();

    renderNavbar();

    expect(
      screen.getByRole("link", { name: /author administration/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /manage ambient sound catalog/i }),
    ).not.toBeInTheDocument();
  });

  it("shows the full nav for a REVIEWER account", () => {
    vi.mocked(useUserInfo).mockReturnValue({
      data: { id: "1", platform_role: "REVIEWER" },
      isLoading: false,
    } as ReturnType<typeof useUserInfo>);

    renderNavbar();

    expect(
      screen.getByRole("link", { name: /go to dashboard/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /manage practice spaces/i }),
    ).toBeInTheDocument();
  });

  it("does not restrict the nav while user info is still loading", () => {
    vi.mocked(useUserInfo).mockReturnValue({
      data: undefined,
      isLoading: true,
    } as ReturnType<typeof useUserInfo>);

    renderNavbar();

    expect(
      screen.getByRole("link", { name: /go to dashboard/i }),
    ).toBeInTheDocument();
  });

  it("starts on the icon rail when the viewport is too narrow to spare 224px", () => {
    vi.mocked(useUserInfo).mockReturnValue({
      data: { id: "1", platform_role: "SUPER_ADMIN" },
      isLoading: false,
    } as ReturnType<typeof useUserInfo>);
    window.innerWidth = 375;

    renderNavbar();

    expect(
      screen.getByRole("button", { name: /expand sidebar/i }),
    ).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("Dashboard")).not.toBeInTheDocument();
  });

  it("honours a saved expanded preference even on a narrow viewport", () => {
    vi.mocked(useUserInfo).mockReturnValue({
      data: { id: "1", platform_role: "SUPER_ADMIN" },
      isLoading: false,
    } as ReturnType<typeof useUserInfo>);
    window.innerWidth = 375;
    localStorage.setItem(SIDEBAR_EXPANDED, "true");

    renderNavbar();

    expect(screen.getByText("Dashboard")).toBeInTheDocument();
  });

  it("starts expanded and shows the labels", () => {
    vi.mocked(useUserInfo).mockReturnValue({
      data: { id: "1", platform_role: "SUPER_ADMIN" },
      isLoading: false,
    } as ReturnType<typeof useUserInfo>);

    renderNavbar();

    expect(
      screen.getByRole("button", { name: /collapse sidebar/i }),
    ).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Content")).toBeInTheDocument();
    expect(screen.getByText("Logout")).toBeInTheDocument();
  });

  it("hides the labels once collapsed", async () => {
    vi.mocked(useUserInfo).mockReturnValue({
      data: { id: "1", platform_role: "SUPER_ADMIN" },
      isLoading: false,
    } as ReturnType<typeof useUserInfo>);

    renderNavbar();
    await userEvent.click(
      screen.getByRole("button", { name: /collapse sidebar/i }),
    );

    expect(
      screen.getByRole("button", { name: /expand sidebar/i }),
    ).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("Dashboard")).not.toBeInTheDocument();
    expect(screen.queryByText("Content")).not.toBeInTheDocument();
  });

  it("remembers the collapsed state across mounts", async () => {
    vi.mocked(useUserInfo).mockReturnValue({
      data: { id: "1", platform_role: "SUPER_ADMIN" },
      isLoading: false,
    } as ReturnType<typeof useUserInfo>);

    const { unmount } = renderNavbar();
    await userEvent.click(
      screen.getByRole("button", { name: /collapse sidebar/i }),
    );
    unmount();
    renderNavbar();

    expect(
      screen.getByRole("button", { name: /expand sidebar/i }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Dashboard")).not.toBeInTheDocument();
  });

  it("keeps Verse of Day out of a CREATOR account's nav", () => {
    vi.mocked(useUserInfo).mockReturnValue({
      data: { id: "1", platform_role: "CREATOR" },
      isLoading: false,
    } as ReturnType<typeof useUserInfo>);
    openAllSections();

    renderNavbar();

    expect(
      screen.queryByRole("link", { name: /verse of day/i }),
    ).not.toBeInTheDocument();
  });

  it("keeps grouped items hidden until their section is opened", async () => {
    vi.mocked(useUserInfo).mockReturnValue({
      data: { id: "1", platform_role: "SUPER_ADMIN" },
      isLoading: false,
    } as ReturnType<typeof useUserInfo>);

    renderNavbar();

    // Pinned items stand alone; the rest wait behind a header.
    expect(screen.getByText("Practice spaces")).toBeInTheDocument();
    expect(screen.getByText("Pages")).toBeInTheDocument();
    expect(screen.queryByText("Verse of Day")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /^content$/i }));

    expect(screen.getByText("Verse of Day")).toBeInTheDocument();
    expect(screen.getByText("Poems")).toBeInTheDocument();
    expect(screen.getByText("Ambient Sounds")).toBeInTheDocument();
    expect(screen.queryByText("Tags")).not.toBeInTheDocument();
  });

  it("remembers which sections are open across mounts", async () => {
    vi.mocked(useUserInfo).mockReturnValue({
      data: { id: "1", platform_role: "SUPER_ADMIN" },
      isLoading: false,
    } as ReturnType<typeof useUserInfo>);

    const { unmount } = renderNavbar();
    await userEvent.click(
      screen.getByRole("button", { name: /^configuration$/i }),
    );
    unmount();
    renderNavbar();

    expect(screen.getByText("Tags")).toBeInTheDocument();
  });

  it("gives a CONTENT_ADMIN the catalogues but not the all-plans views", () => {
    vi.mocked(useUserInfo).mockReturnValue({
      data: { id: "1", platform_role: "CONTENT_ADMIN" },
      isLoading: false,
    } as ReturnType<typeof useUserInfo>);
    openAllSections();

    renderNavbar();

    // Content and configuration, none of it tied to a space.
    for (const name of [
      /verse of day/i,
      /^poems$/i,
      /manage text audio/i,
      /manage ambient sound catalog/i,
      /manage tags/i,
      /manage traditions/i,
      /manage accumulator presets/i,
      /prayer intentions catalog/i,
    ]) {
      expect(screen.getByRole("link", { name })).toBeInTheDocument();
    }
    // Like a creator: own spaces only.
    expect(
      screen.getByRole("link", { name: /manage practice spaces/i }),
    ).toHaveAttribute("href", "/groups");
    for (const name of [
      /go to dashboard/i,
      /view analytics/i,
      /manage pages/i,
      /author administration/i,
      /china content restrictions/i,
      /chat moderation reports/i,
    ]) {
      expect(screen.queryByRole("link", { name })).not.toBeInTheDocument();
    }
    expect(
      screen.queryByRole("button", { name: /^administration$/i }),
    ).not.toBeInTheDocument();
  });

  it("points a CONTENT_ADMIN's logo link to Practice spaces", () => {
    vi.mocked(useUserInfo).mockReturnValue({
      data: { id: "1", platform_role: "CONTENT_ADMIN" },
      isLoading: false,
    } as ReturnType<typeof useUserInfo>);

    renderNavbar();

    expect(
      screen.getByRole("link", { name: /webuddhist studio logo/i }),
    ).toHaveAttribute("href", "/groups");
  });

  it("hides the Administration section from a CREATOR account", () => {
    vi.mocked(useUserInfo).mockReturnValue({
      data: { id: "1", platform_role: "CREATOR" },
      isLoading: false,
    } as ReturnType<typeof useUserInfo>);

    renderNavbar();

    expect(
      screen.queryByRole("button", { name: /^administration$/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^content$/i }),
    ).not.toBeInTheDocument();
  });

  it("reopens the active section when moving between two of its pages", async () => {
    // /tags and /traditions share the Configuration id, so reopening cannot
    // rely on that id changing.
    vi.mocked(useUserInfo).mockReturnValue({
      data: { id: "1", platform_role: "SUPER_ADMIN" },
      isLoading: false,
    } as ReturnType<typeof useUserInfo>);

    render(
      withQueryClient(
        <MemoryRouter initialEntries={["/tags"]}>
          <Navbar />
          <GoTo to="/traditions" />
        </MemoryRouter>,
      ),
    );

    // The section holding the current page opens itself.
    expect(screen.getByText("Tags")).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("button", { name: /^configuration$/i }),
    );
    expect(screen.queryByText("Tags")).not.toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("button", { name: /go elsewhere/i }),
    );

    expect(screen.getByText("Traditions")).toBeInTheDocument();
  });

  it("keeps every link reachable while collapsed to icons", async () => {
    // No room for headers on the icon rail, so the sections flatten out.
    vi.mocked(useUserInfo).mockReturnValue({
      data: { id: "1", platform_role: "SUPER_ADMIN" },
      isLoading: false,
    } as ReturnType<typeof useUserInfo>);

    renderNavbar();
    await userEvent.click(
      screen.getByRole("button", { name: /collapse sidebar/i }),
    );

    expect(
      screen.getByRole("link", { name: /verse of day/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /manage tags/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /author administration/i }),
    ).toBeInTheDocument();
  });

  it("marks Pages current on the pages list and its create form", () => {
    vi.mocked(useUserInfo).mockReturnValue({
      data: { id: "1", platform_role: "SUPER_ADMIN" },
      isLoading: false,
    } as ReturnType<typeof useUserInfo>);

    renderNavbarAt("/pages/new");

    expect(screen.getByRole("link", { name: /manage pages/i })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(
      screen.getByRole("link", { name: /manage practice spaces/i }),
    ).not.toHaveAttribute("aria-current");
  });

  it("marks Pages, not Practice spaces, current inside a page group", async () => {
    // Both share /groups/:groupId, so only the group's type can tell them apart.
    vi.mocked(useUserInfo).mockReturnValue({
      data: { id: "1", platform_role: "SUPER_ADMIN" },
      isLoading: false,
    } as ReturnType<typeof useUserInfo>);
    vi.mocked(fetchGroup).mockResolvedValue({
      id: "g1",
      group_type: "PAGE",
    } as AuthorGroupDetailDTO);

    renderNavbarAt("/groups/g1/content");

    expect(
      await screen.findByRole("link", {
        name: /manage pages/i,
        current: "page",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /manage practice spaces/i }),
    ).not.toHaveAttribute("aria-current");
  });

  it("marks Practice spaces current inside a community group", async () => {
    vi.mocked(useUserInfo).mockReturnValue({
      data: { id: "1", platform_role: "SUPER_ADMIN" },
      isLoading: false,
    } as ReturnType<typeof useUserInfo>);
    vi.mocked(fetchGroup).mockResolvedValue({
      id: "g2",
      group_type: "COMMUNITY",
    } as AuthorGroupDetailDTO);

    renderNavbarAt("/groups/g2");

    expect(
      await screen.findByRole("link", {
        name: /manage practice spaces/i,
        current: "page",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /manage pages/i }),
    ).not.toHaveAttribute("aria-current");
  });
});
