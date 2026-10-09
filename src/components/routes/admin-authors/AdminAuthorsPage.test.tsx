import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AdminAuthorsPage from "./AdminAuthorsPage";
import { fetchAdminAuthors, type AdminAuthorDTO } from "./api/adminAuthorsApi";
import { useUserInfo } from "@/hooks/useUserInfo";

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

vi.mock("@/hooks/useUserInfo", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/hooks/useUserInfo")>();
  return { ...actual, useUserInfo: vi.fn() };
});

vi.mock("./api/adminAuthorsApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./api/adminAuthorsApi")>();
  return { ...actual, fetchAdminAuthors: vi.fn() };
});

const author = (id: string, firstname: string, extra: Partial<AdminAuthorDTO> = {}) =>
  ({
    id,
    firstname,
    lastname: "Dorje",
    email: `${firstname.toLowerCase()}@example.com`,
    platform_role: "CREATOR",
    is_verified: true,
    is_active: true,
    has_group: true,
    ...extra,
  }) as AdminAuthorDTO;

const list = (authors: AdminAuthorDTO[]) => ({
  authors,
  skip: 0,
  limit: 20,
  total: authors.length,
});

const renderPage = () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <AdminAuthorsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

const lastParams = () => vi.mocked(fetchAdminAuthors).mock.calls.at(-1)?.[0];

describe("AdminAuthorsPage search", () => {
  beforeEach(() => {
    vi.mocked(fetchAdminAuthors).mockReset();
    vi.mocked(fetchAdminAuthors).mockResolvedValue(list([author("a1", "Tenzin")]));
    vi.mocked(useUserInfo).mockReturnValue({
      data: { id: "me", platform_role: "SUPER_ADMIN" },
      isLoading: false,
    } as ReturnType<typeof useUserInfo>);
  });

  it("starts on the activation queue with no search", async () => {
    renderPage();
    await screen.findByText("Tenzin Dorje");
    expect(lastParams()).toEqual({
      skip: 0,
      limit: 20,
      is_verified: true,
      is_active: false,
    });
  });

  it("searches every author, not only the activation queue", async () => {
    renderPage();
    await screen.findByText("Tenzin Dorje");

    await userEvent.type(screen.getByLabelText("Search authors"), "pema");

    await waitFor(() => expect(lastParams()).toMatchObject({ search: "pema" }));
    // The queue filter is dropped, otherwise most authors could never be found.
    expect(lastParams()).not.toHaveProperty("is_verified");
    expect(lastParams()).not.toHaveProperty("is_active");
    expect(lastParams()).toMatchObject({ skip: 0 });
  });

  it("trims the search before sending it", async () => {
    renderPage();
    await screen.findByText("Tenzin Dorje");
    await userEvent.type(screen.getByLabelText("Search authors"), "  pema  ");
    await waitFor(() => expect(lastParams()).toMatchObject({ search: "pema" }));
  });

  it("does not search for a blank entry", async () => {
    renderPage();
    await screen.findByText("Tenzin Dorje");
    await userEvent.type(screen.getByLabelText("Search authors"), "   ");
    await new Promise((resolve) => setTimeout(resolve, 600));
    expect(lastParams()).not.toHaveProperty("search");
    expect(lastParams()).toMatchObject({ is_verified: true, is_active: false });
  });

  it("clears the search and returns to the queue", async () => {
    renderPage();
    await screen.findByText("Tenzin Dorje");
    await userEvent.type(screen.getByLabelText("Search authors"), "pema");
    await waitFor(() => expect(lastParams()).toMatchObject({ search: "pema" }));

    await userEvent.click(screen.getByRole("button", { name: "Clear search" }));

    await waitFor(() => expect(lastParams()).not.toHaveProperty("search"));
    expect(lastParams()).toMatchObject({ is_verified: true, is_active: false });
    expect(screen.getByLabelText("Search authors")).toHaveValue("");
  });

  it("the Activation queue button drops the search", async () => {
    renderPage();
    await screen.findByText("Tenzin Dorje");
    await userEvent.type(screen.getByLabelText("Search authors"), "pema");
    await waitFor(() => expect(lastParams()).toMatchObject({ search: "pema" }));

    await userEvent.click(screen.getByRole("button", { name: "Activation queue" }));

    await waitFor(() => expect(lastParams()).not.toHaveProperty("search"));
    expect(screen.getByLabelText("Search authors")).toHaveValue("");
  });

  it("keeps the search when switching to All authors", async () => {
    renderPage();
    await screen.findByText("Tenzin Dorje");
    await userEvent.type(screen.getByLabelText("Search authors"), "pema");
    await userEvent.click(screen.getByRole("button", { name: "All authors" }));
    await waitFor(() => expect(lastParams()).toMatchObject({ search: "pema" }));
    expect(screen.getByLabelText("Search authors")).toHaveValue("pema");
  });

  it("says when nothing matches the search", async () => {
    renderPage();
    await screen.findByText("Tenzin Dorje");
    vi.mocked(fetchAdminAuthors).mockResolvedValue(list([]));

    await userEvent.type(screen.getByLabelText("Search authors"), "nobody");

    expect(await screen.findByText('No authors match "nobody".')).toBeInTheDocument();
  });

  it("shows the matches so their role can be changed", async () => {
    renderPage();
    await screen.findByText("Tenzin Dorje");
    vi.mocked(fetchAdminAuthors).mockResolvedValue(
      list([author("a2", "Pema", { platform_role: "CONTENT_ADMIN" })]),
    );

    await userEvent.type(screen.getByLabelText("Search authors"), "pema");

    expect(await screen.findByText("Pema Dorje")).toBeInTheDocument();
    expect(screen.getByLabelText("Platform role of Pema Dorje")).toHaveValue(
      "CONTENT_ADMIN",
    );
  });
});

