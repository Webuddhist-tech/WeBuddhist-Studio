import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import EventLiveSyncDialog from "./EventLiveSyncDialog";
import {
  deleteYoutubeLiveSync,
  runYoutubeLiveSyncNow,
  saveYoutubeLiveSync,
  type YoutubeLiveSyncList,
} from "../../api/youtubeLiveSyncApi";
import type { EventDTO } from "../../api/eventsApi";

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

vi.mock("../../api/youtubeLiveSyncApi", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../api/youtubeLiveSyncApi")>();
  return {
    ...actual,
    saveYoutubeLiveSync: vi.fn(),
    runYoutubeLiveSyncNow: vi.fn(),
    deleteYoutubeLiveSync: vi.fn(),
  };
});

const event = (id: string, name: string, extra: Partial<EventDTO> = {}) =>
  ({
    id,
    group_id: "g1",
    metadata: [{ id: `m-${id}`, name, language: "EN" }],
    ...extra,
  }) as unknown as EventDTO;

const liveSync = (
  overrides: Partial<YoutubeLiveSyncList> = {},
): YoutubeLiveSyncList => ({
  group_id: "g1",
  channel_url: "https://www.youtube.com/@group",
  schedules: [],
  ...overrides,
});

const renderDialog = (
  events: EventDTO[],
  sync: YoutubeLiveSyncList | undefined = liveSync(),
  onOpenChange = vi.fn(),
) => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <EventLiveSyncDialog
        open
        onOpenChange={onOpenChange}
        groupId="g1"
        events={events}
        liveSync={sync}
      />
    </QueryClientProvider>,
  );
  return onOpenChange;
};

const setFirstTime = (value: string) =>
  fireEvent.change(screen.getByLabelText("Time 1"), { target: { value } });

describe("EventLiveSyncDialog", () => {
  beforeEach(() => {
    vi.mocked(saveYoutubeLiveSync).mockReset();
    vi.mocked(runYoutubeLiveSyncNow).mockReset();
    vi.mocked(deleteYoutubeLiveSync).mockReset();
  });

  it("lists the chosen events", () => {
    renderDialog([event("e1", "Teaching"), event("e2", "Retreat")]);
    expect(screen.getByText("Events (2)")).toBeInTheDocument();
    expect(screen.getByText("Teaching")).toBeInTheDocument();
    expect(screen.getByText("Retreat")).toBeInTheDocument();
  });

  it("saves the times for exactly the chosen events", async () => {
    vi.mocked(saveYoutubeLiveSync).mockResolvedValue(liveSync());
    const onOpenChange = renderDialog([event("e1", "Teaching"), event("e2", "Retreat")]);

    setFirstTime("08:30");
    await userEvent.click(screen.getByRole("button", { name: /add time/i }));
    fireEvent.change(screen.getByLabelText("Time 2"), { target: { value: "14:00" } });
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(saveYoutubeLiveSync).toHaveBeenCalledWith("g1", {
        event_ids: ["e1", "e2"],
        enabled: true,
        run_times: ["08:30", "14:00"],
        timezone: "Asia/Kolkata",
      }),
    );
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it("will not save an enabled schedule with no time", () => {
    renderDialog([event("e1", "Teaching")]);
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    expect(screen.getByText(/add at least one time/i)).toBeInTheDocument();
    setFirstTime("08:30");
    expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();
  });

  it("starts from the schedule the event already has", () => {
    renderDialog(
      [event("e1", "Teaching")],
      liveSync({
        schedules: [
          {
            event_id: "e1",
            enabled: false,
            run_times: ["06:15"],
            timezone: "UTC",
          },
        ],
      }),
    );
    expect(screen.getByLabelText("Time 1")).toHaveValue("06:15");
    expect(screen.getByRole("button", { name: /remove schedule/i })).toBeInTheDocument();
  });

  it("runs now only for the chosen events", async () => {
    vi.mocked(runYoutubeLiveSyncNow).mockResolvedValue({
      live_streams_found: 1,
      events_checked: 1,
      links_added: 1,
      skipped_unknown_language: 0,
    });
    renderDialog([event("e1", "Teaching")]);
    await userEvent.click(screen.getByRole("button", { name: /run now/i }));
    await waitFor(() =>
      expect(runYoutubeLiveSyncNow).toHaveBeenCalledWith("g1", ["e1"]),
    );
  });

  it("removes the schedule only from chosen events that have one", async () => {
    vi.mocked(deleteYoutubeLiveSync).mockResolvedValue(undefined);
    renderDialog(
      [event("e1", "Teaching"), event("e2", "Retreat")],
      liveSync({
        schedules: [
          { event_id: "e1", enabled: true, run_times: ["08:30"], timezone: "UTC" },
        ],
      }),
    );
    await userEvent.click(screen.getByRole("button", { name: /remove schedule/i }));
    await waitFor(() => expect(deleteYoutubeLiveSync).toHaveBeenCalledTimes(1));
    expect(deleteYoutubeLiveSync).toHaveBeenCalledWith("g1", "e1");
  });

  it("warns and blocks Run now when the group has no channel link", () => {
    renderDialog([event("e1", "Teaching")], liveSync({ channel_url: null }));
    expect(screen.getByText(/no youtube channel link/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /run now/i })).toBeDisabled();
  });

  it("tells the admin a recurring event keeps the link for the series", () => {
    renderDialog([event("e1", "Weekly", { is_recurring: true })]);
    expect(screen.getByText(/stays on every date of the series/i)).toBeInTheDocument();
  });
});
