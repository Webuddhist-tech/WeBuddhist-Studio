import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { vi } from "vitest";
import SeriesDetailsPage from "./SeriesDetailsPage";
import * as seriesApi from "@/components/routes/create-series/api/seriesApi";

vi.mock(
  "@/components/routes/create-series/components/PlanSearchSelector",
  () => ({
    default: () => <div data-testid="plan-search-selector" />,
  }),
);

const seriesFixture = {
  id: "series-1",
  group: { id: "group-1" },
  metadata: [{ id: "m1", title: "Abhidhamma in a year", language: "EN" }],
  featured: false,
  status: "DRAFT",
  plans: [
    {
      id: "plan-zh-1",
      title: "示例计划",
      language: "ZH",
      status: "DRAFT",
      total_days: 7,
      featured: false,
    },
    {
      id: "plan-en-1",
      title: "English Plan",
      language: "EN",
      status: "PUBLISHED",
      total_days: 5,
      featured: true,
      display_order: 0,
      start_date: "2026-04-30T00:00:00Z",
    },
  ],
};

function renderPage(initialEntry = "/series/series-1") {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/series/:seriesId" element={<SeriesDetailsPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function LocationProbe() {
  const { search } = useLocation();
  return <div data-testid="location-search">{search}</div>;
}

function SeriesDetailsWithLocation() {
  return (
    <>
      <LocationProbe />
      <SeriesDetailsPage />
    </>
  );
}

describe("SeriesDetailsPage", () => {
  beforeEach(() => {
    vi.spyOn(seriesApi, "getSeries").mockResolvedValue(seriesFixture as never);
    vi.spyOn(seriesApi, "putSeriesPlans").mockResolvedValue(
      seriesFixture as never,
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("navigates to plan new with series and active language in location state", async () => {
    function PlanNewStateProbe() {
      const { state, pathname } = useLocation();
      return (
        <>
          <div data-testid="plan-new-location-state">
            {JSON.stringify(state)}
          </div>
          <div data-testid="plan-new-pathname">{pathname}</div>
        </>
      );
    }

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/series/series-1"]}>
          <Routes>
            <Route path="/series/:seriesId" element={<SeriesDetailsPage />} />
            <Route
              path="/groups/:groupId/plan/new"
              element={<PlanNewStateProbe />}
            />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText("Abhidhamma in a year")).toBeInTheDocument();
    });

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /中文/i }));
    await user.click(
      screen.getByRole("link", { name: "studio.series.add_new_plan" }),
    );

    await waitFor(() => {
      expect(screen.getByTestId("plan-new-location-state")).toHaveTextContent(
        JSON.stringify({
          seriesId: "series-1",
          language: "ZH",
          start_date: "2026-04-30T00:00:00Z",
        }),
      );
      expect(screen.getByTestId("plan-new-pathname")).toHaveTextContent(
        "/groups/group-1/plan/new",
      );
    });
  });

  it("renders series title and plans for selected language tab", async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText("Abhidhamma in a year")).toBeInTheDocument();
    });

    expect(screen.getByText("English Plan")).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /中文/i }));

    await waitFor(() => {
      expect(screen.getByText("示例计划")).toBeInTheDocument();
    });
    expect(screen.queryByText("English Plan")).not.toBeInTheDocument();
  });

  it("reads the active language from URL params", async () => {
    renderPage("/series/series-1?language=ZH");

    await waitFor(() => {
      expect(screen.getByText("示例计划")).toBeInTheDocument();
    });
    expect(screen.queryByText("English Plan")).not.toBeInTheDocument();
  });

  it("updates URL params when selecting a language tab", async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/series/series-1"]}>
          <Routes>
            <Route
              path="/series/:seriesId"
              element={<SeriesDetailsWithLocation />}
            />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText("English Plan")).toBeInTheDocument();
    });

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /中文/i }));

    await waitFor(() => {
      expect(screen.getByText("示例计划")).toBeInTheDocument();
      expect(screen.getByTestId("location-search")).toHaveTextContent(
        "?language=ZH",
      );
    });
  });
});
