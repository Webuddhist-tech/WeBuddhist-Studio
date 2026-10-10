import {
  fireEvent,
  render,
  screen,
  waitFor,
  act,
  within,
} from "@testing-library/react";
import {
  MemoryRouter,
  useBlocker,
  useLocation,
  useParams,
} from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import CreatePlan from "./CreatePlan";
import { vi } from "vitest";
import axiosInstance from "@/config/axios-config";

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useBlocker: vi.fn(() => ({
      state: "unblocked",
      proceed: vi.fn(),
      reset: vi.fn(),
    })),
    useParams: vi.fn(() => ({ groupId: "test-group-id" })),
    useLocation: vi.fn(() => ({
      pathname: "/groups/test-group-id/plan/new",
      search: "",
      hash: "",
      state: null,
      key: "default",
    })),
  };
});

const renderWithProviders = (
  component: React.ReactElement,
  initialEntry: string | { pathname: string; state?: unknown } = "/plan/new",
) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <QueryClientProvider client={queryClient}>
        {component}
      </QueryClientProvider>
    </MemoryRouter>,
  );
};

vi.mock(
  "@/components/ui/molecules/modals/image-upload/ImageContentData",
  () => ({
    default: ({ onUpload }: { onUpload: (file: File) => void }) => (
      <div>
        <button
          onClick={() => {
            const mockFile = new File(["sample file"], "sample.jpg", {
              type: "image/jpeg",
            });
            onUpload(mockFile);
          }}
          data-testid="mock-upload-trigger"
        >
          Upload
        </button>
      </div>
    ),
  }),
);

