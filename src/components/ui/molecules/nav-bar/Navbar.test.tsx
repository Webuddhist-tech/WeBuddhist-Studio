import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BrowserRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Navbar from "./Navbar";

vi.mock("@/hooks/useUserInfo", () => ({
  useUserInfo: vi.fn(),
}));

import { useUserInfo } from "@/hooks/useUserInfo";

const renderNavbar = () =>
  render(
    <BrowserRouter>
      <Navbar />
    </BrowserRouter>,
  );

describe("Navbar", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("shows only the Groups link for a CREATOR account", () => {
    vi.mocked(useUserInfo).mockReturnValue({
      data: { id: "1", platform_role: "CREATOR" },
      isLoading: false,
    } as ReturnType<typeof useUserInfo>);

    renderNavbar();

    expect(
      screen.getByRole("link", { name: /manage author groups/i }),
    ).toBeInTheDocument();
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

  it("points the logo link to Groups for a CREATOR account", () => {
    vi.mocked(useUserInfo).mockReturnValue({
      data: { id: "1", platform_role: "CREATOR" },
      isLoading: false,
    } as ReturnType<typeof useUserInfo>);

    renderNavbar();

    expect(
      screen.getByRole("link", { name: /pecha studio logo/i }),
    ).toHaveAttribute("href", "/groups");
  });

  it("shows the full nav for a SUPER_ADMIN account", () => {
    vi.mocked(useUserInfo).mockReturnValue({
      data: { id: "1", platform_role: "SUPER_ADMIN" },
      isLoading: false,
    } as ReturnType<typeof useUserInfo>);

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
      screen.getByRole("link", { name: /manage author groups/i }),
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
      screen.getByRole("link", { name: /manage author groups/i }),
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
  it("starts collapsed and shows no labels", () => {
    vi.mocked(useUserInfo).mockReturnValue({
      data: { id: "1", platform_role: "SUPER_ADMIN" },
      isLoading: false,
    } as ReturnType<typeof useUserInfo>);

    renderNavbar();

    expect(
      screen.getByRole("button", { name: /expand sidebar/i }),
    ).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("Dashboard")).not.toBeInTheDocument();
  });

  it("shows the labels once expanded", async () => {
    vi.mocked(useUserInfo).mockReturnValue({
      data: { id: "1", platform_role: "SUPER_ADMIN" },
      isLoading: false,
    } as ReturnType<typeof useUserInfo>);

    renderNavbar();
    await userEvent.click(
      screen.getByRole("button", { name: /expand sidebar/i }),
    );

    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Verse of Day")).toBeInTheDocument();
    expect(screen.getByText("Logout")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /collapse sidebar/i }),
    ).toHaveAttribute("aria-expanded", "true");
  });

  it("remembers the expanded state across mounts", async () => {
    vi.mocked(useUserInfo).mockReturnValue({
      data: { id: "1", platform_role: "SUPER_ADMIN" },
      isLoading: false,
    } as ReturnType<typeof useUserInfo>);

    const { unmount } = renderNavbar();
    await userEvent.click(
      screen.getByRole("button", { name: /expand sidebar/i }),
    );
    unmount();
    renderNavbar();

    expect(screen.getByText("Dashboard")).toBeInTheDocument();
  });

  it("keeps Verse of Day out of a CREATOR account's nav", () => {
    vi.mocked(useUserInfo).mockReturnValue({
      data: { id: "1", platform_role: "CREATOR" },
      isLoading: false,
    } as ReturnType<typeof useUserInfo>);

    renderNavbar();

    expect(
      screen.queryByRole("link", { name: /verse of day/i }),
    ).not.toBeInTheDocument();
  });
});
