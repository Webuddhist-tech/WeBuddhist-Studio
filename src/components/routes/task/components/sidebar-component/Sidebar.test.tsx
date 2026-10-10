import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { vi } from "vitest";
import { BrowserRouter } from "react-router-dom";
import SideBar from "./SideBar";

const mockPlanData = {
  id: "test-plan-id",
  title: "Test Plan Title",
  days: [
    {
      id: "day-1",
      day_number: 1,
      tasks: [
        {
          id: "task-1",
          title: "Task 1",
        },
        {
          id: "task-2",
          title: "Task 2",
        },
      ],
    },
    {
      id: "day-2",
      day_number: 2,
      tasks: [
        {
          id: "task-3",
          title: "Task 3",
        },
      ],
    },
    {
      id: "day-3",
      day_number: 3,
      tasks: [],
    },
  ],
};

vi.mock("@/components/ui/atoms/dropdown-menu", () => ({
  DropdownMenu: ({ children }: any) => (
    <div data-testid="dropdown-menu">{children}</div>
  ),
  DropdownMenuTrigger: ({ children, asChild, ...props }: any) =>
    asChild ? (
      children
    ) : (
      <button data-testid="dropdown-trigger" {...props}>
        {children}
      </button>
    ),
  DropdownMenuContent: ({ children, ...props }: any) => (
    <div data-testid="dropdown-content" {...props}>
      {children}
    </div>
  ),
  DropdownMenuItem: ({ children, onClick, ...props }: any) => (
    <div data-testid="dropdown-item" onClick={onClick} {...props}>
      {children}
    </div>
  ),
  DropdownMenuGroup: ({ children, ...props }: any) => (
    <div data-testid="dropdown-group" {...props}>
      {children}
    </div>
  ),
  DropdownMenuSeparator: ({ ...props }: any) => (
    <div data-testid="dropdown-separator" {...props} />
  ),
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useParams: vi.fn().mockReturnValue({ planId: "test-plan-id" }),
  };
});

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock(
  "@/components/ui/molecules/modals/task-delete/TaskDeleteDialog",
  () => ({
    default: ({ taskId, onDelete }: any) => (
      <button
        data-testid={`delete-task-${taskId}`}
        onClick={() => onDelete(taskId)}
      >
        Delete Task
      </button>
    ),
  }),
);

vi.mock("@/components/ui/molecules/modals/day-delete/DayDeleteDialog", () => ({
  default: ({ dayId, onDelete }: any) => (
    <button data-testid={`delete-day-${dayId}`} onClick={() => onDelete(dayId)}>
      Delete Day
    </button>
  ),
}));

localStorage.setItem("accessToken", "test-token");

const renderWithProviders = (component: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>{component}</BrowserRouter>
    </QueryClientProvider>,
  );
};

