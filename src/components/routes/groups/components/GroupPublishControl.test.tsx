import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import GroupPublishControl from "./GroupPublishControl";
import * as groupsApi from "../api/groupsApi";
import type { AuthorGroupDetailDTO } from "../api/groupsApi";

const group = {
  id: "g1",
  slug: "g1",
  is_public: true,
  status: "DRAFT",
  metadata: [{ title: "Group one", language: "EN" }],
  tags: [],
  follower_count: 0,
  member_count: 3,
  members: [{ author_id: "a1", role: "OWNER", email: "a@b.c" }],
  social_links: [],
  series: [],
  plans: [],
} as unknown as AuthorGroupDetailDTO;

function renderControl(override: Partial<AuthorGroupDetailDTO> = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const value = { ...group, ...override } as AuthorGroupDetailDTO;
  queryClient.setQueryData(["cms-group", value.id], value);
  render(
    <QueryClientProvider client={queryClient}>
      <GroupPublishControl group={value} />
    </QueryClientProvider>,
  );
  return queryClient;
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("GroupPublishControl", () => {
  it("merges the response into the cache instead of replacing it", async () => {
    // A response missing detail fields must not strip them from the cache,
    // since the detail pages dereference members and metadata unguarded.
    vi.spyOn(groupsApi, "updateGroupStatus").mockResolvedValue({
      id: "g1",
      status: "PUBLISHED",
    } as unknown as AuthorGroupDetailDTO);

    const queryClient = renderControl();
    await userEvent.click(screen.getByRole("button", { name: /publish/i }));

    await waitFor(() => {
      const cached = queryClient.getQueryData([
        "cms-group",
        "g1",
      ]) as AuthorGroupDetailDTO;
      expect(cached.status).toBe("PUBLISHED");
      expect(cached.members).toHaveLength(1);
      expect(cached.metadata).toHaveLength(1);
    });
  });

  it("renders nothing when the group has no status yet", () => {
    renderControl({ status: undefined });
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("asks for confirmation before hiding a published group", async () => {
    const patch = vi
      .spyOn(groupsApi, "updateGroupStatus")
      .mockResolvedValue({ ...group, status: "UNPUBLISHED" });

    renderControl({ status: "PUBLISHED" });
    await userEvent.click(screen.getByRole("button", { name: /hide/i }));

    expect(patch).not.toHaveBeenCalled();
    expect(await screen.findByRole("alertdialog")).toHaveTextContent(
      "studio.groups.components.publish.confirm_nothing_deleted",
    );

    await userEvent.click(
      screen.getByRole("button", {
        name: "studio.groups.components.publish.hide_group",
      }),
    );
    await waitFor(() => {
      expect(patch).toHaveBeenCalledWith("g1", "UNPUBLISHED");
    });
  });

  it("publishes immediately without a confirmation dialog", async () => {
    const patch = vi
      .spyOn(groupsApi, "updateGroupStatus")
      .mockResolvedValue({ ...group, status: "PUBLISHED" });

    renderControl();
    await userEvent.click(screen.getByRole("button", { name: /publish/i }));

    await waitFor(() => {
      expect(patch).toHaveBeenCalledWith("g1", "PUBLISHED");
    });
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });
});
