import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Outlet, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import GroupAboutEditPage from "./GroupAboutEditPage";
import {
  languageLabelForCode,
  patchGroup,
  type AuthorGroupDetailDTO,
} from "./api/groupsApi";

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

// Tags and social links have their own saves; they are not what is tested here.
vi.mock("./components/GroupFormAssociationsPanel", () => ({
  default: () => null,
}));

vi.mock("./api/groupsApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./api/groupsApi")>();
  return {
    ...actual,
    patchGroup: vi.fn(),
    replaceGroupTags: vi.fn(),
    replaceGroupSocialLinks: vi.fn(),
  };
});

const group = (metadata: AuthorGroupDetailDTO["metadata"]) =>
  ({
    id: "g1",
    slug: "dharma-circle_4821",
    group_type: "COMMUNITY",
    is_public: true,
    metadata,
    tags: [],
    social_links: [],
    members: [],
  }) as unknown as AuthorGroupDetailDTO;

const renderPage = (detail: AuthorGroupDetailDTO) => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const context = {
    group: detail,
    groupId: "g1",
    myRole: "OWNER",
    readOnlyPlatform: false,
  };
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <Routes>
          <Route element={<Outlet context={context} />}>
            <Route index element={<GroupAboutEditPage />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

const EN = languageLabelForCode("EN");
const BO = languageLabelForCode("BO");

const lastMetadata = () =>
  vi.mocked(patchGroup).mock.calls.at(-1)?.[1].metadata;

describe("GroupAboutEditPage (edit) language tabs", () => {
  beforeEach(() => {
    vi.mocked(patchGroup).mockReset();
    vi.mocked(patchGroup).mockResolvedValue({} as never);
  });

  it("shows each saved language as a tab with Add language last", async () => {
    renderPage(
      group([
        { language: "BO", title: "Chos Tshogs" },
        { language: "EN", title: "Dharma Circle" },
      ]),
    );
    await screen.findByDisplayValue("Dharma Circle");
    const names = screen.getAllByRole("tab").map((tab) => tab.textContent?.trim());
    // Tabs follow the order the group's languages were saved in.
    expect(names).toEqual([BO, EN, "Add language"]);
  });

  it("opens a title-only group with the other fields empty and optional", async () => {
    renderPage(group([{ language: "EN", title: "Dharma Circle" }]));
    await screen.findByDisplayValue("Dharma Circle");
    expect(screen.getByLabelText(new RegExp(`${EN} sub-title`))).toHaveValue("");
    expect(screen.getByLabelText(new RegExp(`${EN} description`))).toHaveValue("");
    expect(screen.getByText(new RegExp(`${EN} sub-title`)).textContent).toContain(
      "(optional)",
    );
  });

  it("saves a cleared sub-title and description as empty", async () => {
    renderPage(
      group([
        {
          language: "EN",
          title: "Dharma Circle",
          sub_title: "Weekly sitting",
          description: "We sit together.",
        },
      ]),
    );
    await screen.findByDisplayValue("Weekly sitting");

    await userEvent.clear(screen.getByLabelText(new RegExp(`${EN} sub-title`)));
    await userEvent.clear(screen.getByLabelText(new RegExp(`${EN} description`)));

    await waitFor(() => expect(patchGroup).toHaveBeenCalled(), { timeout: 4000 });
    expect(lastMetadata()).toEqual([
      {
        language: "EN",
        title: "Dharma Circle",
        sub_title: null,
        description: null,
        description_long: null,
      },
    ]);
  });

  it("adds a language with only a title and saves it", async () => {
    renderPage(group([{ language: "EN", title: "Dharma Circle" }]));
    await screen.findByDisplayValue("Dharma Circle");

    await userEvent.click(screen.getByRole("tab", { name: /add language/i }));
    await userEvent.click(screen.getByRole("button", { name: "Tibetan" }));
    await userEvent.type(screen.getByLabelText(new RegExp(`${BO} title`)), "Chos Tshogs");

    await waitFor(
      () =>
        expect(lastMetadata()?.map((m) => [m.language, m.title])).toEqual([
          ["EN", "Dharma Circle"],
          ["BO", "Chos Tshogs"],
        ]),
      { timeout: 4000 },
    );
    expect(lastMetadata()?.[1]).toMatchObject({
      sub_title: null,
      description: null,
      description_long: null,
    });
  });

  it("does not save a language that has no title yet", async () => {
    renderPage(group([{ language: "EN", title: "Dharma Circle" }]));
    await screen.findByDisplayValue("Dharma Circle");

    await userEvent.click(screen.getByRole("tab", { name: /add language/i }));
    await userEvent.click(screen.getByRole("button", { name: "Tibetan" }));
    await new Promise((resolve) => setTimeout(resolve, 1500));

    expect(patchGroup).not.toHaveBeenCalled();
    expect(await screen.findByText("Title is required")).toBeInTheDocument();
    expect(
      screen
        .getByRole("tab", { name: new RegExp(BO) })
        .querySelector('[aria-label="has errors"]'),
    ).not.toBeNull();
  });
});
