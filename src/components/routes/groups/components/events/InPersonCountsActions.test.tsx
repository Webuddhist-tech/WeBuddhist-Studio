import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import InPersonCountsActions from "./InPersonCountsActions";
import {
  createInPersonCount,
  deleteInPersonCount,
  fetchInPersonCounts,
  updateInPersonCount,
  type InPersonCountList,
} from "../../api/inPersonCountsApi";

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

// Like the global mock, but keeps interpolated values visible so tests can
// check the numbers and days a message names.
vi.mock("@tolgee/react", () => ({
  useTranslate: () => ({
    t: (key: string, params?: Record<string, unknown>) =>
      params ? [key, ...Object.values(params)].join(" ") : key,
  }),
}));

vi.mock("../../api/inPersonCountsApi", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../api/inPersonCountsApi")>();
  return {
    ...actual,
    fetchInPersonCounts: vi.fn(),
    createInPersonCount: vi.fn(),
    updateInPersonCount: vi.fn(),
    deleteInPersonCount: vi.fn(),
  };
});

const list = (
  overrides: Partial<InPersonCountList> = {},
): InPersonCountList => ({
  items: [
    {
      id: "h1",
      day: "2026-10-01",
      count: 1080,
      created_at: "2026-10-01T06:30:00Z",
      updated_at: null,
    },
  ],
  total: 1,
  skip: 0,
  limit: 10,
  total_count: 1080,
  group_accumulator_id: "ga1",
  group_accumulator_title: "Om Mani Padme Hum for World Peace",
  group_accumulator_total_count: 1234567,
  group_accumulator_target_count: 100000000,
  timezone: "Asia/Kolkata",
  ...overrides,
});

const renderActions = () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <InPersonCountsActions eventId="e1" />
    </QueryClientProvider>,
  );
};

const renderSection = async () => {
  renderActions();
  await userEvent.click(
    screen.getByRole("button", {
      name: "studio.groups.events.in_person.open_button",
    }),
  );
};

describe("InPersonCountsActions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fetchInPersonCounts).mockResolvedValue(list());
  });

  it("loads nothing until the Add In-person count button is clicked", () => {
    renderActions();
    expect(
      screen.getByRole("button", {
        name: "studio.groups.events.in_person.open_button",
      }),
    ).toBeTruthy();
    expect(fetchInPersonCounts).not.toHaveBeenCalled();
  });

  it("lists each day's in-person count with the total", async () => {
    await renderSection();
    expect(
      await screen.findByText((1080).toLocaleString(), { selector: "p" }),
    ).toBeTruthy();
    expect(screen.queryByText(/in person over/)).toBeNull();
    expect(fetchInPersonCounts).toHaveBeenCalledWith("e1", {
      skip: 0,
      limit: 10,
    });
  });

  it("names the group accumulation the counts go to", async () => {
    await renderSection();
    expect(
      screen.getByText("studio.groups.events.in_person.sheet_title"),
    ).toBeTruthy();
    expect(
      await screen.findByText("Om Mani Padme Hum for World Peace"),
    ).toBeTruthy();
    expect(screen.getByText((1234567).toLocaleString())).toBeTruthy();
    expect(screen.getByText(/of_target 100,000,000/)).toBeTruthy();
    expect(screen.getByText("1.2%")).toBeTruthy();
    const bar = screen.getByRole("progressbar");
    expect(bar.getAttribute("aria-valuenow")).toBe("1234567");
    expect(bar.getAttribute("aria-valuemax")).toBe("100000000");
    // App and in-person shares of the target.
    const [app, inPerson] = Array.from(bar.children) as HTMLElement[];
    expect(app.style.width).toBe("1.233487%");
    expect(inPerson.style.width).toBe("0.75%");
    expect(screen.getByText((1233487).toLocaleString())).toBeTruthy();
  });

  it("shows the accumulation's image, falling back to an icon", async () => {
    vi.mocked(fetchInPersonCounts).mockResolvedValue(
      list({
        group_accumulator_image: {
          thumbnail: "https://img/t.jpg",
          medium: "https://img/m.jpg",
          original: "https://img/o.jpg",
        },
      }),
    );
    await renderSection();
    await screen.findByText("Om Mani Padme Hum for World Peace");
    const image = document.querySelector('img[src="https://img/m.jpg"]');
    expect(image).toBeTruthy();
    fireEvent.error(image!);
    expect(document.querySelector('img[src="https://img/m.jpg"]')).toBeNull();
  });

  it("adds a day", async () => {
    vi.mocked(createInPersonCount).mockResolvedValue(list().items[0]);
    await renderSection();
    await screen.findByText("Om Mani Padme Hum for World Peace");

    await userEvent.click(
      screen.getByRole("button", {
        name: "studio.groups.events.in_person.add_day",
      }),
    );
    fireEvent.change(
      screen.getByLabelText("studio.groups.events.in_person.day"),
      {
        target: { value: "2026-10-02" },
      },
    );
    fireEvent.change(
      screen.getByLabelText("studio.groups.events.in_person.count"),
      {
        target: { value: "540" },
      },
    );
    await userEvent.click(
      screen.getByRole("button", { name: "studio.common.save" }),
    );

    await waitFor(() =>
      expect(createInPersonCount).toHaveBeenCalledWith("e1", {
        day: "2026-10-02",
        count: 540,
      }),
    );
  });

  it("does not save a count below 1", async () => {
    await renderSection();
    await screen.findByText("Om Mani Padme Hum for World Peace");

    await userEvent.click(
      screen.getByRole("button", {
        name: "studio.groups.events.in_person.add_day",
      }),
    );
    fireEvent.change(
      screen.getByLabelText("studio.groups.events.in_person.count"),
      {
        target: { value: "0" },
      },
    );
    await userEvent.click(
      screen.getByRole("button", { name: "studio.common.save" }),
    );

    expect(createInPersonCount).not.toHaveBeenCalled();
  });

  it("edits a day's count", async () => {
    vi.mocked(updateInPersonCount).mockResolvedValue(list().items[0]);
    await renderSection();

    await userEvent.click(
      await screen.findByRole("button", {
        name: "studio.groups.events.in_person.edit_aria 2026-10-01",
      }),
    );
    fireEvent.change(
      screen.getByLabelText("studio.groups.events.in_person.count"),
      {
        target: { value: "2000" },
      },
    );
    await userEvent.click(
      screen.getByRole("button", { name: "studio.common.save" }),
    );

    await waitFor(() =>
      expect(updateInPersonCount).toHaveBeenCalledWith("e1", "h1", {
        day: "2026-10-01",
        count: 2000,
      }),
    );
  });

  it("deletes a day after confirming", async () => {
    vi.mocked(deleteInPersonCount).mockResolvedValue();
    await renderSection();

    await userEvent.click(
      await screen.findByRole("button", {
        name: "studio.groups.events.in_person.delete_aria 2026-10-01",
      }),
    );
    await userEvent.click(
      await screen.findByRole("button", { name: "studio.common.delete" }),
    );

    await waitFor(() =>
      expect(deleteInPersonCount).toHaveBeenCalledWith("e1", "h1"),
    );
  });

  it("asks for a linked group accumulation", async () => {
    vi.mocked(fetchInPersonCounts).mockResolvedValue(
      list({ items: [], total: 0, group_accumulator_id: null }),
    );
    await renderSection();
    expect(
      await screen.findByText("studio.groups.events.in_person.no_accumulation"),
    ).toBeTruthy();
    expect(
      screen.queryByRole("button", {
        name: "studio.groups.events.in_person.add_day",
      }),
    ).toBeNull();
  });
});
