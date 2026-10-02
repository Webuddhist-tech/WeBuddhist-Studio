import type { ComponentProps } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import VerseOfDayForm from "./VerseOfDayForm";
import type { VerseOfDayItem } from "./api/verseOfDayApi";
import { createVerseOfDay, updateVerseOfDay } from "./api/verseOfDayApi";

const GROUP_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

vi.mock("@/hooks/useLanguages", () => ({
  useLanguages: () => ({
    languageOptions: [{ value: "EN", label: "English" }],
    getLanguageLabel: () => "English",
  }),
}));

vi.mock("@/components/routes/groups/api/groupsApi", async () => {
  const actual = await vi.importActual<
    typeof import("@/components/routes/groups/api/groupsApi")
  >("@/components/routes/groups/api/groupsApi");
  return {
    ...actual,
    fetchGroups: vi.fn(async () => ({
      groups: [
        {
          id: GROUP_ID,
          slug: "dhamma-group",
          is_public: true,
          metadata: [{ title: "Dhamma group", language: "EN" }],
          tags: [],
          follower_count: 0,
        },
      ],
      skip: 0,
      limit: 100,
      total: 1,
    })),
  };
});

vi.mock("./api/verseOfDayApi", async () => {
  const actual = await vi.importActual<typeof import("./api/verseOfDayApi")>(
    "./api/verseOfDayApi",
  );
  return {
    ...actual,
    createVerseOfDay: vi.fn(),
    updateVerseOfDay: vi.fn(),
  };
});

const existingVerse = (
  overrides: Partial<VerseOfDayItem> = {},
): VerseOfDayItem => ({
  id: "verse-1",
  verses: { en: "May all beings be happy." },
  verse: "May all beings be happy.",
  image_url: null,
  ref_id: "text-123",
  source: "Dhp 1.5",
  ref_type: "sutra",
  date: "2025-06-05",
  group_id: GROUP_ID,
  group_info: [],
  ...overrides,
});

const renderForm = (
  props: Partial<ComponentProps<typeof VerseOfDayForm>> = {},
) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const onSuccess = vi.fn();
  const onCancel = vi.fn();

  render(
    <QueryClientProvider client={queryClient}>
      <VerseOfDayForm
        mode="create"
        onSuccess={onSuccess}
        onCancel={onCancel}
        existingVerses={[]}
        {...props}
      />
    </QueryClientProvider>,
  );

  return { onSuccess, onCancel };
};

const fillRequiredCreateFields = async () => {
  await userEvent.type(
    screen.getByPlaceholderText(/enter verse content in english/i),
    "May all beings be happy.",
  );
  await userEvent.click(
    await screen.findByRole("combobox", { name: /select a group/i }),
  );
  await userEvent.click(await screen.findByText("Dhamma group"));
};

describe("VerseOfDayForm — source", () => {
  beforeEach(() => {
    vi.mocked(createVerseOfDay).mockReset();
    vi.mocked(updateVerseOfDay).mockReset();
    vi.mocked(createVerseOfDay).mockResolvedValue({} as never);
    vi.mocked(updateVerseOfDay).mockResolvedValue({} as never);
  });

  it("includes a trimmed source on create", async () => {
    renderForm();
    await fillRequiredCreateFields();
    await userEvent.type(
      screen.getByLabelText(/source \/ reference/i),
      "  Dhp 1.5  ",
    );

    await userEvent.click(screen.getByRole("button", { name: /^create$/i }));

    await waitFor(() => expect(createVerseOfDay).toHaveBeenCalledTimes(1));
    expect(createVerseOfDay).toHaveBeenCalledWith(
      expect.objectContaining({ source: "Dhp 1.5" }),
    );
  });

  it("sends null source on create when the field is empty", async () => {
    renderForm();
    await fillRequiredCreateFields();

    await userEvent.click(screen.getByRole("button", { name: /^create$/i }));

    await waitFor(() => expect(createVerseOfDay).toHaveBeenCalledTimes(1));
    expect(createVerseOfDay).toHaveBeenCalledWith(
      expect.objectContaining({ source: null }),
    );
  });

  it("pre-fills source in edit mode and omits it when unchanged", async () => {
    renderForm({
      mode: "edit",
      initialData: existingVerse(),
      existingVerses: [existingVerse()],
    });

    expect(screen.getByLabelText(/source \/ reference/i)).toHaveValue(
      "Dhp 1.5",
    );

    await userEvent.click(screen.getByRole("button", { name: /^update$/i }));

    await waitFor(() => expect(updateVerseOfDay).toHaveBeenCalledTimes(1));
    const [, payload] = vi.mocked(updateVerseOfDay).mock.calls[0];
    expect(payload).not.toHaveProperty("source");
  });

  it("sends the trimmed source on update when it changes", async () => {
    renderForm({
      mode: "edit",
      initialData: existingVerse(),
      existingVerses: [existingVerse()],
    });

    const sourceInput = screen.getByLabelText(/source \/ reference/i);
    await userEvent.clear(sourceInput);
    await userEvent.type(sourceInput, "  Dhp 2.1  ");
    await userEvent.click(screen.getByRole("button", { name: /^update$/i }));

    await waitFor(() => expect(updateVerseOfDay).toHaveBeenCalledTimes(1));
    expect(updateVerseOfDay).toHaveBeenCalledWith(
      "verse-1",
      expect.objectContaining({ source: "Dhp 2.1" }),
    );
  });

  it("sends null source on update when the field is cleared", async () => {
    renderForm({
      mode: "edit",
      initialData: existingVerse(),
      existingVerses: [existingVerse()],
    });

    await userEvent.clear(screen.getByLabelText(/source \/ reference/i));
    await userEvent.click(screen.getByRole("button", { name: /^update$/i }));

    await waitFor(() => expect(updateVerseOfDay).toHaveBeenCalledTimes(1));
    expect(updateVerseOfDay).toHaveBeenCalledWith(
      "verse-1",
      expect.objectContaining({ source: null }),
    );
  });
});
