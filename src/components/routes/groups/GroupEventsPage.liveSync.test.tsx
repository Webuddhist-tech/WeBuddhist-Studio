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

const renderPage = () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const context = {
    groupId: "g1",
    myRole: "OWNER",
    userInfo: { id: "u1", platform_role: "CREATOR" },
    readOnlyPlatform: false,
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
        { event_id: "e1", enabled: true, run_times: ["08:30"], timezone: "Asia/Kolkata" },
        { event_id: "e2", enabled: true, run_times: ["08:30"], timezone: "America/New_York" },
      ]),
    );
    renderPage();
    // Same clock time, different zones: they must not look alike.
    expect(await screen.findByText("8:30 AM (Asia/Kolkata)")).toBeInTheDocument();
    expect(screen.getByText("8:30 AM (America/New_York)")).toBeInTheDocument();
  });

  it("drops a deleted event from the live sync selection", async () => {
    vi.mocked(deleteCmsEvent).mockResolvedValue(undefined);
    renderPage();

    await userEvent.click(
      await screen.findByRole("checkbox", { name: /select teaching for live sync/i }),
    );
    await userEvent.click(
      screen.getByRole("checkbox", { name: /select retreat for live sync/i }),
    );
    expect(
      screen.getByRole("button", { name: /youtube live sync \(2\)/i }),
    ).toBeInTheDocument();

    // After the delete the list no longer returns that event.
    vi.mocked(fetchCmsEvents).mockResolvedValue({
      events: [event("e2", "Retreat")],
      total: 1,
      skip: 0,
      limit: 20,
    });
    await userEvent.click(screen.getByRole("button", { name: /delete teaching/i }));
    const dialog = await screen.findByRole("alertdialog");
    await userEvent.click(within(dialog).getByRole("button", { name: "Delete" }));

    await waitFor(() => expect(deleteCmsEvent).toHaveBeenCalledWith("e1"));
    // Only the surviving event is still counted.
    expect(
      await screen.findByRole("button", { name: /youtube live sync \(1\)/i }),
    ).toBeInTheDocument();
  });
});
