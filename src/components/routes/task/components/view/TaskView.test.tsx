import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { vi } from "vitest";
import TaskView from "./TaskView";
import axiosInstance from "@/config/axios-config";

const mockTaskDetails = {
  id: "task-123",
  title: "Test Task Title",
  subtasks: [
    {
      id: "subtask-1",
      content: "This is a text content",
      content_type: "TEXT",
    },
    {
      id: "subtask-2",
      content: "https://example.com/video.mp4",
      content_type: "VIDEO",
    },
  ],
};

localStorage.setItem("accessToken", "mock-token");

const renderWithProviders = (component: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>{component}</QueryClientProvider>,
  );
};

describe("TaskView Component", () => {
  const mockOnEditTask = vi.fn();
  beforeEach(async () => {
    vi.clearAllMocks();
    const { default: axiosInstance } = await import("@/config/axios-config");
    const mockAxios = axiosInstance as any;
    mockAxios.get.mockResolvedValue({ data: mockTaskDetails });
  });

  it("renders loading skeleton when data is loading", () => {
    const { container } = renderWithProviders(
      <TaskView onEditTask={mockOnEditTask} taskId="task-123" />,
    );
    const skeletons = container.querySelectorAll('[data-slot="skeleton"]');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it("renders task title and subtasks after loading", async () => {
    renderWithProviders(
      <TaskView onEditTask={mockOnEditTask} taskId="task-123" />,
    );
    await waitFor(() => {
      expect(screen.getByText("Test Task Title")).toBeInTheDocument();
    });
    expect(screen.getByText("This is a text content")).toBeInTheDocument();
    expect(axiosInstance.get).toHaveBeenCalledWith(
      "/api/v1/cms/tasks/task-123",
      {
        headers: {
          Authorization: "Bearer mock-token",
        },
      },
    );
  });

  it("does not fetch when taskId is not provided", () => {
    renderWithProviders(<TaskView onEditTask={mockOnEditTask} taskId="" />);
    expect(axiosInstance.get).not.toHaveBeenCalled();
  });

  it("handles empty subtask content correctly", async () => {
    const mockTaskWithEmptyContent = {
      id: "task-123",
      title: "Task With Empty Content",
      subtasks: [
        {
          id: "subtask-empty",
          content: "",
          content_type: "TEXT",
        },
        {
          id: "subtask-valid",
          content: "Valid content",
          content_type: "TEXT",
        },
      ],
    };
    vi.mocked(axiosInstance.get).mockResolvedValueOnce({
      data: mockTaskWithEmptyContent,
    });
    renderWithProviders(
      <TaskView onEditTask={mockOnEditTask} taskId="task-123" />,
    );
    await waitFor(() => {
      expect(screen.getByText("Task With Empty Content")).toBeInTheDocument();
    });
    expect(screen.getByText("Valid content")).toBeInTheDocument();
  });

  it("renders subtask audio when audio_url is present without timestamps", async () => {
    const mockTaskWithSubtaskAudio = {
      id: "task-123",
      title: "Task With Subtask Audio",
      subtasks: [
        {
          id: "subtask-audio",
          content: "Text with generated audio",
          content_type: "TEXT",
          audio_url: "https://example.com/subtask-audio.mp3",
        },
      ],
    };
    vi.mocked(axiosInstance.get).mockResolvedValueOnce({
      data: mockTaskWithSubtaskAudio,
    });
    const { container } = renderWithProviders(
      <TaskView onEditTask={mockOnEditTask} taskId="task-123" />,
    );
    await waitFor(() => {
      expect(screen.getByText("Task With Subtask Audio")).toBeInTheDocument();
    });
    const audio = container.querySelector(
      'audio[src="https://example.com/subtask-audio.mp3"]',
    );
    expect(audio).toBeInTheDocument();
    expect(screen.queryByText(/Segment:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Timeline:/)).not.toBeInTheDocument();
  });

  it("renders day audio segment player when timestamps and dayAudioUrl are present", async () => {
    const mockTaskWithTimestamps = {
      id: "task-123",
      title: "Task With Timestamps",
      subtasks: [
        {
          id: "subtask-timestamped",
          content: "Timestamped text",
          content_type: "TEXT",
          start_ms: 60_000,
          end_ms: 150_000,
        },
      ],
    };
    vi.mocked(axiosInstance.get).mockResolvedValueOnce({
      data: mockTaskWithTimestamps,
    });
    renderWithProviders(
      <TaskView
        onEditTask={mockOnEditTask}
        taskId="task-123"
        dayAudioUrl="https://example.com/day-audio.mp3"
      />,
    );
    await waitFor(() => {
      expect(screen.getByText("Segment: 1:00 – 2:30")).toBeInTheDocument();
    });
    expect(
      document.querySelector('audio[src="https://example.com/day-audio.mp3"]'),
    ).toBeInTheDocument();
  });

  it("renders timeline text when timestamps exist without audio sources", async () => {
    const mockTaskWithTimestamps = {
      id: "task-123",
      title: "Task With Timeline Only",
      subtasks: [
        {
          id: "subtask-timeline",
          content: "Timeline only text",
          content_type: "TEXT",
          start_ms: 30_000,
          end_ms: 90_000,
        },
      ],
    };
    vi.mocked(axiosInstance.get).mockResolvedValueOnce({
      data: mockTaskWithTimestamps,
    });
    renderWithProviders(
      <TaskView onEditTask={mockOnEditTask} taskId="task-123" />,
    );
    await waitFor(() => {
      expect(screen.getByText("Timeline: 0:30 – 1:30")).toBeInTheDocument();
    });
    expect(document.querySelector("audio")).not.toBeInTheDocument();
  });

  it("prefers subtask audio_url over day audio timestamps", async () => {
    const mockTaskWithBoth = {
      id: "task-123",
      title: "Task With Both Audio Sources",
      subtasks: [
        {
          id: "subtask-both",
          content: "Text with both audio sources",
          content_type: "TEXT",
          audio_url: "https://example.com/subtask-audio.mp3",
          start_ms: 60_000,
          end_ms: 150_000,
        },
      ],
    };
    vi.mocked(axiosInstance.get).mockResolvedValueOnce({
      data: mockTaskWithBoth,
    });
    const { container } = renderWithProviders(
      <TaskView
        onEditTask={mockOnEditTask}
        taskId="task-123"
        dayAudioUrl="https://example.com/day-audio.mp3"
      />,
    );
    await waitFor(() => {
      expect(
        screen.getByText("Task With Both Audio Sources"),
      ).toBeInTheDocument();
    });
    expect(
      container.querySelector(
        'audio[src="https://example.com/subtask-audio.mp3"]',
      ),
    ).toBeInTheDocument();
    expect(
      container.querySelector('audio[src="https://example.com/day-audio.mp3"]'),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/Segment:/)).not.toBeInTheDocument();
  });
});