describe("AdminAuthorsPage role filter", () => {
  beforeEach(() => {
    vi.mocked(fetchAdminAuthors).mockReset();
    vi.mocked(fetchAdminAuthors).mockResolvedValue(list([author("a1", "Tenzin")]));
    vi.mocked(useUserInfo).mockReturnValue({
      data: { id: "me", platform_role: "SUPER_ADMIN" },
      isLoading: false,
    } as ReturnType<typeof useUserInfo>);
  });

  it("offers every role, with all roles chosen to begin with", async () => {
    renderPage();
    await screen.findByText("Tenzin Dorje");
    const filter = screen.getByLabelText("Filter by role");
    expect(filter).toHaveValue("");
    expect(
      Array.from((filter as HTMLSelectElement).options).map((o) => o.value),
    ).toEqual(["", "CREATOR", "CONTENT_ADMIN", "REVIEWER", "SUPER_ADMIN"]);
    expect(lastParams()).not.toHaveProperty("platform_role");
  });

  it("lists only the chosen role across all authors, not the queue", async () => {
    renderPage();
    await screen.findByText("Tenzin Dorje");

    await userEvent.selectOptions(
      screen.getByLabelText("Filter by role"),
      "CONTENT_ADMIN",
    );

    await waitFor(() =>
      expect(lastParams()).toMatchObject({ platform_role: "CONTENT_ADMIN", skip: 0 }),
    );
    expect(lastParams()).not.toHaveProperty("is_verified");
    expect(lastParams()).not.toHaveProperty("is_active");
  });

  it("combines with the name search", async () => {
    renderPage();
    await screen.findByText("Tenzin Dorje");

    await userEvent.type(screen.getByLabelText("Search authors"), "pema");
    await userEvent.selectOptions(screen.getByLabelText("Filter by role"), "CREATOR");

    await waitFor(() =>
      expect(lastParams()).toMatchObject({ search: "pema", platform_role: "CREATOR" }),
    );
  });

  it("choosing all roles again returns to the queue", async () => {
    renderPage();
    await screen.findByText("Tenzin Dorje");
    await userEvent.selectOptions(screen.getByLabelText("Filter by role"), "REVIEWER");
    await waitFor(() => expect(lastParams()).toMatchObject({ platform_role: "REVIEWER" }));

    await userEvent.selectOptions(screen.getByLabelText("Filter by role"), "");

    await waitFor(() => expect(lastParams()).not.toHaveProperty("platform_role"));
    expect(lastParams()).toMatchObject({ is_verified: true, is_active: false });
  });

  it("the Activation queue button clears the role filter too", async () => {
    renderPage();
    await screen.findByText("Tenzin Dorje");
    await userEvent.selectOptions(screen.getByLabelText("Filter by role"), "REVIEWER");
    await waitFor(() => expect(lastParams()).toMatchObject({ platform_role: "REVIEWER" }));

    await userEvent.click(screen.getByRole("button", { name: "Activation queue" }));

    await waitFor(() => expect(lastParams()).not.toHaveProperty("platform_role"));
    expect(screen.getByLabelText("Filter by role")).toHaveValue("");
  });

  it("the All authors button keeps the chosen role", async () => {
    renderPage();
    await screen.findByText("Tenzin Dorje");
    await userEvent.selectOptions(screen.getByLabelText("Filter by role"), "REVIEWER");
    await userEvent.click(screen.getByRole("button", { name: "All authors" }));
    await waitFor(() => expect(lastParams()).toMatchObject({ platform_role: "REVIEWER" }));
    expect(screen.getByLabelText("Filter by role")).toHaveValue("REVIEWER");
  });

  it("says which role has no authors", async () => {
    renderPage();
    await screen.findByText("Tenzin Dorje");
    vi.mocked(fetchAdminAuthors).mockResolvedValue(list([]));

    await userEvent.selectOptions(
      screen.getByLabelText("Filter by role"),
      "CONTENT_ADMIN",
    );

    expect(
      await screen.findByText("No authors have the CONTENT_ADMIN role."),
    ).toBeInTheDocument();
  });

  it("says when a name and role together match nobody", async () => {
    renderPage();
    await screen.findByText("Tenzin Dorje");
    vi.mocked(fetchAdminAuthors).mockResolvedValue(list([]));

    await userEvent.type(screen.getByLabelText("Search authors"), "pema");
    await userEvent.selectOptions(screen.getByLabelText("Filter by role"), "REVIEWER");

    expect(
      await screen.findByText('No authors match "pema" with the REVIEWER role.'),
    ).toBeInTheDocument();
  });

  it("starts the page over when the role changes", async () => {
    vi.mocked(fetchAdminAuthors).mockResolvedValue({
      authors: [author("a1", "Tenzin")],
      skip: 0,
      limit: 20,
      total: 60,
    });
    renderPage();
    await screen.findByText("Tenzin Dorje");
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    await waitFor(() => expect(lastParams()).toMatchObject({ skip: 20 }));

    await userEvent.selectOptions(screen.getByLabelText("Filter by role"), "CREATOR");

    await waitFor(() =>
      expect(lastParams()).toMatchObject({ platform_role: "CREATOR", skip: 0 }),
    );
  });
});
