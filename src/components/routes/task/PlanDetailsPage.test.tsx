import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { vi } from "vitest";
import { BrowserRouter } from "react-router-dom";
import PlanDetailsPage from "./PlanDetailsPage";

const mockPlanData = {
  id: "e7c343c4-e17b-4e1e-ab9a-e844180c7b3a",
  title: "4-Day Practice Plan: Daily Motivation Boost",
  description: "this is a demo",
  days: [
    {
      id: "94194915-563b-4d92-967f-35f38a5e28e3",
      day_number: 1,
      tasks: [
        {
          id: "task1",
          title: "Morning Intention Setting",
          subtasks: [],
          estimated_time: 30,
          display_order: 1,
        },
        {
          id: "task2",
          title: "Compassion Reflection",
          subtasks: [],
          estimated_time: 20,
          display_order: 2,
        },
      ],
    },
    {
      id: "31efe825-5bbc-4610-ab1c-c09afb157418",
      day_number: 2,
      tasks: [
        {
          id: "task3",
          title: "Meaningful Living Practice",
          subtasks: [],
          estimated_time: 45,
          display_order: 1,
        },
      ],
    },
    {
      id: "32dc2643-be72-4f11-95d9-1a4a5ca5e871",
      day_number: 3,
      tasks: [
        {
          id: "task4",
          title: "Heart Transformation Exercise",
          subtasks: [],
          estimated_time: 35,
          display_order: 1,
        },
      ],
    },
    {
      id: "be13212e-a744-427f-a214-bfb4ac2857b2",
      day_number: 4,
      tasks: [
        {
          id: "task5",
          title: "Integration and Commitment",
          subtasks: [],
          estimated_time: 35,
          display_order: 1,
        },
      ],
    },
  ],
};

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useParams: vi.fn().mockReturnValue({ planId: "test-plan-id" }),
    useSearchParams: vi.fn().mockReturnValue([
      new URLSearchParams(), // searchParams
      vi.fn(), // setSearchParams
    ]),
  };
});

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

vi.mock("react-split-pane", () => ({
  SplitPane: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="split-pane">{children}</div>
  ),
  Pane: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="pane">{children}</div>
  ),
}));

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

localStorage.setItem("accessToken", "mock-token");

const renderWithProviders = (
  component: React.ReactElement,
  isEditable = true,
) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  queryClient.setQueryData(["planDetails", "test-plan-id"], {
    ...mockPlanData,
    status: isEditable ? "DRAFT" : "PUBLISHED",
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>{component}</BrowserRouter>
    </QueryClientProvider>,
  );
};

