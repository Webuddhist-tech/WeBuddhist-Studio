import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Dashboard from "./Dashboard";
import axiosInstance from "@/config/axios-config";
import { vi } from "vitest";

const emptyDashboardResponse = {
  items: [],
  pagination: { page: 1, page_size: 10, total: 0, total_pages: 0 },
};

const renderWithProviders = (component: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        {component}
      </QueryClientProvider>
    </BrowserRouter>,
  );
};

describe("Dashboard Component", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders dashboard with search input", () => {
    vi.spyOn(axiosInstance, "get").mockResolvedValue({
      data: emptyDashboardResponse,
    });
    renderWithProviders(<Dashboard />);

    expect(
      screen.getByPlaceholderText("common.placeholder.search"),
    ).toBeDefined();
  });

  it("displays table headers correctly", async () => {
    vi.spyOn(axiosInstance, "get").mockResolvedValue({
      data: {
        items: [
          {
            id: "plan-1",
            type: "plan",
            title: "Header Test Plan",
            image_url: "",
            status: "DRAFT",
            featured: false,
            languages: ["EN"],
            enrolled_count: 0,
            created_at: "2025-01-01T00:00:00Z",
          },
        ],
        pagination: { page: 1, page_size: 10, total: 1, total_pages: 1 },
      },
    });
    renderWithProviders(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByRole("table")).toBeInTheDocument();
    });

    expect(screen.getByText("studio.dashboard.title")).toBeDefined();
    expect(screen.getByText("studio.dashboard.plan_used")).toBeDefined();
    expect(screen.getByText("Date Modified")).toBeDefined();
    expect(screen.getByText("studio.dashboard.featured")).toBeDefined();
    expect(screen.getByText("studio.dashboard.actions")).toBeDefined();
  });

  it("renders search input with correct placeholder", () => {
    vi.spyOn(axiosInstance, "get").mockResolvedValue({
      data: emptyDashboardResponse,
    });
    renderWithProviders(<Dashboard />);

    const searchInput = screen.getByPlaceholderText(
      "common.placeholder.search",
    );
    expect(searchInput).toBeDefined();
    expect(searchInput.tagName).toBe("INPUT");
  });

  it("allows typing in search input", () => {
    vi.spyOn(axiosInstance, "get").mockResolvedValue({
      data: emptyDashboardResponse,
    });
    renderWithProviders(<Dashboard />);

    const searchInput = screen.getByPlaceholderText(
      "common.placeholder.search",
    ) as HTMLInputElement;

    fireEvent.change(searchInput, { target: { value: "test search" } });

    expect(searchInput.value).toBe("test search");
  });

  it("has proper table structure when items exist", async () => {
    vi.spyOn(axiosInstance, "get").mockResolvedValue({
      data: {
        items: [
          {
            id: "plan-1",
            type: "plan",
            title: "Sample",
            image_url: "",
            status: "DRAFT",
            featured: false,
            languages: ["EN"],
            enrolled_count: 0,
            updated_at: "2025-01-01T00:00:00Z",
            created_at: "2025-01-01T00:00:00Z",
          },
        ],
        pagination: { page: 1, page_size: 10, total: 1, total_pages: 1 },
      },
    });
    renderWithProviders(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByRole("table")).toBeDefined();
    });

    const table = screen.getByRole("table");
    const headers = within(table).getAllByRole("columnheader");
    expect(headers).toHaveLength(6);
    expect(headers[0]?.textContent?.trim()).toBe("");
  });

  it("fetches dashboard items from unified CMS endpoint", async () => {
    const getSpy = vi.spyOn(axiosInstance, "get").mockResolvedValue({
      data: emptyDashboardResponse,
    });

    renderWithProviders(<Dashboard />);
    await waitFor(() => {
      expect(getSpy).toHaveBeenCalledWith(
        expect.stringContaining("/api/v1/cms/dashboard/items"),
        expect.objectContaining({
          params: expect.objectContaining({
            tab: "all",
            page: 1,
            page_size: 10,
          }),
        }),
      );
    });
  });

  it("passes tab and filters when switching to plans", async () => {
    const getSpy = vi.spyOn(axiosInstance, "get").mockResolvedValue({
      data: emptyDashboardResponse,
    });
    const user = userEvent.setup();
    renderWithProviders(<Dashboard />);

    await waitFor(() => {
      expect(getSpy).toHaveBeenCalled();
    });

    await user.click(
      screen.getByRole("button", { name: "studio.dashboard.tab.plans" }),
    );

    await waitFor(() => {
      expect(getSpy).toHaveBeenCalledWith(
        expect.stringContaining("/api/v1/cms/dashboard/items"),
        expect.objectContaining({
          params: expect.objectContaining({
            tab: "plans",
          }),
        }),
      );
    });
  });

  it("shows stack badge on series cover image", async () => {
    vi.spyOn(axiosInstance, "get").mockResolvedValue({
      data: {
        items: [
          {
            id: "series-1",
            type: "series",
            metadata: [
              {
                id: "meta-1",
                title: "Test Series",
                language: "EN",
              },
            ],
            image_url: "https://example.com/cover.jpg",
            status: "PUBLISHED",
            featured: false,
            languages: ["EN"],
            enrolled_count: 5,
            plans_count: 10,
            updated_at: "2025-01-01T00:00:00Z",
            created_at: "2025-01-01T00:00:00Z",
          },
        ],
        pagination: { page: 1, page_size: 10, total: 1, total_pages: 1 },
      },
    });
    renderWithProviders(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText("Test Series")).toBeInTheDocument();
    });

    expect(
      screen.getByLabelText("studio.dashboard.series_plans_count_aria"),
    ).toBeInTheDocument();
  });

  it("shows same published actions for series as plans (Edit + Unpublish)", async () => {
    vi.spyOn(axiosInstance, "get").mockResolvedValue({
      data: {
        items: [
          {
            id: "series-1",
            type: "series",
            metadata: [{ id: "m1", title: "Published Series", language: "EN" }],
            status: "PUBLISHED",
            featured: false,
            languages: ["EN"],
            enrolled_count: 0,
            plans_count: 2,
            created_at: "2025-01-01T00:00:00Z",
          },
          {
            id: "plan-1",
            type: "plan",
            title: "Published Plan",
            status: "PUBLISHED",
            featured: false,
            languages: ["EN"],
            enrolled_count: 0,
            created_at: "2025-01-01T00:00:00Z",
          },
        ],
        pagination: { page: 1, page_size: 10, total: 2, total_pages: 1 },
      },
    });
    const user = userEvent.setup();
    renderWithProviders(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText("Published Series")).toBeInTheDocument();
    });

    const seriesActions = screen.getByRole("button", {
      name: "studio.shell.content_actions.series_actions",
    });
    await user.click(seriesActions);

    expect(
      await screen.findByRole("menuitem", { name: "studio.common.unpublish" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: "studio.shell.content_actions.edit_series" }),
    ).toBeInTheDocument();

    await user.keyboard("{Escape}");

    const planActions = screen.getByRole("button", { name: "studio.shell.content_actions.plan_actions" });
    await user.click(planActions);

    expect(
      await screen.findByRole("menuitem", { name: "studio.common.unpublish" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: "studio.shell.content_actions.edit_plan" }),
    ).toBeInTheDocument();
  });

  it("handles toggle featured on a plan", async () => {
    vi.spyOn(axiosInstance, "get").mockResolvedValue({
      data: {
        items: [
          {
            id: "plan-1",
            type: "plan",
            title: "Test Plan",
            image_url: "",
            status: "PUBLISHED",
            featured: false,
            languages: ["EN"],
            enrolled_count: 10,
            updated_at: "2025-01-01T00:00:00Z",
            created_at: "2025-01-01T00:00:00Z",
          },
        ],
        pagination: { page: 1, page_size: 10, total: 1, total_pages: 1 },
      },
    });
    axiosInstance.patch = vi.fn().mockResolvedValue({ data: {} });

    renderWithProviders(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText("Test Plan")).toBeInTheDocument();
    });

    const featuredButton = screen.getByRole("button", {
      name: "studio.dashboard.not_featured",
    });
    fireEvent.click(featuredButton);

    await waitFor(() => {
      expect(axiosInstance.patch).toHaveBeenCalledWith(
        "/api/v1/cms/plans/plan-1/featured",
      );
    });
  });

  it("handles toggle featured on a series", async () => {
    vi.spyOn(axiosInstance, "get").mockResolvedValue({
      data: {
        items: [
          {
            id: "series-1",
            type: "series",
            metadata: [
              {
                id: "meta-1",
                title: "Test Series",
                language: "EN",
              },
            ],
            image_url: "",
            status: "PUBLISHED",
            featured: false,
            languages: ["EN"],
            enrolled_count: 0,
            plans_count: 3,
            updated_at: "2025-01-01T00:00:00Z",
            created_at: "2025-01-01T00:00:00Z",
          },
        ],
        pagination: { page: 1, page_size: 10, total: 1, total_pages: 1 },
      },
    });
    axiosInstance.put = vi.fn().mockResolvedValue({ data: {} });

    renderWithProviders(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText("Test Series")).toBeInTheDocument();
    });

    const featuredButton = screen.getByRole("button", {
      name: "studio.dashboard.not_featured",
    });
    fireEvent.click(featuredButton);

    await waitFor(() => {
      expect(axiosInstance.put).toHaveBeenCalledWith(
        "/api/v1/cms/series/series-1",
        { featured: true },
      );
    });
  });
});
