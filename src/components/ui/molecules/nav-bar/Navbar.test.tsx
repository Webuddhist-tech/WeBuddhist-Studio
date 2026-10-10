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
      screen.getByRole("link", { name: "studio.nav.practice_spaces_tooltip" }),
    ).toHaveAttribute("href", "/groups");
    expect(
      screen.queryByRole("link", { name: "studio.nav.pages_tooltip" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "studio.nav.dashboard_tooltip" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "studio.nav.analytics_tooltip" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "studio.nav.tags_tooltip" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "studio.nav.traditions_tooltip" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "studio.nav.presets_tooltip" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "studio.nav.text_audio_tooltip" }),
    ).not.toBeInTheDocument();
  });

  it("points the logo link to Practice spaces for a CREATOR account", () => {
    vi.mocked(useUserInfo).mockReturnValue({
      data: { id: "1", platform_role: "CREATOR" },
      isLoading: false,
    } as ReturnType<typeof useUserInfo>);

    renderNavbar();

    expect(
      screen.getByRole("link", { name: /studio.nav.logo_alt/ }),
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
      screen.getByRole("link", { name: "studio.nav.dashboard_tooltip" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "studio.nav.analytics_tooltip" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "studio.nav.tags_tooltip" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "studio.nav.practice_spaces_tooltip" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "studio.nav.authors_tooltip" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "studio.nav.ambient_sounds_tooltip" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "studio.nav.text_requests_tooltip" }),
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
      screen.getByRole("link", { name: "studio.nav.authors_tooltip" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "studio.nav.ambient_sounds_tooltip" }),
    ).not.toBeInTheDocument();
    // Text requests are answered by Super Admins and Content Admins only.
    expect(
      screen.queryByRole("link", { name: "studio.nav.text_requests_tooltip" }),
    ).not.toBeInTheDocument();
  });

  it("shows the full nav for a REVIEWER account", () => {
    vi.mocked(useUserInfo).mockReturnValue({
      data: { id: "1", platform_role: "REVIEWER" },
      isLoading: false,
    } as ReturnType<typeof useUserInfo>);

    renderNavbar();

    expect(
      screen.getByRole("link", { name: "studio.nav.dashboard_tooltip" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "studio.nav.practice_spaces_tooltip" }),
    ).toBeInTheDocument();
  });

  it("does not restrict the nav while user info is still loading", () => {
    vi.mocked(useUserInfo).mockReturnValue({
      data: undefined,
      isLoading: true,
    } as ReturnType<typeof useUserInfo>);

    renderNavbar();

    expect(
      screen.getByRole("link", { name: "studio.nav.dashboard_tooltip" }),
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
      screen.getByRole("button", { name: "studio.nav.expand_sidebar" }),
    ).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("studio.nav.dashboard")).not.toBeInTheDocument();
  });

  it("honours a saved expanded preference even on a narrow viewport", () => {
    vi.mocked(useUserInfo).mockReturnValue({
      data: { id: "1", platform_role: "SUPER_ADMIN" },
      isLoading: false,
    } as ReturnType<typeof useUserInfo>);
    window.innerWidth = 375;
    localStorage.setItem(SIDEBAR_EXPANDED, "true");

    renderNavbar();

    expect(screen.getByText("studio.nav.dashboard")).toBeInTheDocument();
  });

  it("starts expanded and shows the labels", () => {
    vi.mocked(useUserInfo).mockReturnValue({
      data: { id: "1", platform_role: "SUPER_ADMIN" },
      isLoading: false,
    } as ReturnType<typeof useUserInfo>);

    renderNavbar();

    expect(
      screen.getByRole("button", { name: "studio.nav.collapse_sidebar" }),
    ).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("studio.nav.dashboard")).toBeInTheDocument();
    expect(screen.getByText("studio.nav.section_content")).toBeInTheDocument();
    expect(screen.getByText("studio.nav.logout")).toBeInTheDocument();
  });

  it("hides the labels once collapsed", async () => {
    vi.mocked(useUserInfo).mockReturnValue({
      data: { id: "1", platform_role: "SUPER_ADMIN" },
      isLoading: false,
    } as ReturnType<typeof useUserInfo>);

    renderNavbar();
    await userEvent.click(
      screen.getByRole("button", { name: "studio.nav.collapse_sidebar" }),
    );

    expect(
      screen.getByRole("button", { name: "studio.nav.expand_sidebar" }),
    ).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("studio.nav.dashboard")).not.toBeInTheDocument();
    expect(
      screen.queryByText("studio.nav.section_content"),
    ).not.toBeInTheDocument();
  });

  it("remembers the collapsed state across mounts", async () => {
    vi.mocked(useUserInfo).mockReturnValue({
      data: { id: "1", platform_role: "SUPER_ADMIN" },
      isLoading: false,
    } as ReturnType<typeof useUserInfo>);

    const { unmount } = renderNavbar();
    await userEvent.click(
      screen.getByRole("button", { name: "studio.nav.collapse_sidebar" }),
    );
    unmount();
    renderNavbar();

    expect(
      screen.getByRole("button", { name: "studio.nav.expand_sidebar" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("studio.nav.dashboard")).not.toBeInTheDocument();
  });

  it("keeps Verse of Day out of a CREATOR account's nav", () => {
    vi.mocked(useUserInfo).mockReturnValue({
      data: { id: "1", platform_role: "CREATOR" },
      isLoading: false,
    } as ReturnType<typeof useUserInfo>);
    openAllSections();

    renderNavbar();

    expect(
      screen.queryByRole("link", { name: "studio.nav.verse_of_day" }),
    ).not.toBeInTheDocument();
  });

  it("keeps grouped items hidden until their section is opened", async () => {
    vi.mocked(useUserInfo).mockReturnValue({
      data: { id: "1", platform_role: "SUPER_ADMIN" },
      isLoading: false,
    } as ReturnType<typeof useUserInfo>);

    renderNavbar();

    // Pinned items stand alone; the rest wait behind a header.
    expect(screen.getByText("studio.nav.practice_spaces")).toBeInTheDocument();
    expect(screen.getByText("studio.nav.pages")).toBeInTheDocument();
    expect(
      screen.queryByText("studio.nav.verse_of_day"),
    ).not.toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("button", { name: "studio.nav.section_content" }),
    );

    expect(screen.getByText("studio.nav.verse_of_day")).toBeInTheDocument();
    expect(screen.getByText("studio.nav.poems")).toBeInTheDocument();
    expect(screen.getByText("studio.nav.ambient_sounds")).toBeInTheDocument();
    expect(screen.queryByText("studio.nav.tags")).not.toBeInTheDocument();
  });

  it("remembers which sections are open across mounts", async () => {
    vi.mocked(useUserInfo).mockReturnValue({
      data: { id: "1", platform_role: "SUPER_ADMIN" },
      isLoading: false,
    } as ReturnType<typeof useUserInfo>);

    const { unmount } = renderNavbar();
    await userEvent.click(
      screen.getByRole("button", { name: "studio.nav.section_configuration" }),
    );
    unmount();
    renderNavbar();

    expect(screen.getByText("studio.nav.tags")).toBeInTheDocument();
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
      "studio.nav.verse_of_day",
      "studio.nav.poems",
      "studio.nav.text_audio_tooltip",
      "studio.nav.ambient_sounds_tooltip",
      "studio.nav.tags_tooltip",
      "studio.nav.traditions_tooltip",
      "studio.nav.presets_tooltip",
      "studio.nav.prayer_intentions_tooltip",
    ]) {
      expect(screen.getByRole("link", { name })).toBeInTheDocument();
    }
    // Like a creator: own spaces only.
    expect(
      screen.getByRole("link", { name: "studio.nav.practice_spaces_tooltip" }),
    ).toHaveAttribute("href", "/groups");
    for (const name of [
      "studio.nav.dashboard_tooltip",
      "studio.nav.analytics_tooltip",
      "studio.nav.pages_tooltip",
      "studio.nav.authors_tooltip",
      "studio.nav.china_tooltip",
      "studio.nav.chat_reports_tooltip",
    ]) {
      expect(screen.queryByRole("link", { name })).not.toBeInTheDocument();
    }
    // Administration holds only the text requests they answer.
    expect(
      screen.getByRole("button", {
        name: "studio.nav.section_administration",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "studio.nav.text_requests_tooltip" }),
    ).toHaveAttribute("href", "/admin/text-requests");
  });

  it("points a CONTENT_ADMIN's logo link to Practice spaces", () => {
    vi.mocked(useUserInfo).mockReturnValue({
      data: { id: "1", platform_role: "CONTENT_ADMIN" },
      isLoading: false,
    } as ReturnType<typeof useUserInfo>);

    renderNavbar();

    expect(
      screen.getByRole("link", { name: /studio.nav.logo_alt/ }),
    ).toHaveAttribute("href", "/groups");
  });

  it("hides the Administration section from a CREATOR account", () => {
    vi.mocked(useUserInfo).mockReturnValue({
      data: { id: "1", platform_role: "CREATOR" },
      isLoading: false,
    } as ReturnType<typeof useUserInfo>);

    renderNavbar();

    expect(
      screen.queryByRole("button", {
        name: "studio.nav.section_administration",
      }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "studio.nav.section_content" }),
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
    expect(screen.getByText("studio.nav.tags")).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("button", { name: "studio.nav.section_configuration" }),
    );
    expect(screen.queryByText("studio.nav.tags")).not.toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("button", { name: /go elsewhere/i }),
    );

    expect(screen.getByText("studio.nav.traditions")).toBeInTheDocument();
  });

  it("keeps every link reachable while collapsed to icons", async () => {
    // No room for headers on the icon rail, so the sections flatten out.
    vi.mocked(useUserInfo).mockReturnValue({
      data: { id: "1", platform_role: "SUPER_ADMIN" },
      isLoading: false,
    } as ReturnType<typeof useUserInfo>);

    renderNavbar();
    await userEvent.click(
      screen.getByRole("button", { name: "studio.nav.collapse_sidebar" }),
    );

    expect(
      screen.getByRole("link", { name: "studio.nav.verse_of_day" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "studio.nav.tags_tooltip" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "studio.nav.authors_tooltip" }),
    ).toBeInTheDocument();
  });

  it("marks Pages current on the pages list and its create form", () => {
    vi.mocked(useUserInfo).mockReturnValue({
      data: { id: "1", platform_role: "SUPER_ADMIN" },
      isLoading: false,
    } as ReturnType<typeof useUserInfo>);

    renderNavbarAt("/pages/new");

    expect(
      screen.getByRole("link", { name: "studio.nav.pages_tooltip" }),
    ).toHaveAttribute("aria-current", "page");
    expect(
      screen.getByRole("link", { name: "studio.nav.practice_spaces_tooltip" }),
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
        name: "studio.nav.pages_tooltip",
        current: "page",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "studio.nav.practice_spaces_tooltip" }),
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
        name: "studio.nav.practice_spaces_tooltip",
        current: "page",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "studio.nav.pages_tooltip" }),
    ).not.toHaveAttribute("aria-current");
  });
});