describe("CreatePlan Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // `clearAllMocks` resets call history but keeps implementations set via
    // `mockReturnValue`. The navigation tests force `useBlocker` into a
    // "blocked" state, which opens the navigation dialog; reset it here so
    // that leaked dialog doesn't `aria-hidden` the form in later tests.
    vi.mocked(useBlocker).mockReturnValue({
      state: "unblocked",
      proceed: undefined,
      reset: undefined,
      location: undefined,
    });
    vi.mocked(useParams).mockReturnValue({ groupId: "test-group-id" });
    vi.mocked(useLocation).mockReturnValue({
      pathname: "/groups/test-group-id/plan/new",
      search: "",
      hash: "",
      state: null,
      key: "default",
    });
    vi.spyOn(axiosInstance, "post").mockImplementation((url: string) => {
      if (url.includes("/media/upload")) {
        return Promise.resolve({
          data: {
            image: {
              thumbnail: "mock-thumb-url",
              medium: "mock-medium-url",
              original: "mock-image-url",
            },
            key: "mock-image-key",
            path: "images/path",
            message: "Image uploaded successfully",
          },
        });
      }
      if (url.includes("/cms/tags")) {
        return Promise.resolve({
          data: {
            id: "tag-new",
            name: "Newtag",
            image: null,
            image_key: null,
            description: null,
            plan_ids: [],
          },
        });
      }
      return Promise.resolve({ data: {} });
    });
    vi.spyOn(axiosInstance, "get").mockImplementation((url: string) => {
      if (url.includes("/cms/tags")) {
        return Promise.resolve({
          data: {
            tags: [
              {
                id: "tag-1",
                name: "Meditation",
                image: null,
                image_key: null,
                description: null,
                plan_ids: [],
              },
              {
                id: "tag-2",
                name: "Daily tipitaka",
                image: null,
                image_key: null,
                description: null,
                plan_ids: [],
              },
            ],
            skip: 0,
            limit: 500,
            total: 2,
          },
        });
      }
      return Promise.resolve({
        data: {
          id: "plan-123",
          title: "Existing Plan",
          description: "Existing description",
          total_days: 14,
          difficulty_level: "Beginner",
          plan_image_url: "https://example.com/image.jpg",
          image_url: "https://example.com/image.jpg",
          tags: [
            {
              id: "tag-1",
              name: "Meditation",
              image: null,
              image_key: null,
              description: null,
            },
          ],
          language: "en",
          start_date: "2026-04-30T00:00:00Z",
        },
      });
    });
  });
  it("renders create plan form with main heading", () => {
    renderWithProviders(<CreatePlan />);

    expect(
      screen.getByRole("heading", { name: "studio.plan.heading.details" }),
    ).toBeInTheDocument();
  });

  it("renders title input field", () => {
    renderWithProviders(<CreatePlan />);

    const titleInput = screen.getByPlaceholderText(
      "studio.plan.form.placeholder.title",
    );
    expect(titleInput).toBeInTheDocument();
    expect(titleInput.tagName).toBe("INPUT");
  });

  it("renders description textarea", () => {
    renderWithProviders(<CreatePlan />);

    const descriptionTextarea = screen.getByPlaceholderText(
      "studio.plan.form.placeholder.description",
    );
    expect(descriptionTextarea).toBeInTheDocument();
    expect(descriptionTextarea.tagName).toBe("TEXTAREA");
  });

  it("renders number of days field with label", () => {
    renderWithProviders(<CreatePlan />);

    expect(
      screen.getByText("studio.plan.form_field.number_of_day"),
    ).toBeInTheDocument();

    const daysInput = screen.getByPlaceholderText(
      "studio.plan.form.placeholder.number_of_days",
    );
    expect(daysInput).toBeInTheDocument();
    expect(daysInput.getAttribute("type")).toBe("number");
  });

  it("renders cover image section", () => {
    renderWithProviders(<CreatePlan />);

    expect(
      screen.getByText("studio.dashboard.cover_image"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("studio.plan.cover_image.constraints"),
    ).toBeInTheDocument();
  });

  it("renders difficulty level field with label", () => {
    renderWithProviders(<CreatePlan />);

    expect(
      screen.getByText("studio.plan.form_field.difficulty"),
    ).toBeInTheDocument();
  });

  it("renders submit button", () => {
    renderWithProviders(<CreatePlan />);

    const submitButton = screen.getByText("studio.plan.next_button");
    expect(submitButton).toBeInTheDocument();
    expect(submitButton.tagName).toBe("BUTTON");
  });

  it("allows typing in title input", () => {
    renderWithProviders(<CreatePlan />);

    const titleInput = screen.getByPlaceholderText(
      "studio.plan.form.placeholder.title",
    );

    fireEvent.change(titleInput, { target: { value: "Test Plan Title" } });

    expect(titleInput).toHaveValue("Test Plan Title");
  });

  it("allows typing in description textarea", () => {
    renderWithProviders(<CreatePlan />);

    const descriptionTextarea = screen.getByPlaceholderText(
      "studio.plan.form.placeholder.description",
    );

    fireEvent.change(descriptionTextarea, {
      target: { value: "Test plan description" },
    });

    expect(descriptionTextarea).toHaveValue("Test plan description");
  });

  it("allows typing in number of days input", () => {
    renderWithProviders(<CreatePlan />);

    const daysInput = screen.getByPlaceholderText(
      "studio.plan.form.placeholder.number_of_days",
    );

    fireEvent.change(daysInput, { target: { value: "30" } });

    expect(daysInput).toHaveValue(30);
  });

  it("renders image upload area", () => {
    renderWithProviders(<CreatePlan />);
    expect(
      screen.getByText("studio.dashboard.cover_image"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("studio.plan.cover_image.constraints"),
    ).toBeInTheDocument();
    const uploadButton = screen.getByLabelText(
      "studio.plan.image.upload_cover_aria",
    );
    expect(uploadButton).toBeInTheDocument();
  });

  it("displays image preview after upload", async () => {
    renderWithProviders(<CreatePlan />);
    const uploadButton = screen.getByLabelText(
      "studio.plan.image.upload_cover_aria",
    );
    fireEvent.click(uploadButton);
    await waitFor(() => {
      expect(
        screen.getByText("studio.plan.image.upload_crop_title"),
      ).toBeInTheDocument();
    });
    const mockUploadButton = screen.getByTestId("mock-upload-trigger");

    await act(async () => {
      fireEvent.click(mockUploadButton);
    });

    await waitFor(() => {
      expect(
        screen.getByAltText("studio.plan.image.cover_preview_alt"),
      ).toBeInTheDocument();
    });
    expect(screen.getByTestId("image-remove")).toBeInTheDocument();
    expect(screen.getByText("sample.jpg")).toBeInTheDocument();
    expect(
      screen.queryByText("studio.plan.image.upload_crop_title"),
    ).not.toBeInTheDocument();
  });

  it("removes image preview when remove button is clicked", async () => {
    renderWithProviders(<CreatePlan />);
    const uploadButton = screen.getByLabelText(
      "studio.plan.image.upload_cover_aria",
    );
    fireEvent.click(uploadButton);
    await waitFor(() => {
      expect(screen.getByTestId("mock-upload-trigger")).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId("mock-upload-trigger"));
    });

    await waitFor(() => {
      expect(
        screen.getByAltText("studio.plan.image.cover_preview_alt"),
      ).toBeInTheDocument();
    });

    const removeButton = screen.getByTestId("image-remove");
    expect(removeButton).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(removeButton);
    });

    await waitFor(() => {
      expect(
        screen.queryByAltText("studio.plan.image.cover_preview_alt"),
      ).not.toBeInTheDocument();
    });
    expect(screen.queryByTestId("image-remove")).not.toBeInTheDocument();
    expect(screen.queryByText("sample.jpg")).not.toBeInTheDocument();
  });

  it("handles image upload error", async () => {
    vi.spyOn(axiosInstance, "post").mockImplementation((url) => {
      if (url.includes("/media/upload")) {
        return Promise.reject(new Error("Upload failed"));
      }
      return Promise.resolve({ data: {} });
    });
    renderWithProviders(<CreatePlan />);
    const uploadButton = screen.getByLabelText(
      "studio.plan.image.upload_cover_aria",
    );
    fireEvent.click(uploadButton);
    await waitFor(() => {
      expect(
        screen.getByText("studio.plan.image.upload_crop_title"),
      ).toBeInTheDocument();
    });
    const mockUploadButton = screen.getByTestId("mock-upload-trigger");
    await act(async () => {
      fireEvent.click(mockUploadButton);
    });
    await waitFor(() => {
      expect(
        screen.queryByAltText("studio.plan.image.cover_preview_alt"),
      ).not.toBeInTheDocument();
    });
  });

  it("opens image upload dialog when upload button is clicked", async () => {
    renderWithProviders(<CreatePlan />);
    const uploadButton = screen.getByLabelText(
      "studio.plan.image.upload_cover_aria",
    );
    fireEvent.click(uploadButton);
    await waitFor(() => {
      expect(
        screen.getByText("studio.plan.image.upload_crop_title"),
      ).toBeInTheDocument();
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });
  });

  it("shows validation errors for required fields", async () => {
    vi.mocked(useParams).mockReturnValue({ groupId: "test-group-id" });
    renderWithProviders(<CreatePlan />);
    const submitButton = screen.getByText("studio.plan.next_button");
    fireEvent.click(submitButton);
    expect(
      await screen.findByText("Plan title is required"),
    ).toBeInTheDocument();
    expect(
      await screen.findByText("Description is required"),
    ).toBeInTheDocument();
    expect(
      await screen.findByText("Difficulty is required"),
    ).toBeInTheDocument();
  });

  it("handles tag search selection and remove", async () => {
    renderWithProviders(<CreatePlan />);
    const tagInput = screen.getByPlaceholderText(
      "studio.plan.tags.search_placeholder",
    );
    fireEvent.change(tagInput, { target: { value: "Med" } });
    fireEvent.focus(tagInput);

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Meditation" }),
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Meditation" }));
    expect(screen.getAllByText("Meditation").length).toBeGreaterThan(0);

    const removeButton = screen.getByRole("button", {
      name: "studio.plan.tags.remove_aria",
    });
    fireEvent.click(removeButton);
    expect(
      screen.queryByRole("button", { name: "studio.plan.tags.remove_aria" }),
    ).toBeNull();
  });

  it("creates a new tag when typing a name that does not exist", async () => {
    renderWithProviders(<CreatePlan />);
    const tagInput = screen.getByPlaceholderText(
      "studio.plan.tags.search_placeholder",
    );
    fireEvent.change(tagInput, { target: { value: "Brand New Tag" } });
    fireEvent.focus(tagInput);

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "studio.plan.tags.create_option" }),
      ).toBeInTheDocument();
    });

    fireEvent.click(
      screen.getByRole("button", { name: "studio.plan.tags.create_option" }),
    );

    // Clicking the create option opens a multi-language dialog with the
    // typed name pre-filled for the default (EN) language.
    const createTagButton = await screen.findByRole("button", {
      name: "studio.plan.tags.create_tag",
    });
    fireEvent.click(createTagButton);

    await waitFor(() => {
      expect(axiosInstance.post).toHaveBeenCalledWith(
        "/api/v1/cms/tags",
        expect.objectContaining({
          metadata: expect.arrayContaining([
            expect.objectContaining({
              language: "EN",
              name: "Brand New Tag",
            }),
          ]),
        }),
        expect.any(Object),
      );
    });

    // Successful creation closes the dialog; wait for it so the Radix
    // scroll-lock is torn down and does not leak into later tests.
    await waitFor(() => {
      expect(
        screen.queryByRole("button", { name: "studio.plan.tags.create_tag" }),
      ).not.toBeInTheDocument();
    });
  });

  it("shows no image preview initially", () => {
    renderWithProviders(<CreatePlan />);
    expect(
      screen.queryByAltText("studio.plan.image.cover_preview_alt"),
    ).not.toBeInTheDocument();
  });

  it("handles failed plan creation", async () => {
    vi.spyOn(axiosInstance, "post").mockRejectedValue(new Error("API Error"));
    renderWithProviders(<CreatePlan />);
    const titleInput = screen.getByPlaceholderText(
      "studio.plan.form.placeholder.title",
    );
    const descriptionTextarea = screen.getByPlaceholderText(
      "studio.plan.form.placeholder.description",
    );
    const daysInput = screen.getByPlaceholderText(
      "studio.plan.form.placeholder.number_of_days",
    );
    fireEvent.change(titleInput, { target: { value: "Test Plan" } });
    fireEvent.change(descriptionTextarea, {
      target: { value: "Test Plan Description" },
    });
    fireEvent.change(daysInput, { target: { value: "30" } });
    const difficultyButton = screen.getByTestId("select-trigger");
    fireEvent.click(difficultyButton);
    const difficultyOption = screen.getByText(
      "studio.plan.difficulty.beginner",
    );
    fireEvent.click(difficultyOption);
    const submitButton = screen.getByText("studio.plan.next_button");
    fireEvent.click(submitButton);
    await waitFor(() => {
      expect(titleInput).toHaveValue("Test Plan");
      expect(descriptionTextarea).toHaveValue("Test Plan Description");
      expect(daysInput).toHaveValue(30);
      expect(submitButton).toBeInTheDocument();
    });
  });

  it("shows navigation dialog when blocker state is blocked", async () => {
    const mockBlocker = {
      state: "blocked" as const,
      proceed: vi.fn(),
      reset: vi.fn(),
      location: {} as any,
    };
    vi.mocked(useBlocker).mockReturnValue(mockBlocker);
    renderWithProviders(<CreatePlan />);
    await waitFor(() => {
      expect(
        screen.getByText("studio.plan.navigation.confirm_title"),
      ).toBeInTheDocument();
    });
  });

  it("handles navigation confirmation", async () => {
    const mockBlocker = {
      state: "blocked" as const,
      proceed: vi.fn(),
      reset: vi.fn(),
      location: {} as any,
    };
    vi.mocked(useBlocker).mockReturnValue(mockBlocker);
    renderWithProviders(<CreatePlan />);
    await waitFor(() => {
      expect(
        screen.getByText("studio.plan.navigation.confirm_title"),
      ).toBeInTheDocument();
    });
    const confirmButton = screen.getByText("studio.plan.navigation.leave");
    fireEvent.click(confirmButton);
    expect(mockBlocker.proceed).toHaveBeenCalled();
  });

  it("fetches and populates form in edit mode", async () => {
    vi.mocked(useParams).mockReturnValue({ planId: "plan-123" });

    renderWithProviders(<CreatePlan />);

    await waitFor(() => {
      expect(
        screen.getByPlaceholderText("studio.plan.form.placeholder.title"),
      ).toHaveValue("Existing Plan");
    });

    expect(
      screen.getByPlaceholderText("studio.plan.form.placeholder.description"),
    ).toHaveValue("Existing description");

    expect(
      screen.getByPlaceholderText(
        "studio.plan.form.placeholder.number_of_days",
      ),
    ).toHaveValue(14);

    expect(
      screen.getByAltText("studio.plan.image.cover_preview_alt"),
    ).toBeInTheDocument();
  });

  it("handles navigation cancellation", async () => {
    const mockBlocker = {
      state: "blocked" as const,
      proceed: vi.fn(),
      reset: vi.fn(),
      location: {} as any,
    };
    vi.mocked(useBlocker).mockReturnValue(mockBlocker);
    renderWithProviders(<CreatePlan />);
    await waitFor(() => {
      expect(
        screen.getByText("studio.plan.navigation.confirm_title"),
      ).toBeInTheDocument();
    });
    const cancelButtons = screen.getAllByText("common.button.cancel");
    const dialogCancelButton = cancelButtons.find((btn) =>
      btn.closest('[role="dialog"]'),
    );
    fireEvent.click(dialogCancelButton!);
    expect(mockBlocker.reset).toHaveBeenCalled();
  });

  it("submits update in edit mode", async () => {
    vi.mocked(useParams).mockReturnValue({ planId: "plan-123" });
    vi.spyOn(axiosInstance, "put").mockResolvedValue({ data: {} });
    renderWithProviders(<CreatePlan />);

    await waitFor(() => {
      expect(
        screen.getByPlaceholderText("studio.plan.form.placeholder.title"),
      ).toHaveValue("Existing Plan");
    });

    fireEvent.change(
      screen.getByPlaceholderText("studio.plan.form.placeholder.title"),
      { target: { value: "Updated Plan" } },
    );

    const submitButton = screen.getByText("studio.plan.update_button");
    await act(async () => {
      fireEvent.click(submitButton);
    });

    await waitFor(() => {
      expect(axiosInstance.put).toHaveBeenCalledWith(
        "/api/v1/cms/plans/plan-123",
        expect.objectContaining({ title: "Updated Plan" }),
      );
    });
  });

  it("clears start_date when switching from specific to enroll mode on submit", async () => {
    vi.mocked(useParams).mockReturnValue({ planId: "plan-123" });
    const putSpy = vi
      .spyOn(axiosInstance, "put")
      .mockResolvedValue({ data: {} });

    renderWithProviders(<CreatePlan />);

    await waitFor(() => {
      expect(
        screen.getByPlaceholderText("studio.plan.form.placeholder.title"),
      ).toHaveValue("Existing Plan");
    });

    const enrollRadio = screen.getByLabelText(
      "studio.plan.start_date.when_user_enrolls",
    );
    await act(async () => {
      fireEvent.click(enrollRadio);
    });

    await act(async () => {
      fireEvent.click(screen.getByText("studio.plan.update_button"));
    });

    await waitFor(() => {
      expect(putSpy).toHaveBeenCalledWith(
        "/api/v1/cms/plans/plan-123",
        expect.objectContaining({ start_date: null }),
      );
    });
  });

  describe("create plan from series details", () => {
    beforeEach(() => {
      vi.spyOn(axiosInstance, "get").mockImplementation((url: string) => {
        if (url.includes("/api/v1/cms/series")) {
          return Promise.resolve({
            data: {
              series: [
                {
                  id: "series-1",
                  metadata: [{ title: "Abhidhamma in a year", language: "EN" }],
                },
              ],
            },
          });
        }
        if (url.includes("/cms/tags")) {
          return Promise.resolve({
            data: {
              tags: [],
              skip: 0,
              limit: 500,
              total: 0,
            },
          });
        }
        return Promise.resolve({ data: {} });
      });
    });

    it("pre-fills and locks series and language when location state is valid", async () => {
      vi.mocked(useLocation).mockReturnValue({
        pathname: "/plan/new",
        search: "",
        hash: "",
        state: { seriesId: "series-1", language: "EN" },
        key: "default",
      });

      renderWithProviders(<CreatePlan />);

      await waitFor(() => {
        expect(
          screen.getByRole("heading", {
            name: "studio.plan.heading.add_for_series_language",
          }),
        ).toBeInTheDocument();
        expect(screen.getByText("Abhidhamma in a year")).toBeInTheDocument();
      });

      const seriesField = screen
        .getByText("studio.plan.form_field.series")
        .closest('[data-slot="form-item"]');
      expect(seriesField).not.toBeNull();
      expect(
        within(seriesField as HTMLElement).getByRole("combobox", {
          hidden: true,
        }),
      ).toBeDisabled();

      const languageField = screen
        .getByText("studio.plan.form_field.language")
        .closest('[data-slot="form-item"]');
      expect(languageField).not.toBeNull();
      const languageSelect = within(languageField as HTMLElement).getByRole(
        "combobox",
        { hidden: true },
      );
      expect(languageSelect).toBeDisabled();
      expect(languageSelect).toHaveTextContent("English");
    });

    it("falls back to normal form when series id is not in the list", async () => {
      vi.mocked(useLocation).mockReturnValue({
        pathname: "/plan/new",
        search: "",
        hash: "",
        state: { seriesId: "missing-series", language: "EN" },
        key: "default",
      });

      renderWithProviders(<CreatePlan />);

      await waitFor(() => {
        const seriesField = screen
          .getByText("studio.plan.form_field.series")
          .closest('[data-slot="form-item"]');
        expect(seriesField).not.toBeNull();
        const seriesCombobox = within(seriesField as HTMLElement).getByRole(
          "combobox",
          { hidden: true },
        );
        expect(seriesCombobox).toHaveTextContent("studio.common.none");
        expect(seriesCombobox).not.toBeDisabled();
      });
    });
  });
});
