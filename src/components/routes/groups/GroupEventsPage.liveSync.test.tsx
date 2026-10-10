import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Outlet, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import GroupEventsPage from "./GroupEventsPage";
import { deleteCmsEvent, fetchCmsEvents, type EventDTO } from "./api/eventsApi";
import {
  fetchYoutubeLiveSync,
  type YoutubeLiveSyncList,
} from "./api/youtubeLiveSyncApi";

// Echoes keys plus interpolated values, so per-event labels stay distinct.
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

vi.mock("./api/eventsApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./api/eventsApi")>();
  return { ...actual, fetchCmsEvents: vi.fn(), deleteCmsEvent: vi.fn() };
});

vi.mock("./api/youtubeLiveSyncApi", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("./api/youtubeLiveSyncApi")>();
  return { ...actual, fetchYoutubeLiveSync: vi.fn() };
});

const event = (id: string, name: string) =>
  ({
    id,
    group_id: "g1",
    event_format: "online",
    start_date: "2026-10-09T03:00:00Z",
    end_date: "2026-10-09T05:00:00Z",
    is_one_day: true,
    featured: false,
    participant_count: 0,
    metadata: [{ id: `m-${id}`, name, language: "EN" }],
  }) as unknown as EventDTO;

const liveSync = (
  schedules: YoutubeLiveSyncList["schedules"] = [],
): YoutubeLiveSyncList => ({
  group_id: "g1",
  channel_url: "https://www.youtube.com/@group",
  schedules,
});

const renderPage = (
  overrides: Partial<{ myRole: string; readOnlyPlatform: boolean }> = {},
) => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const context = {
    groupId: "g1",
    myRole: "OWNER",
    userInfo: { id: "u1", platform_role: "CREATOR" },
    readOnlyPlatform: false,
    ...overrides,
  };
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <Routes>
          <Route element={<Outlet context={context} />}>
            <Route index element={<GroupEventsPage />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

describe("GroupEventsPage live sync", () => {
  beforeEach(() => {
    vi.mocked(fetchCmsEvents).mockReset();
    vi.mocked(deleteCmsEvent).mockReset();
    vi.mocked(fetchYoutubeLiveSync).mockReset();
    vi.mocked(fetchCmsEvents).mockResolvedValue({
      events: [event("e1", "Teaching"), event("e2", "Retreat")],
      total: 2,
      skip: 0,
      limit: 20,
    });
    vi.mocked(fetchYoutubeLiveSync).mockResolvedValue(liveSync());
  });

  it("shows each schedule's timezone beside its times", async () => {
    vi.mocked(fetchYoutubeLiveSync).mockResolvedValue(
      liveSync([
        {
          event_id: "e1",
          enabled: true,
          run_times: ["08:30"],
          timezone: "Asia/Kolkata",
        },
        {
          event_id: "e2",
          enabled: true,
          run_times: ["08:30"],
          timezone: "America/New_York",
        },
      ]),
    );
    renderPage();
    // Same clock time, different zones: they must not look alike.
    expect(
      await screen.findByText("8:30 AM (Asia/Kolkata)"),
    ).toBeInTheDocument();
    expect(screen.getByText("8:30 AM (America/New_York)")).toBeInTheDocument();
  });

  it("drops a deleted event from the live sync selection", async () => {
    vi.mocked(deleteCmsEvent).mockResolvedValue(undefined);
    renderPage();

    await userEvent.click(
      await screen.findByRole("checkbox", {
        name: /select_for_live_sync_aria Teaching/,
      }),
    );
    await userEvent.click(
      screen.getByRole("checkbox", {
        name: /select_for_live_sync_aria Retreat/,
      }),
    );
    expect(
      screen.getByRole("button", { name: /youtube_live_sync_count 2/ }),
    ).toBeInTheDocument();

    // After the delete the list no longer returns that event.
    vi.mocked(fetchCmsEvents).mockResolvedValue({
      events: [event("e2", "Retreat")],
      total: 1,
      skip: 0,
      limit: 20,
    });
    await userEvent.click(
      screen.getByRole("button", { name: /events\.delete_aria Teaching/ }),
    );
    const dialog = await screen.findByRole("alertdialog");
    await userEvent.click(
      within(dialog).getByRole("button", { name: "studio.common.delete" }),
    );

    await waitFor(() => expect(deleteCmsEvent).toHaveBeenCalledWith("e1"));
    // Only the surviving event is still counted.
    expect(
      await screen.findByRole("button", { name: /youtube_live_sync_count 1/ }),
    ).toBeInTheDocument();
  });

  it("selects and clears every event on the page", async () => {
    renderPage();
    await userEvent.click(
      await screen.findByRole("checkbox", {
        name: /select_all_aria/,
      }),
    );
    expect(
      screen.getByRole("button", { name: /youtube_live_sync_count 2/ }),
    ).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("button", { name: /clear_selection/ }),
    );
    expect(
      screen.getByRole("button", { name: /youtube_live_sync$/ }),
    ).toBeDisabled();
  });

  it("unticking the select-all box clears the page's selection", async () => {
    renderPage();
    const all = await screen.findByRole("checkbox", {
      name: /select_all_aria/,
    });
    await userEvent.click(all);
    await userEvent.click(all);
    expect(
      screen.getByRole("button", { name: /youtube_live_sync$/ }),
    ).toBeDisabled();
  });

  it("opens the schedule dialog for the ticked events", async () => {
    renderPage();
    await userEvent.click(
      await screen.findByRole("checkbox", {
        name: /select_for_live_sync_aria Teaching/,
      }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: /youtube_live_sync_count 1/ }),
    );
    const dialog = await screen.findByRole("dialog");
    expect(
      within(dialog).getByText("studio.groups.events.live_sync.events_count 1"),
    ).toBeInTheDocument();
    expect(within(dialog).getByText("Teaching")).toBeInTheDocument();
  });

  it("offers no live sync to a member who is not an owner or admin", async () => {
    renderPage({ myRole: "AUTHOR" });
    await screen.findByText("Teaching");
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /youtube_live_sync/ }),
    ).not.toBeInTheDocument();
  });

  it("offers no live sync on a read-only platform account", async () => {
    renderPage({ readOnlyPlatform: true });
    await screen.findByText("Teaching");
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  });

  it("shows a paused schedule and the error of its last run", async () => {
    vi.mocked(fetchYoutubeLiveSync).mockResolvedValue(
      liveSync([
        {
          event_id: "e1",
          enabled: false,
          run_times: ["14:00"],
          timezone: "UTC",
          last_run_error: "The group has no YouTube channel link",
        },
      ]),
    );
    renderPage();
    expect(
      await screen.findByText("studio.groups.pages.events.live_sync_paused"),
    ).toBeInTheDocument();
    expect(screen.getByText("2:00 PM (UTC)")).toBeInTheDocument();
    expect(
      screen.getByText(/last_run_failed The group has no YouTube channel link/),
    ).toBeInTheDocument();
  });

  it("shows no schedule for an event that has none", async () => {
    renderPage();
    await screen.findByText("Teaching");
    expect(
      screen.queryByText("studio.groups.pages.events.live_sync_on"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("studio.groups.pages.events.live_sync_paused"),
    ).not.toBeInTheDocument();
  });
});
