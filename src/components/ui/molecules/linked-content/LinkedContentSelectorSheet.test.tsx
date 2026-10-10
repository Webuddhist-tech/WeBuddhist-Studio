import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LinkedContentSelectorSheet } from "./LinkedContentSelectorSheet";
import { fetchLinkedContent } from "./linkedContent";
import { createChantCollection } from "@/components/routes/groups/api/chantsApi";

vi.mock("@/components/routes/groups/api/chantsApi", async (orig) => {
  const actual =
    await orig<typeof import("@/components/routes/groups/api/chantsApi")>();
  return { ...actual, createChantCollection: vi.fn() };
});

vi.mock("./linkedContent", async (orig) => {
  const actual = await orig<typeof import("./linkedContent")>();
  return { ...actual, fetchLinkedContent: vi.fn() };
});

const renderSheet = (
  props: Partial<React.ComponentProps<typeof LinkedContentSelectorSheet>> = {},
) => {
  const onSelect = vi.fn();
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <LinkedContentSelectorSheet
        type="EVENT"
        groupId="group-1"
        isOpen
        onOpenChange={vi.fn()}
        onSelect={onSelect}
        {...props}
      />
    </QueryClientProvider>,
  );
  return { onSelect };
};

beforeEach(() => {
  vi.mocked(fetchLinkedContent).mockReset();
  vi.mocked(fetchLinkedContent).mockResolvedValue({
    total: 2,
    items: [
      { id: "e1", title: "Losar", subtitle: "Feb 18, 2026", imageUrl: null },
      { id: "e2", title: "Saga Dawa", subtitle: "Jun 1, 2026", imageUrl: null },
    ],
  });
});

describe("LinkedContentSelectorSheet", () => {
  it("lists the group's content for the chosen type", async () => {
    renderSheet();

    expect(await screen.findByText("Losar")).toBeInTheDocument();
    expect(screen.getByText("Saga Dawa")).toBeInTheDocument();
    expect(fetchLinkedContent).toHaveBeenCalledWith("EVENT", {
      groupId: "group-1",
      skip: 0,
      limit: 10,
    });
  });

  it("hands the chosen item back to the caller", async () => {
    const { onSelect } = renderSheet();

    await userEvent.click(await screen.findByText("Losar"));

    expect(onSelect).toHaveBeenCalledWith(
      "EVENT",
      expect.objectContaining({ id: "e1", title: "Losar" }),
    );
  });

  it("filters the loaded page client-side for types without server search", async () => {
    renderSheet();
    await screen.findByText("Losar");

    await userEvent.type(
      screen.getByPlaceholderText(
        "studio.content.linked.event.search_placeholder",
      ),
      "saga",
    );

    await waitFor(() => {
      expect(screen.queryByText("Losar")).not.toBeInTheDocument();
    });
    expect(screen.getByText("Saga Dawa")).toBeInTheDocument();
    expect(
      screen.getByText("studio.content.linked.filtering_page_only"),
    ).toBeInTheDocument();
  });

  it("sends the search term to the server for accumulations", async () => {
    vi.mocked(fetchLinkedContent).mockResolvedValue({
      total: 1,
      items: [{ id: "a1", title: "Mani", subtitle: null, imageUrl: null }],
    });

    renderSheet({ type: "GROUP_ACCUMULATION" });
    await screen.findByText("Mani");

    await userEvent.type(
      screen.getByPlaceholderText(
        "studio.content.linked.accumulation.search_placeholder",
      ),
      "mani",
    );

    await waitFor(() => {
      expect(fetchLinkedContent).toHaveBeenLastCalledWith(
        "GROUP_ACCUMULATION",
        expect.objectContaining({ search: "mani" }),
      );
    });
    expect(
      screen.queryByText("studio.content.linked.filtering_page_only"),
    ).not.toBeInTheDocument();
  });

  it("explains an empty group rather than showing a blank list", async () => {
    vi.mocked(fetchLinkedContent).mockResolvedValue({ total: 0, items: [] });

    renderSheet({ type: "POST" });

    expect(
      await screen.findByText("studio.content.linked.post.none_found"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("studio.content.linked.post.group_empty"),
    ).toBeInTheDocument();
  });

  it("does not query when the plan has no group", async () => {
    renderSheet({ groupId: null });

    expect(
      await screen.findByText("studio.content.linked.no_group"),
    ).toBeInTheDocument();
    expect(fetchLinkedContent).not.toHaveBeenCalled();
  });
});

describe("LinkedContentSelectorSheet creating content", () => {
  it("creates a chant collection inline and links it", async () => {
    vi.mocked(createChantCollection).mockResolvedValue({
      id: "c-new",
      group_id: "group-1",
      name: "Morning chants",
      created_at: "2026-10-10T00:00:00Z",
      items: [],
    });
    const { onSelect } = renderSheet({ type: "GROUP_COLLECTION" });

    await userEvent.click(
      await screen.findByRole("button", {
        name: "studio.content.linked.create_new",
      }),
    );
    await userEvent.type(
      screen.getByPlaceholderText(
        "studio.content.linked.chant_collection.quick_create_placeholder",
      ),
      "Morning chants",
    );
    await userEvent.click(
      screen.getByRole("button", {
        name: "studio.content.linked.create_and_link",
      }),
    );

    await waitFor(() =>
      expect(createChantCollection).toHaveBeenCalledWith("group-1", {
        name: "Morning chants",
      }),
    );
    expect(onSelect).toHaveBeenCalledWith(
      "GROUP_COLLECTION",
      expect.objectContaining({ id: "c-new", title: "Morning chants" }),
    );
  });

  it("opens the full create form for other types in a new tab", async () => {
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    renderSheet({ type: "EVENT" });

    await userEvent.click(
      await screen.findByRole("button", {
        name: "studio.content.linked.create_new",
      }),
    );

    expect(open).toHaveBeenCalledWith(
      "/groups/group-1/events/new",
      "_blank",
      "noopener,noreferrer",
    );
    open.mockRestore();
  });
});