describe("PlanDetailsPanel Component", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { default: axiosInstance } = await import("@/config/axios-config");
    const mockAxios = axiosInstance as any;
    mockAxios.get.mockImplementation((url: string) => {
      if (String(url).includes("/groups/")) {
        return Promise.resolve({
          data: { id: "g1", members: [], metadata: [], slug: "g" },
        });
      }
      return Promise.resolve({
        data: { ...mockPlanData, status: "DRAFT", group_id: "g1" },
      });
    });
    mockAxios.post.mockResolvedValue({
      data: { id: "new-day-id", day_number: 5, tasks: [] },
    });
  });

  it("renders plan details panel with current plan title and days", async () => {
    renderWithProviders(<PlanDetailsPage />);
    expect(screen.getByText("Current Plan")).toBeInTheDocument();
    expect(screen.getByText("Days")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText(mockPlanData.title)).toBeInTheDocument();
    });
    expect(screen.getByText("Day 1")).toBeInTheDocument();
    expect(screen.getByText("Day 2")).toBeInTheDocument();
    expect(screen.getByText("Day 3")).toBeInTheDocument();
    expect(screen.getByText("Day 4")).toBeInTheDocument();
  });

  it("shows tasks when a day is selected and expanded", async () => {
    renderWithProviders(<PlanDetailsPage />);
    await waitFor(() => {
      expect(screen.getByText(mockPlanData.title)).toBeInTheDocument();
    });
    expect(screen.getByText("Morning Intention Setting")).toBeInTheDocument();
    expect(screen.getByText("Compassion Reflection")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Day 2"));
    await waitFor(() => {
      expect(
        screen.getByText("Meaningful Living Practice"),
      ).toBeInTheDocument();
    });
    expect(screen.queryByText("Morning Intention Setting")).not.toBeVisible();
  });

  it("calls API when Add New Day button is clicked", async () => {
    const { default: axiosInstance } = await import("@/config/axios-config");
    const mockAxios = axiosInstance as any;
    renderWithProviders(<PlanDetailsPage />, true);
    await waitFor(() => {
      expect(screen.getByText("Day 4")).toBeInTheDocument();
    });
    // "Add New Day" now opens a dialog; submitting it triggers the request.
    fireEvent.click(screen.getByText("Add New Day"));
    const submitButton = await screen.findByText("Add 1 Day");
    fireEvent.click(submitButton);
    await waitFor(() => {
      expect(mockAxios.post).toHaveBeenCalledWith(
        expect.stringContaining("/api/v1/cms/plans/test-plan-id/days"),
        expect.objectContaining({ number_of_days: 1 }),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: "Bearer mock-token",
          }),
        }),
      );
    });
  });

  it("handles create new day error", async () => {
    const { default: axiosInstance } = await import("@/config/axios-config");
    const { toast } = await import("sonner");
    const mockAxios = axiosInstance as any;
    mockAxios.get.mockResolvedValue({ data: mockPlanData });
    mockAxios.post.mockRejectedValueOnce({
      response: { data: { detail: "Cannot create day" } },
    });
    renderWithProviders(<PlanDetailsPage />, true);
    await waitFor(() => {
      expect(screen.getByText("Day 4")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("Add New Day"));
    const submitButton = await screen.findByText("Add 1 Day");
    fireEvent.click(submitButton);
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Failed to create days", {
        description: "Cannot create day",
      });
    });
  });

  it("shows TaskForm when add task button is clicked", async () => {
    renderWithProviders(<PlanDetailsPage />);
    await waitFor(() => {
      expect(screen.getByText(mockPlanData.title)).toBeInTheDocument();
    });
    expect(screen.getAllByText("Add Task").length).toBeGreaterThan(0);
    expect(screen.getByPlaceholderText("Task Title")).toBeInTheDocument();
  });

  it("switches to task view after clicking a task", async () => {
    const { default: axiosInstance } = await import("@/config/axios-config");
    const mockAxios = axiosInstance as any;
    mockAxios.get.mockImplementation((url: string) => {
      if (url.includes("/tasks/task1")) {
        return Promise.resolve({
          data: {
            id: "task1",
            title: "Morning Intention Setting",
            display_order: 1,
            estimated_time: 30,
            subtasks: [],
          },
        });
      }
      return Promise.resolve({ data: mockPlanData });
    });
    renderWithProviders(<PlanDetailsPage />, true);
    await waitFor(() => {
      expect(screen.getByText(mockPlanData.title)).toBeInTheDocument();
    });
    expect(screen.getAllByText("Add Task").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByText("Morning Intention Setting"));
    await waitFor(() => {
      expect(screen.queryAllByText("Add Task")).toHaveLength(0);
    });
    await waitFor(() => {
      expect(screen.getByText("Task")).toBeInTheDocument();
    });
  });

  it("fetches plan details via queryFn when cache is empty", async () => {
    const { default: axiosInstance } = await import("@/config/axios-config");
    const mockAxios = axiosInstance as any;
    mockAxios.get.mockResolvedValue({
      data: { ...mockPlanData, status: "DRAFT" },
    });

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <PlanDetailsPage />
        </BrowserRouter>
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(mockAxios.get).toHaveBeenCalledWith(
        expect.stringContaining("/api/v1/cms/plans/test-plan-id"),
        expect.any(Object),
      );
    });
    await waitFor(() => {
      expect(screen.getByText(mockPlanData.title)).toBeInTheDocument();
    });
  });

  it("clears selected task when that task is deleted from sidebar", async () => {
    const user = userEvent.setup();
    const { default: axiosInstance } = await import("@/config/axios-config");
    const mockAxios = axiosInstance as any;
    mockAxios.get.mockImplementation((url: string) => {
      if (url.includes("/tasks/task1")) {
        return Promise.resolve({
          data: {
            id: "task1",
            title: "Morning Intention Setting",
            display_order: 1,
            estimated_time: 30,
            subtasks: [],
          },
        });
      }
      return Promise.resolve({ data: { ...mockPlanData, status: "DRAFT" } });
    });
    mockAxios.delete.mockResolvedValue({ data: {} });

    renderWithProviders(<PlanDetailsPage />, true);
    await waitFor(() => {
      expect(screen.getByText(mockPlanData.title)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Morning Intention Setting"));
    await waitFor(() => {
      expect(screen.getByText("Task")).toBeInTheDocument();
    });

    const taskElements = screen.getAllByText("Morning Intention Setting");
    const sidebarSpan = taskElements.find(
      (el) => el.tagName === "SPAN" && el.classList.contains("cursor-pointer"),
    );
    const taskRow = sidebarSpan!.parentElement!;
    const dropdownTrigger = taskRow.querySelector(
      '[data-slot="dropdown-menu-trigger"]',
    ) as HTMLElement;
    await user.click(dropdownTrigger);

    const deleteText = await screen.findByText("Delete");
    await user.click(deleteText);

    const deleteTaskBtn = await screen.findByText("Delete Task");
    await user.click(deleteTaskBtn);

    await waitFor(() => {
      expect(screen.getAllByText("Add Task").length).toBeGreaterThan(0);
    });
  });

  it("clears editing task when that task is deleted from sidebar", async () => {
    const user = userEvent.setup();
    const { default: axiosInstance } = await import("@/config/axios-config");
    const mockAxios = axiosInstance as any;
    mockAxios.get.mockImplementation((url: string) => {
      if (url.includes("/tasks/task1")) {
        return Promise.resolve({
          data: {
            id: "task1",
            title: "Morning Intention Setting",
            display_order: 1,
            estimated_time: 30,
            subtasks: [],
          },
        });
      }
      return Promise.resolve({ data: { ...mockPlanData, status: "DRAFT" } });
    });
    mockAxios.delete.mockResolvedValue({ data: {} });

    renderWithProviders(<PlanDetailsPage />, true);
    await waitFor(() => {
      expect(screen.getByText(mockPlanData.title)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Morning Intention Setting"));
    await waitFor(() => {
      expect(screen.getByText("Task")).toBeInTheDocument();
    });

    const editBtn = await screen.findByRole("button", { name: /edit/i });
    fireEvent.click(editBtn);
    await waitFor(() => {
      expect(screen.getByText("Edit Task")).toBeInTheDocument();
    });

    const taskElements = screen.getAllByText("Morning Intention Setting");
    const sidebarSpan = taskElements.find(
      (el) => el.tagName === "SPAN" && el.classList.contains("cursor-pointer"),
    );
    const taskRow = sidebarSpan!.parentElement!;
    const dropdownTrigger = taskRow.querySelector(
      '[data-slot="dropdown-menu-trigger"]',
    ) as HTMLElement;
    await user.click(dropdownTrigger);

    const deleteText = await screen.findByText("Delete");
    await user.click(deleteText);

    const deleteTaskBtn = await screen.findByText("Delete Task");
    await user.click(deleteTaskBtn);

    await waitFor(() => {
      expect(screen.getAllByText("Add Task").length).toBeGreaterThan(0);
    });
  });

  it("shows the no-days prompt instead of the task form when the plan has no days", async () => {
    const { default: axiosInstance } = await import("@/config/axios-config");
    const mockAxios = axiosInstance as any;
    const emptyPlan = { ...mockPlanData, days: [], status: "DRAFT" };
    mockAxios.get.mockImplementation((url: string) => {
      if (String(url).includes("/groups/")) {
        return Promise.resolve({
          data: { id: "g1", members: [], metadata: [], slug: "g" },
        });
      }
      return Promise.resolve({ data: { ...emptyPlan, group_id: "g1" } });
    });

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    queryClient.setQueryData(["planDetails", "test-plan-id"], emptyPlan);
    render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <PlanDetailsPage />
        </BrowserRouter>
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText("This plan has no days yet")).toBeInTheDocument();
    });
    expect(screen.queryByText("Add Subtask")).not.toBeInTheDocument();
  });
});
