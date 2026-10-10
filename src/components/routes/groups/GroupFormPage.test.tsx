import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import GroupFormPage from "./GroupFormPage";
import { createGroup, languageLabelForCode } from "./api/groupsApi";

// Echoes keys plus interpolated values, so each language's labels stay distinct.
vi.mock("@tolgee/react", () => ({
  useTranslate: () => ({
    t: (key: string, params?: Record<string, unknown>) =>
      params ? `${key} ${Object.values(params).join(" ")}` : key,
  }),
  useTolgee: () => ({ getLanguage: () => "en", changeLanguage: vi.fn() }),
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

vi.mock("@/hooks/useLanguages", () => ({
  useLanguages: () => ({
    languageOptions: [
      { value: "EN", label: "English" },
      { value: "BO", label: "Tibetan" },
      { value: "ZH", label: "Chinese" },
    ],
  }),
}));

vi.mock("@/components/routes/traditions/api/traditionsApi", () => ({
  fetchTraditionOptions: vi.fn().mockResolvedValue([]),
}));

vi.mock("./api/groupsApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./api/groupsApi")>();
  return { ...actual, createGroup: vi.fn() };
});

const renderPage = () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <GroupFormPage groupType="COMMUNITY" />
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

/** A language tab's field label, e.g. `fieldLabel("title", "EN")`. */
const fieldLabel = (field: string, code: "EN" | "BO" | "ZH") =>
  new RegExp(`language_tabs\\.${field}_label ${languageLabelForCode(code)}`);

const titleField = (code: "EN" | "BO" | "ZH") =>
  screen.getByLabelText(fieldLabel("title", code));

const create = () =>
  userEvent.click(
    screen.getByRole("button", { name: /form\.create_community/ }),
  );

describe("GroupFormPage (create) language tabs", () => {
  beforeEach(() => {
    vi.mocked(createGroup).mockReset();
    vi.mocked(createGroup).mockResolvedValue({ id: "g1" } as never);
  });

  it("creates a group from a title alone", async () => {
    renderPage();
    await userEvent.type(titleField("EN"), "Dharma Circle");
    await create();

    await waitFor(() => expect(createGroup).toHaveBeenCalledTimes(1));
    expect(vi.mocked(createGroup).mock.calls[0][0].metadata).toEqual([
      {
        language: "EN",
        title: "Dharma Circle",
        sub_title: null,
        description: null,
        description_long: null,
      },
    ]);
  });

  it("does not create without a title", async () => {
    renderPage();
    await create();
    expect(
      await screen.findByText("studio.validation.title_required"),
    ).toBeInTheDocument();
    expect(createGroup).not.toHaveBeenCalled();
  });

  it("adds a second language from the last tab and needs only its title", async () => {
    renderPage();
    await userEvent.type(titleField("EN"), "Dharma Circle");

    const tabs = screen.getAllByRole("tab");
    expect(tabs.at(-1)).toHaveTextContent(
      "studio.groups.components.language_tabs.add_language",
    );
    await userEvent.click(tabs.at(-1) as HTMLElement);
    await userEvent.click(screen.getByRole("button", { name: "Tibetan" }));
    await userEvent.type(titleField("BO"), "Chos Tshogs");
    await create();

    await waitFor(() => expect(createGroup).toHaveBeenCalledTimes(1));
    expect(
      vi
        .mocked(createGroup)
        .mock.calls[0][0].metadata?.map((m) => [
          m.language,
          m.title,
          m.sub_title,
          m.description,
        ]),
    ).toEqual([
      ["EN", "Dharma Circle", null, null],
      ["BO", "Chos Tshogs", null, null],
    ]);
  });

  it("will not create when a second language has no title", async () => {
    renderPage();
    await userEvent.type(titleField("EN"), "Dharma Circle");
    await userEvent.click(
      screen.getByRole("tab", { name: /language_tabs\.add_language/ }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Tibetan" }));
    await create();

    expect(
      await screen.findByText("studio.validation.title_required"),
    ).toBeInTheDocument();
    expect(createGroup).not.toHaveBeenCalled();
    // The open tab is the one with the problem.
    expect(
      screen
        .getByRole("tab", { name: new RegExp(languageLabelForCode("BO")) })
        .getAttribute("aria-selected"),
    ).toBe("true");
  });
});