describe("SideBar Component", () => {
  const mockOnDaySelect = vi.fn();
  const mockOnTaskClick = vi.fn();

  beforeEach(async () => {
    vi.clearAllMocks();
    const { default: axiosInstance } = await import("@/config/axios-config");
    const mockAxios = axiosInstance as any;
    mockAxios.get.mockResolvedValue({ data: mockPlanData });
    mockAxios.post.mockResolvedValue({
      data: { id: "new-day-id", day_number: 4, tasks: [] },
    });
    mockAxios.delete.mockResolvedValue({ data: {} });
  });

  it("renders sidebar with plan details and days list", async () => {
    renderWithProviders(
      <SideBar
        selectedDay={1}
        onDaySelect={mockOnDaySelect}
        onTaskClick={mockOnTaskClick}
      />,
    );
    expect(
      screen.getByText("studio.task.sidebar.current_plan"),
    ).toBeInTheDocument();
    expect(screen.getByText("studio.task.sidebar.days")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText("Test Plan Title")).toBeInTheDocument();
    });
    expect(screen.getAllByText("studio.task.day_number")).toHaveLength(3);
  });

  it("handles day selection and expands tasks correctly", async () => {
    renderWithProviders(
      <SideBar
        selectedDay={1}
        onDaySelect={mockOnDaySelect}
        onTaskClick={mockOnTaskClick}
      />,
    );
    await waitFor(() => {
      expect(screen.getByText("Test Plan Title")).toBeInTheDocument();
    });
    expect(screen.getByText("Task 1")).toBeInTheDocument();
    expect(screen.getByText("Task 2")).toBeInTheDocument();
    const day2Element = screen.getAllByText("studio.task.day_number")[1];
    fireEvent.click(day2Element);
    expect(mockOnDaySelect).toHaveBeenCalledWith(2);
    const task1Element = screen.getByText("Task 1");
    fireEvent.click(task1Element);
    expect(mockOnTaskClick).toHaveBeenCalledWith("task-1");
  });

  it("creates new day when Add New Day button is clicked", async () => {
    const { default: axiosInstance } = await import("@/config/axios-config");
    renderWithProviders(
      <SideBar
        selectedDay={1}
        onDaySelect={mockOnDaySelect}
        onTaskClick={mockOnTaskClick}
        isEditable={true}
      />,
    );
    await waitFor(() => {
      expect(screen.getByText("Test Plan Title")).toBeInTheDocument();
    });
    const addButton = screen.getByText("Add New Day");
    fireEvent.click(addButton);
    await waitFor(() => {
      expect(axiosInstance.post).toHaveBeenCalledWith(
        "/api/v1/cms/plans/test-plan-id/days",
        {},
        {
          headers: {
            Authorization: "Bearer test-token",
          },
        },
      );
    });
    await waitFor(() => {
      expect(mockOnDaySelect).toHaveBeenCalledWith(4);
    });
  });

  it("toggles task expansion when clicking expand icon", async () => {
    renderWithProviders(
      <SideBar
        selectedDay={1}
        onDaySelect={mockOnDaySelect}
        onTaskClick={mockOnTaskClick}
      />,
    );
    await waitFor(() => {
      expect(screen.getByText("Test Plan Title")).toBeInTheDocument();
    });
    expect(screen.getByText("Task 1")).toBeVisible();
    expect(screen.getByText("Task 2")).toBeVisible();
    const expandIcon = document.querySelector(".rotate-180");
    expect(expandIcon).toBeInTheDocument();
    fireEvent.click(expandIcon!);
    await waitFor(() => {
      expect(screen.queryByText("Task 1")).not.toBeVisible();
      expect(screen.queryByText("Task 2")).not.toBeVisible();
    });
  });

  it("handles delete task mutation success", async () => {
    const { default: axiosInstance } = await import("@/config/axios-config");
    const { toast } = await import("sonner");
    renderWithProviders(
      <SideBar
        selectedDay={1}
        onDaySelect={mockOnDaySelect}
        onTaskClick={mockOnTaskClick}
        isEditable={true}
      />,
    );
    await waitFor(() => {
      expect(screen.getByText("Test Plan Title")).toBeInTheDocument();
    });
    const deleteTaskButton = screen.getByTestId("delete-task-task-1");
    fireEvent.click(deleteTaskButton);
    await waitFor(() => {
      expect(axiosInstance.delete).toHaveBeenCalledWith(
        "/api/v1/cms/tasks/task-1",
        {
          headers: {
            Authorization: "Bearer test-token",
          },
        },
      );
    });
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith(
        "studio.task.mutations.task_deleted",
        {
          description: "studio.task.mutations.task_deleted_description",
        },
      );
    });
  });

  it("handles delete day mutation success", async () => {
    const { default: axiosInstance } = await import("@/config/axios-config");
    renderWithProviders(
      <SideBar
        selectedDay={1}
        onDaySelect={mockOnDaySelect}
        onTaskClick={mockOnTaskClick}
        isEditable={true}
      />,
    );
    await waitFor(() => {
      expect(screen.getByText("Test Plan Title")).toBeInTheDocument();
    });
    const deleteDayButton = screen.getByTestId("delete-day-day-1");
    fireEvent.click(deleteDayButton);
    await waitFor(() => {
      expect(axiosInstance.delete).toHaveBeenCalledWith(
        "/api/v1/cms/plans/test-plan-id/days/day-1",
        {
          headers: {
            Authorization: "Bearer test-token",
          },
        },
      );
    });
  });
});
