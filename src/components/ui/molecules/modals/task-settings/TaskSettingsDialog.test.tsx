import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import TaskSettingsDialog from "./TaskSettingsDialog";

const { fetchTaskDetails, updateTaskSettings, fetchTextRelationsForSources } =
  vi.hoisted(() => ({
    fetchTaskDetails: vi.fn(),
    updateTaskSettings: vi.fn(),
    fetchTextRelationsForSources: vi.fn(),
  }));

vi.mock("@/components/routes/task/api/taskApi", async () => {
  const actual = await vi.importActual<
    typeof import("@/components/routes/task/api/taskApi")
  >("@/components/routes/task/api/taskApi");
  return { ...actual, fetchTaskDetails, updateTaskSettings };
});

vi.mock("@/components/routes/task/api/textRelationsApi", () => ({
  fetchTextRelationsForSources,
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const relations = {
  commentaries: [{ id: "com-1", title: "Great Commentary", language: "bo" }],
  translations: [{ id: "tr-1", title: "English Translation", language: "en" }],
};

const renderDialog = (
  props: Partial<Parameters<typeof TaskSettingsDialog>[0]> = {},
) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <TaskSettingsDialog planId="plan-1" taskId="task-1" {...props} />
    </QueryClientProvider>,
  );
};

beforeAll(() => {
  // Radix Select needs these, which jsdom does not have.
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.releasePointerCapture = () => {};
  Element.prototype.scrollIntoView = () => {};
});

beforeEach(() => {
  vi.clearAllMocks();
  fetchTaskDetails.mockResolvedValue({
    id: "task-1",
    subtasks: [
      { id: "s1", source_text_id: "text-b" },
      { id: "s2", source_text_id: "text-a" },
      { id: "s3", source_text_id: null },
      { id: "s4", source_text_id: "text-a" },
    ],
  });
  fetchTextRelationsForSources.mockResolvedValue(relations);
  updateTaskSettings.mockImplementation(async (_id, settings) => settings);
});

describe("TaskSettingsDialog", () => {
  it("loads the lists for every distinct source text of the task", async () => {
    renderDialog();

    await userEvent.click(screen.getByText("Settings"));

    await waitFor(() =>
      expect(fetchTextRelationsForSources).toHaveBeenCalledWith([
        "text-a",
        "text-b",
      ]),
    );
    expect(fetchTaskDetails).toHaveBeenCalledWith("task-1");
  });

  it("shows the saved settings", async () => {
    renderDialog({
      settings: {
        is_commentary_open: true,
        commentary_text_id: "com-1",
        is_translation_open: false,
        translation_text_id: null,
        is_live: true,
      },
    });

    await userEvent.click(screen.getByText("Settings"));

    expect(
      screen.getByRole("checkbox", { name: /open commentary by default/i }),
    ).toBeChecked();
    expect(
      screen.getByRole("checkbox", { name: /open translation by default/i }),
    ).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Live" })).toBeChecked();
    await waitFor(() =>
      expect(
        screen.getByRole("combobox", { name: "Commentary text" }),
      ).toHaveTextContent("Great Commentary"),
    );
    expect(
      screen.getByRole("combobox", { name: "Translation text" }),
    ).toBeDisabled();
  });

  it("saves an open panel with no text chosen", async () => {
    renderDialog();
    await userEvent.click(screen.getByText("Settings"));

    await userEvent.click(
      screen.getByRole("checkbox", { name: /open commentary by default/i }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(updateTaskSettings).toHaveBeenCalledWith("task-1", {
        is_commentary_open: true,
        commentary_text_id: null,
        is_translation_open: false,
        translation_text_id: null,
        is_live: false,
      }),
    );
  });

  it("saves a chosen translation", async () => {
    renderDialog();
    await userEvent.click(screen.getByText("Settings"));

    await userEvent.click(
      screen.getByRole("checkbox", { name: /open translation by default/i }),
    );
    await waitFor(() =>
      expect(fetchTextRelationsForSources).toHaveBeenCalled(),
    );
    await userEvent.click(
      screen.getByRole("combobox", { name: "Translation text" }),
    );
    await userEvent.click(
      await screen.findByRole("option", { name: /English Translation/ }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(updateTaskSettings).toHaveBeenCalledWith(
        "task-1",
        expect.objectContaining({
          is_translation_open: true,
          translation_text_id: "tr-1",
        }),
      ),
    );
  });

  it("keeps a saved text the list no longer offers", async () => {
    renderDialog({
      settings: { is_translation_open: true, translation_text_id: "old-text" },
    });

    await userEvent.click(screen.getByText("Settings"));

    await waitFor(() =>
      expect(
        screen.getByRole("combobox", { name: "Translation text" }),
      ).toHaveTextContent("old-text"),
    );
  });

  it("warns which task loses live on the same day", async () => {
    renderDialog({
      dayTasks: [
        { id: "task-1", title: "This task", settings: { is_live: false } },
        { id: "task-2", title: "Morning chant", settings: { is_live: true } },
      ],
    });
    await userEvent.click(screen.getByText("Settings"));

    expect(
      screen.getByText("Only one task per day can be live."),
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole("checkbox", { name: "Live" }));

    expect(
      screen.getByText(
        'This will turn off live for "Morning chant" on this day.',
      ),
    ).toBeInTheDocument();
  });

  it("explains when the task has no text to pick from", async () => {
    fetchTaskDetails.mockResolvedValue({ id: "task-1", subtasks: [] });
    renderDialog({ settings: { is_commentary_open: true } });

    await userEvent.click(screen.getByText("Settings"));

    expect(
      await screen.findByText(
        "This task has no text to read commentary from. The reader will show the list.",
      ),
    ).toBeInTheDocument();
    expect(fetchTextRelationsForSources).not.toHaveBeenCalled();
  });
});
