import { render, screen, fireEvent } from "@testing-library/react";
import { vi } from "vitest";
import { EditorTabSwitcher } from "./EditorTabSwitcher";

describe("EditorTabSwitcher Component", () => {
  const mockOnTabChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders both tabs", () => {
    render(
      <EditorTabSwitcher activeTab="task" onTabChange={mockOnTabChange} />,
    );
    expect(screen.getByText("studio.task.tabs.add_task")).toBeInTheDocument();
    expect(
      screen.getByText("studio.task.tabs.notification"),
    ).toBeInTheDocument();
  });

  it("calls onTabChange with 'task' when Add Task tab is clicked", () => {
    render(
      <EditorTabSwitcher
        activeTab="notification"
        onTabChange={mockOnTabChange}
      />,
    );
    const taskTab = screen.getByText("studio.task.tabs.add_task");
    fireEvent.click(taskTab);
    expect(mockOnTabChange).toHaveBeenCalledWith("task");
  });

  it("calls onTabChange with 'notification' when Notification tab is clicked", () => {
    render(
      <EditorTabSwitcher activeTab="task" onTabChange={mockOnTabChange} />,
    );
    const notificationTab = screen.getByText("studio.task.tabs.notification");
    fireEvent.click(notificationTab);
    expect(mockOnTabChange).toHaveBeenCalledWith("notification");
  });

  it("applies active styling to task tab when activeTab is 'task'", () => {
    render(
      <EditorTabSwitcher activeTab="task" onTabChange={mockOnTabChange} />,
    );
    const taskTab = screen.getByText("studio.task.tabs.add_task");
    expect(taskTab).toHaveClass("border-b-2", "border-red-500");
  });

  it("applies active styling to notification tab when activeTab is 'notification'", () => {
    render(
      <EditorTabSwitcher
        activeTab="notification"
        onTabChange={mockOnTabChange}
      />,
    );
    const notificationTab = screen.getByText("studio.task.tabs.notification");
    expect(notificationTab).toHaveClass("border-b-2", "border-red-500");
  });

  it("applies inactive styling to task tab when activeTab is 'notification'", () => {
    render(
      <EditorTabSwitcher
        activeTab="notification"
        onTabChange={mockOnTabChange}
      />,
    );
    const taskTab = screen.getByText("studio.task.tabs.add_task");
    expect(taskTab).toHaveClass("text-gray-500");
    expect(taskTab).not.toHaveClass("border-b-2");
  });

  it("applies inactive styling to notification tab when activeTab is 'task'", () => {
    render(
      <EditorTabSwitcher activeTab="task" onTabChange={mockOnTabChange} />,
    );
    const notificationTab = screen.getByText("studio.task.tabs.notification");
    expect(notificationTab).toHaveClass("text-gray-500");
    expect(notificationTab).not.toHaveClass("border-b-2");
  });
});
