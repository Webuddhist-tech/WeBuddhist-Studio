import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LinkedContentSelectorSheet } from "./LinkedContentSelectorSheet";
import { fetchLinkedContent } from "./linkedContent";

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

    await userEvent.type(screen.getByPlaceholderText(/search event/i), "saga");

    await waitFor(() => {
      expect(screen.queryByText("Losar")).not.toBeInTheDocument();
    });
    expect(screen.getByText("Saga Dawa")).toBeInTheDocument();
    expect(screen.getByText(/filtering this page only/i)).toBeInTheDocument();
  });

  it("sends the search term to the server for accumulations", async () => {
    vi.mocked(fetchLinkedContent).mockResolvedValue({
      total: 1,
      items: [{ id: "a1", title: "Mani", subtitle: null, imageUrl: null }],
    });

    renderSheet({ type: "GROUP_ACCUMULATION" });
    await screen.findByText("Mani");

    await userEvent.type(
      screen.getByPlaceholderText(/search accumulation/i),
      "mani",
    );

    await waitFor(() => {
      expect(fetchLinkedContent).toHaveBeenLastCalledWith(
        "GROUP_ACCUMULATION",
        expect.objectContaining({ search: "mani" }),
      );
    });
    expect(
      screen.queryByText(/filtering this page only/i),
    ).not.toBeInTheDocument();
  });

  it("explains an empty group rather than showing a blank list", async () => {
    vi.mocked(fetchLinkedContent).mockResolvedValue({ total: 0, items: [] });

    renderSheet({ type: "POST" });

    expect(await screen.findByText(/no post found/i)).toBeInTheDocument();
    expect(screen.getByText(/has no post yet/i)).toBeInTheDocument();
  });

  it("does not query when the plan has no group", async () => {
    renderSheet({ groupId: null });

    expect(
      await screen.findByText(/this plan has no group/i),
    ).toBeInTheDocument();
    expect(fetchLinkedContent).not.toHaveBeenCalled();
  });
});
