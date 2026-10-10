import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { vi } from "vitest";
import { NotificationForm } from "./NotificationForm";

const mockExistingNotification = {
  id: "notif-123",
  day_id: "day-1",
  title: "Test Title",
  body: "Test Body",
  image_type: "PLAN" as const,
  image_url: "https://example.com/plan-cover.jpg",
  created_at: "2026-06-15T09:00:00Z",
  updated_at: null,
};

const mockCustomNotification = {
  id: "notif-456",
  day_id: "day-1",
  title: "Custom Title",
  body: "Custom Body",
  image_type: "CUSTOM" as const,
  image_url: "https://example.com/custom-image.jpg",
  created_at: "2026-06-15T09:00:00Z",
  updated_at: null,
};

const mockPlanCoverImage = "https://example.com/plan-cover.jpg";

vi.mock("../../api/notificationApi", () => ({
  getNotification: vi.fn(),
  createNotification: vi.fn(),
  updateNotification: vi.fn(),
  deleteNotification: vi.fn(),
}));

vi.mock("../../api/taskApi", () => ({
  uploadImageToS3: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock("react-icons/md", () => ({
  MdOutlineImage: () => <div data-testid="image-icon">Image Icon</div>,
}));

const renderWithProviders = (
  component: React.ReactElement,
  existingNotificationData?: any,
) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  if (existingNotificationData !== undefined) {
    queryClient.setQueryData(
      ["notification", "day-1"],
      existingNotificationData,
    );
  }

  return render(
    <QueryClientProvider client={queryClient}>{component}</QueryClientProvider>,
  );
};

describe("NotificationForm Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Rendering Tests", () => {
    it("renders form with Title and Body fields", async () => {
      const { getNotification } = await import("../../api/notificationApi");
      vi.mocked(getNotification).mockResolvedValue(null);

      renderWithProviders(
        <NotificationForm
          dayId="day-1"
          planId="plan-1"
          planCoverImage={mockPlanCoverImage}
        />,
        null,
      );

      await waitFor(() => {
        expect(
          screen.getByLabelText("studio.common.title"),
        ).toBeInTheDocument();
        expect(
          screen.getByLabelText("studio.task.notification.body"),
        ).toBeInTheDocument();
      });
    });

    it("shows character counters", async () => {
      const { getNotification } = await import("../../api/notificationApi");
      vi.mocked(getNotification).mockResolvedValue(null);

      renderWithProviders(
        <NotificationForm
          dayId="day-1"
          planId="plan-1"
          planCoverImage={mockPlanCoverImage}
        />,
        null,
      );

      await waitFor(() => {
        expect(screen.getByText("0 / 40")).toBeInTheDocument();
        expect(screen.getByText("0 / 180")).toBeInTheDocument();
      });
    });

    it("renders three image options", async () => {
      const { getNotification } = await import("../../api/notificationApi");
      vi.mocked(getNotification).mockResolvedValue(null);

      renderWithProviders(
        <NotificationForm
          dayId="day-1"
          planId="plan-1"
          planCoverImage={mockPlanCoverImage}
        />,
        null,
      );

      await waitFor(() => {
        expect(
          screen.getByText("studio.task.notification.custom"),
        ).toBeInTheDocument();
        expect(
          screen.getByText("studio.task.notification.use_plan_cover"),
        ).toBeInTheDocument();
        expect(
          screen.getByText("studio.task.notification.no_image"),
        ).toBeInTheDocument();
      });
    });

    it("shows loading state when fetching notification", () => {
      renderWithProviders(
        <NotificationForm
          dayId="day-1"
          planId="plan-1"
          planCoverImage={mockPlanCoverImage}
        />,
      );

      expect(screen.getByText("studio.common.loading")).toBeInTheDocument();
    });

    it("shows Save button in create mode", async () => {
      const { getNotification } = await import("../../api/notificationApi");
      vi.mocked(getNotification).mockResolvedValue(null);

      renderWithProviders(
        <NotificationForm
          dayId="day-1"
          planId="plan-1"
          planCoverImage={mockPlanCoverImage}
        />,
        null,
      );

      await waitFor(() => {
        expect(screen.getByText("studio.common.save")).toBeInTheDocument();
      });
    });

    it("shows Update button in edit mode", async () => {
      renderWithProviders(
        <NotificationForm
          dayId="day-1"
          planId="plan-1"
          planCoverImage={mockPlanCoverImage}
        />,
        mockExistingNotification,
      );

      await waitFor(() => {
        expect(screen.getByText("studio.common.update")).toBeInTheDocument();
      });
    });
  });

  describe("Form Interaction Tests", () => {
    it("updates title field and character counter", async () => {
      const { getNotification } = await import("../../api/notificationApi");
      vi.mocked(getNotification).mockResolvedValue(null);

      renderWithProviders(
        <NotificationForm
          dayId="day-1"
          planId="plan-1"
          planCoverImage={mockPlanCoverImage}
        />,
        null,
      );

      await waitFor(() => {
        const titleInput = screen.getByLabelText("studio.common.title");
        fireEvent.change(titleInput, { target: { value: "New Title" } });
        expect(titleInput).toHaveValue("New Title");
        expect(screen.getByText("9 / 40")).toBeInTheDocument();
      });
    });

    it("updates body field and character counter", async () => {
      const { getNotification } = await import("../../api/notificationApi");
      vi.mocked(getNotification).mockResolvedValue(null);

      renderWithProviders(
        <NotificationForm
          dayId="day-1"
          planId="plan-1"
          planCoverImage={mockPlanCoverImage}
        />,
        null,
      );

      await waitFor(() => {
        const bodyInput = screen.getByLabelText(
          "studio.task.notification.body",
        );
        fireEvent.change(bodyInput, { target: { value: "New Body Content" } });
        expect(bodyInput).toHaveValue("New Body Content");
        expect(screen.getByText("16 / 180")).toBeInTheDocument();
      });
    });

    it("enforces title max length of 40 characters", async () => {
      const { getNotification } = await import("../../api/notificationApi");
      vi.mocked(getNotification).mockResolvedValue(null);

      renderWithProviders(
        <NotificationForm
          dayId="day-1"
          planId="plan-1"
          planCoverImage={mockPlanCoverImage}
        />,
        null,
      );

      await waitFor(() => {
        const titleInput = screen.getByLabelText(
          "studio.common.title",
        ) as HTMLInputElement;
        expect(titleInput.maxLength).toBe(40);
      });
    });

    it("enforces body max length of 180 characters", async () => {
      const { getNotification } = await import("../../api/notificationApi");
      vi.mocked(getNotification).mockResolvedValue(null);

      renderWithProviders(
        <NotificationForm
          dayId="day-1"
          planId="plan-1"
          planCoverImage={mockPlanCoverImage}
        />,
        null,
      );

      await waitFor(() => {
        const bodyInput = screen.getByLabelText(
          "studio.task.notification.body",
        ) as HTMLTextAreaElement;
        expect(bodyInput.maxLength).toBe(180);
      });
    });

    it("selects CUSTOM image type", async () => {
      const { getNotification } = await import("../../api/notificationApi");
      vi.mocked(getNotification).mockResolvedValue(null);

      renderWithProviders(
        <NotificationForm
          dayId="day-1"
          planId="plan-1"
          planCoverImage={mockPlanCoverImage}
        />,
        null,
      );

      await waitFor(() => {
        const customRadio = screen.getByRole("radio", { name: /custom/i });
        fireEvent.click(customRadio);
        expect(customRadio).toBeChecked();
      });
    });

    it("selects PLAN image type", async () => {
      const { getNotification } = await import("../../api/notificationApi");
      vi.mocked(getNotification).mockResolvedValue(null);

      renderWithProviders(
        <NotificationForm
          dayId="day-1"
          planId="plan-1"
          planCoverImage={mockPlanCoverImage}
        />,
        null,
      );

      await waitFor(() => {
        const planRadio = screen.getByRole("radio", {
          name: /studio.task.notification.use_plan_cover/,
        });
        fireEvent.click(planRadio);
        expect(planRadio).toBeChecked();
      });
    });

    it("selects no image option", async () => {
      const { getNotification } = await import("../../api/notificationApi");
      vi.mocked(getNotification).mockResolvedValue(null);

      renderWithProviders(
        <NotificationForm
          dayId="day-1"
          planId="plan-1"
          planCoverImage={mockPlanCoverImage}
        />,
        null,
      );

      await waitFor(() => {
        const noImageRadio = screen.getByRole("radio", {
          name: "studio.task.notification.no_image",
        });
        fireEvent.click(noImageRadio);
        expect(noImageRadio).toBeChecked();
      });
    });
  });

  describe("Image Upload Tests", () => {
    it("rejects files over 5MB", async () => {
      const { getNotification } = await import("../../api/notificationApi");
      const { toast } = await import("sonner");
      vi.mocked(getNotification).mockResolvedValue(null);

      const { container } = renderWithProviders(
        <NotificationForm
          dayId="day-1"
          planId="plan-1"
          planCoverImage={mockPlanCoverImage}
        />,
        null,
      );

      await waitFor(() => {
        const fileInput = container.querySelector(
          'input[type="file"]',
        ) as HTMLInputElement;

        const largeFile = new File(["x".repeat(6 * 1024 * 1024)], "large.jpg", {
          type: "image/jpeg",
        });

        fireEvent.change(fileInput, { target: { files: [largeFile] } });

        expect(toast.error).toHaveBeenCalledWith(
          "studio.task.notification.image_too_large",
        );
      });
    });

    it("rejects invalid file types", async () => {
      const { getNotification } = await import("../../api/notificationApi");
      const { toast } = await import("sonner");
      vi.mocked(getNotification).mockResolvedValue(null);

      const { container } = renderWithProviders(
        <NotificationForm
          dayId="day-1"
          planId="plan-1"
          planCoverImage={mockPlanCoverImage}
        />,
        null,
      );

      await waitFor(() => {
        const fileInput = container.querySelector(
          'input[type="file"]',
        ) as HTMLInputElement;

        const invalidFile = new File(["content"], "file.pdf", {
          type: "application/pdf",
        });

        fireEvent.change(fileInput, { target: { files: [invalidFile] } });

        expect(toast.error).toHaveBeenCalledWith(
          "studio.task.notification.invalid_file_type",
        );
      });
    });

    it("uploads valid image and sets CUSTOM type", async () => {
      const { getNotification } = await import("../../api/notificationApi");
      const { uploadImageToS3 } = await import("../../api/taskApi");
      const { toast } = await import("sonner");

      vi.mocked(getNotification).mockResolvedValue(null);
      vi.mocked(uploadImageToS3).mockResolvedValue({
        image: { original: "https://example.com/uploaded.jpg" },
        key: "uploaded-key",
      });

      const { container } = renderWithProviders(
        <NotificationForm
          dayId="day-1"
          planId="plan-1"
          planCoverImage={mockPlanCoverImage}
        />,
        null,
      );

      await waitFor(async () => {
        const fileInput = container.querySelector(
          'input[type="file"]',
        ) as HTMLInputElement;

        const validFile = new File(["content"], "image.jpg", {
          type: "image/jpeg",
        });

        fireEvent.change(fileInput, { target: { files: [validFile] } });

        await waitFor(() => {
          expect(uploadImageToS3).toHaveBeenCalledWith(validFile, "plan-1");
          expect(toast.success).toHaveBeenCalledWith(
            "studio.task.form.image_uploaded",
          );
        });
      });
    });
  });

  describe("API Integration Tests", () => {
    it("calls createNotification when saving new notification", async () => {
      const { getNotification, createNotification } = await import(
        "../../api/notificationApi"
      );
      const { toast } = await import("sonner");

      vi.mocked(getNotification).mockResolvedValue(null);
      vi.mocked(createNotification).mockResolvedValue({
        ...mockExistingNotification,
        id: "new-notif",
      });

      renderWithProviders(
        <NotificationForm
          dayId="day-1"
          planId="plan-1"
          planCoverImage={mockPlanCoverImage}
        />,
        null,
      );

      await waitFor(() => {
        const titleInput = screen.getByLabelText("studio.common.title");
        const bodyInput = screen.getByLabelText(
          "studio.task.notification.body",
        );

        fireEvent.change(titleInput, { target: { value: "New Title" } });
        fireEvent.change(bodyInput, { target: { value: "New Body" } });

        const saveButton = screen.getByText("studio.common.save");
        fireEvent.click(saveButton);
      });

      await waitFor(() => {
        expect(createNotification).toHaveBeenCalledWith("day-1", {
          title: "New Title",
          body: "New Body",
          image_type: null,
          image_url: null,
        });
        expect(toast.success).toHaveBeenCalledWith(
          "studio.task.notification.created",
        );
      });
    });

    it("calls updateNotification when updating existing notification", async () => {
      const { updateNotification } = await import("../../api/notificationApi");
      const { toast } = await import("sonner");

      vi.mocked(updateNotification).mockResolvedValue(mockExistingNotification);

      renderWithProviders(
        <NotificationForm
          dayId="day-1"
          planId="plan-1"
          planCoverImage={mockPlanCoverImage}
        />,
        mockExistingNotification,
      );

      await waitFor(() => {
        const titleInput = screen.getByLabelText("studio.common.title");
        fireEvent.change(titleInput, { target: { value: "Updated Title" } });

        const updateButton = screen.getByText("studio.common.update");
        fireEvent.click(updateButton);
      });

      await waitFor(() => {
        expect(updateNotification).toHaveBeenCalledWith("day-1", {
          title: "Updated Title",
          body: "Test Body",
          image_type: "PLAN",
          image_url: mockPlanCoverImage,
        });
        expect(toast.success).toHaveBeenCalledWith(
          "studio.task.notification.updated",
        );
      });
    });

    it("calls deleteNotification when clearing existing notification", async () => {
      const { deleteNotification } = await import("../../api/notificationApi");
      const { toast } = await import("sonner");

      vi.mocked(deleteNotification).mockResolvedValue(undefined);

      renderWithProviders(
        <NotificationForm
          dayId="day-1"
          planId="plan-1"
          planCoverImage={mockPlanCoverImage}
        />,
        mockExistingNotification,
      );

      await waitFor(() => {
        const clearButton = screen.getByText("studio.common.clear");
        fireEvent.click(clearButton);
      });

      await waitFor(() => {
        expect(deleteNotification).toHaveBeenCalledWith("day-1");
        expect(toast.success).toHaveBeenCalledWith(
          "studio.task.notification.deleted",
        );
      });
    });

    it("resets form when clearing new notification without API call", async () => {
      const { getNotification, deleteNotification } = await import(
        "../../api/notificationApi"
      );

      vi.mocked(getNotification).mockResolvedValue(null);

      renderWithProviders(
        <NotificationForm
          dayId="day-1"
          planId="plan-1"
          planCoverImage={mockPlanCoverImage}
        />,
        null,
      );

      await waitFor(() => {
        const titleInput = screen.getByLabelText("studio.common.title");
        fireEvent.change(titleInput, { target: { value: "Some Title" } });

        const clearButton = screen.getByText("studio.common.clear");
        fireEvent.click(clearButton);

        expect(deleteNotification).not.toHaveBeenCalled();
        expect(titleInput).toHaveValue("");
      });
    });

    it("shows error toast on save failure", async () => {
      const { getNotification, createNotification } = await import(
        "../../api/notificationApi"
      );
      const { toast } = await import("sonner");

      vi.mocked(getNotification).mockResolvedValue(null);
      vi.mocked(createNotification).mockRejectedValue(
        new Error("Network error"),
      );

      renderWithProviders(
        <NotificationForm
          dayId="day-1"
          planId="plan-1"
          planCoverImage={mockPlanCoverImage}
        />,
        null,
      );

      await waitFor(() => {
        const titleInput = screen.getByLabelText("studio.common.title");
        fireEvent.change(titleInput, { target: { value: "Title" } });

        const saveButton = screen.getByText("studio.common.save");
        fireEvent.click(saveButton);
      });

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(
          "studio.task.notification.save_failed",
          {
            description: "Network error",
          },
        );
      });
    });
  });

  describe("Image Type Payload Tests", () => {
    it("sends image_url: null when image_type is null", async () => {
      const { getNotification, createNotification } = await import(
        "../../api/notificationApi"
      );

      vi.mocked(getNotification).mockResolvedValue(null);
      vi.mocked(createNotification).mockResolvedValue({
        ...mockExistingNotification,
        id: "new-notif",
      });

      renderWithProviders(
        <NotificationForm
          dayId="day-1"
          planId="plan-1"
          planCoverImage={mockPlanCoverImage}
        />,
        null,
      );

      await waitFor(() => {
        const titleInput = screen.getByLabelText("studio.common.title");
        fireEvent.change(titleInput, { target: { value: "Title" } });

        const saveButton = screen.getByText("studio.common.save");
        fireEvent.click(saveButton);
      });

      await waitFor(() => {
        expect(createNotification).toHaveBeenCalledWith("day-1", {
          title: "Title",
          body: "",
          image_type: null,
          image_url: null,
        });
      });
    });

    it("sends image_url: customImageUrl when image_type is CUSTOM", async () => {
      const { getNotification, createNotification } = await import(
        "../../api/notificationApi"
      );
      const { uploadImageToS3 } = await import("../../api/taskApi");

      vi.mocked(getNotification).mockResolvedValue(null);
      vi.mocked(uploadImageToS3).mockResolvedValue({
        image: { original: "https://example.com/custom.jpg" },
        key: "custom-key",
      });
      vi.mocked(createNotification).mockResolvedValue({
        ...mockExistingNotification,
        id: "new-notif",
      });

      const { container } = renderWithProviders(
        <NotificationForm
          dayId="day-1"
          planId="plan-1"
          planCoverImage={mockPlanCoverImage}
        />,
        null,
      );

      await waitFor(() => {
        expect(
          screen.getByLabelText("studio.common.title"),
        ).toBeInTheDocument();
      });

      const fileInput = container.querySelector(
        'input[type="file"]',
      ) as HTMLInputElement;

      const validFile = new File(["content"], "image.jpg", {
        type: "image/jpeg",
      });

      fireEvent.change(fileInput, { target: { files: [validFile] } });

      await waitFor(() => {
        expect(uploadImageToS3).toHaveBeenCalledWith(validFile, "plan-1");
      });

      const titleInput = screen.getByLabelText("studio.common.title");
      fireEvent.change(titleInput, { target: { value: "Title" } });

      const saveButton = screen.getByText("studio.common.save");
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(createNotification).toHaveBeenCalledWith("day-1", {
          title: "Title",
          body: "",
          image_type: "CUSTOM",
          image_url: "custom-key",
        });
      });
    });

    it("sends image_url: planCoverImage when image_type is PLAN", async () => {
      const { getNotification, createNotification } = await import(
        "../../api/notificationApi"
      );

      vi.mocked(getNotification).mockResolvedValue(null);
      vi.mocked(createNotification).mockResolvedValue({
        ...mockExistingNotification,
        id: "new-notif",
      });

      renderWithProviders(
        <NotificationForm
          dayId="day-1"
          planId="plan-1"
          planCoverImage={mockPlanCoverImage}
        />,
        null,
      );

      await waitFor(() => {
        const planRadio = screen.getByRole("radio", {
          name: /studio.task.notification.use_plan_cover/,
        });
        fireEvent.click(planRadio);

        const titleInput = screen.getByLabelText("studio.common.title");
        fireEvent.change(titleInput, { target: { value: "Title" } });

        const saveButton = screen.getByText("studio.common.save");
        fireEvent.click(saveButton);
      });

      await waitFor(() => {
        expect(createNotification).toHaveBeenCalledWith("day-1", {
          title: "Title",
          body: "",
          image_type: "PLAN",
          image_url: mockPlanCoverImage,
        });
      });
    });
  });

  describe("Permission Tests", () => {
    it("disables form fields when isEditable is false", async () => {
      const { getNotification } = await import("../../api/notificationApi");
      vi.mocked(getNotification).mockResolvedValue(null);

      renderWithProviders(
        <NotificationForm
          dayId="day-1"
          planId="plan-1"
          planCoverImage={mockPlanCoverImage}
          isEditable={false}
        />,
        null,
      );

      await waitFor(() => {
        const titleInput = screen.getByLabelText("studio.common.title");
        const bodyInput = screen.getByLabelText(
          "studio.task.notification.body",
        );

        expect(titleInput).toBeDisabled();
        expect(bodyInput).toBeDisabled();
      });
    });

    it("disables buttons when isEditable is false", async () => {
      const { getNotification } = await import("../../api/notificationApi");
      vi.mocked(getNotification).mockResolvedValue(null);

      renderWithProviders(
        <NotificationForm
          dayId="day-1"
          planId="plan-1"
          planCoverImage={mockPlanCoverImage}
          isEditable={false}
        />,
        null,
      );

      await waitFor(() => {
        const clearButton = screen.getByText("studio.common.clear");
        const saveButton = screen.getByText("studio.common.save");

        expect(clearButton).toBeDisabled();
        expect(saveButton).toBeDisabled();
      });
    });
  });

  describe("Existing Notification Loading", () => {
    it("populates form with existing notification data", async () => {
      renderWithProviders(
        <NotificationForm
          dayId="day-1"
          planId="plan-1"
          planCoverImage={mockPlanCoverImage}
        />,
        mockExistingNotification,
      );

      await waitFor(() => {
        const titleInput = screen.getByLabelText(
          "studio.common.title",
        ) as HTMLInputElement;
        const bodyInput = screen.getByLabelText(
          "studio.task.notification.body",
        ) as HTMLTextAreaElement;

        expect(titleInput.value).toBe("Test Title");
        expect(bodyInput.value).toBe("Test Body");
      });
    });

    it("sets PLAN image type for existing notification with PLAN type", async () => {
      renderWithProviders(
        <NotificationForm
          dayId="day-1"
          planId="plan-1"
          planCoverImage={mockPlanCoverImage}
        />,
        mockExistingNotification,
      );

      await waitFor(() => {
        const planRadio = screen.getByRole("radio", {
          name: /studio.task.notification.use_plan_cover/,
        });
        expect(planRadio).toBeChecked();
      });
    });

    it("sets CUSTOM image type and preview for existing notification with CUSTOM type", async () => {
      renderWithProviders(
        <NotificationForm
          dayId="day-1"
          planId="plan-1"
          planCoverImage={mockPlanCoverImage}
        />,
        mockCustomNotification,
      );

      await waitFor(() => {
        const customRadio = screen.getByRole("radio", { name: /custom/i });
        expect(customRadio).toBeChecked();

        const customImage = screen.getByAltText(
          "studio.task.notification.custom",
        ) as HTMLImageElement;
        expect(customImage.src).toBe("https://example.com/custom-image.jpg");
      });
    });
  });
});
