import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { toast } from "sonner";
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

// Like the global mock, but keeps interpolated values visible so tests can
// check which events or counts a message names.
vi.mock("@tolgee/react", () => ({
  useTranslate: () => ({
    t: (key: string, params?: Record<string, unknown>) =>
      params ? [key, ...Object.values(params)].join(" ") : key,
  }),
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
  // null means "not loaded yet"; undefined would take the default.
  sync: YoutubeLiveSyncList | null = liveSync(),
  onOpenChange = vi.fn(),
  state: { isLoading?: boolean; isError?: boolean; onRetry?: () => void } = {},
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
        liveSync={sync ?? undefined}
        {...state}
      />
    </QueryClientProvider>,
  );
  return onOpenChange;
};

const setFirstTime = (value: string) =>
  fireEvent.change(
    screen.getByLabelText("studio.groups.events.live_sync.time_aria 1"),
    { target: { value } },
  );

describe("EventLiveSyncDialog", () => {
  beforeEach(() => {
    vi.mocked(saveYoutubeLiveSync).mockReset();
    vi.mocked(runYoutubeLiveSyncNow).mockReset();
    vi.mocked(deleteYoutubeLiveSync).mockReset();
    vi.mocked(toast.error).mockReset();
    vi.mocked(toast.success).mockReset();
  });

  it("lists the chosen events", () => {
    renderDialog([event("e1", "Teaching"), event("e2", "Retreat")]);
    expect(
      screen.getByText("studio.groups.events.live_sync.events_count 2"),
    ).toBeInTheDocument();
    expect(screen.getByText("Teaching")).toBeInTheDocument();
    expect(screen.getByText("Retreat")).toBeInTheDocument();
  });

  it("saves the times for exactly the chosen events", async () => {
    vi.mocked(saveYoutubeLiveSync).mockResolvedValue(liveSync());
    const onOpenChange = renderDialog([
      event("e1", "Teaching"),
      event("e2", "Retreat"),
    ]);

    setFirstTime("08:30");
    await userEvent.click(
      screen.getByRole("button", {
        name: "studio.groups.events.live_sync.add_time",
      }),
    );
    fireEvent.change(
      screen.getByLabelText("studio.groups.events.live_sync.time_aria 2"),
      { target: { value: "14:00" } },
    );
    await userEvent.click(
      screen.getByRole("button", { name: "studio.common.save" }),
    );

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
    expect(
      screen.getByRole("button", { name: "studio.common.save" }),
    ).toBeDisabled();
    expect(
      screen.getByText("studio.groups.events.live_sync.needs_time"),
    ).toBeInTheDocument();
    setFirstTime("08:30");
    expect(
      screen.getByRole("button", { name: "studio.common.save" }),
    ).toBeEnabled();
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
    expect(
      screen.getByLabelText("studio.groups.events.live_sync.time_aria 1"),
    ).toHaveValue("06:15");
    expect(
      screen.getByRole("button", {
        name: "studio.groups.events.live_sync.remove_schedule",
      }),
    ).toBeInTheDocument();
  });

  it("runs now only for the chosen events", async () => {
    vi.mocked(runYoutubeLiveSyncNow).mockResolvedValue({
      live_streams_found: 1,
      events_checked: 1,
      links_added: 1,
      skipped_unknown_language: 0,
    });
    renderDialog([event("e1", "Teaching")]);
    await userEvent.click(
      screen.getByRole("button", {
        name: "studio.groups.events.live_sync.run_now",
      }),
    );
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
          {
            event_id: "e1",
            enabled: true,
            run_times: ["08:30"],
            timezone: "UTC",
          },
        ],
      }),
    );
    await userEvent.click(
      screen.getByRole("button", {
        name: "studio.groups.events.live_sync.remove_schedule",
      }),
    );
    await waitFor(() => expect(deleteYoutubeLiveSync).toHaveBeenCalledTimes(1));
    expect(deleteYoutubeLiveSync).toHaveBeenCalledWith("g1", "e1");
  });

  it("warns and blocks Run now when the group has no channel link", () => {
    renderDialog([event("e1", "Teaching")], liveSync({ channel_url: null }));
    expect(
      screen.getByText("studio.groups.events.live_sync.no_channel"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: "studio.groups.events.live_sync.run_now",
      }),
    ).toBeDisabled();
  });

  it("tells the admin a recurring event keeps the link for the series", () => {
    renderDialog([event("e1", "Weekly", { is_recurring: true })]);
    expect(
      screen.getByText("studio.groups.events.live_sync.recurring_one"),
    ).toBeInTheDocument();
  });

  it("waits for the saved schedules instead of starting from defaults", () => {
    renderDialog([event("e1", "Teaching")], null, vi.fn(), { isLoading: true });
    expect(
      screen.getByText("studio.groups.events.live_sync.loading"),
    ).toBeInTheDocument();
    // No editable form, so nothing can be saved over a schedule not yet seen.
    expect(
      screen.queryByRole("button", { name: "studio.common.save" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText("studio.groups.events.live_sync.time_aria 1"),
    ).not.toBeInTheDocument();
  });

  it("offers a retry when the schedules could not be loaded", async () => {
    const onRetry = vi.fn();
    renderDialog([event("e1", "Teaching")], null, vi.fn(), {
      isError: true,
      onRetry,
    });
    expect(
      screen.getByText("studio.groups.events.live_sync.load_error"),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "studio.common.save" }),
    ).not.toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: "studio.common.retry" }),
    );
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("shows the form with the saved schedule once it has loaded", () => {
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
      vi.fn(),
      { isError: false },
    );
    expect(
      screen.getByLabelText("studio.groups.events.live_sync.time_aria 1"),
    ).toHaveValue("06:15");
  });

  it("keeps the dialog open and names the events whose removal failed", async () => {
    vi.mocked(deleteYoutubeLiveSync).mockImplementation(
      async (_group, eventId) => {
        if (eventId === "e2") throw new Error("boom");
      },
    );
    const onOpenChange = renderDialog(
      [event("e1", "Teaching"), event("e2", "Retreat")],
      liveSync({
        schedules: [
          {
            event_id: "e1",
            enabled: true,
            run_times: ["08:30"],
            timezone: "UTC",
          },
          {
            event_id: "e2",
            enabled: true,
            run_times: ["08:30"],
            timezone: "UTC",
          },
        ],
      }),
    );
    await userEvent.click(
      screen.getByRole("button", {
        name: "studio.groups.events.live_sync.remove_schedule",
      }),
    );

    // Both removals were attempted, not abandoned at the first failure.
    await waitFor(() => expect(deleteYoutubeLiveSync).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        expect.stringContaining("Retreat"),
      ),
    );
    expect(toast.error).toHaveBeenCalledWith(
      expect.not.stringContaining("Teaching"),
    );
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it("refreshes the schedules after a partly failed removal", async () => {
    vi.mocked(deleteYoutubeLiveSync).mockImplementation(
      async (_group, eventId) => {
        if (eventId === "e2") throw new Error("boom");
      },
    );
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const invalidate = vi.spyOn(client, "invalidateQueries");
    render(
      <QueryClientProvider client={client}>
        <EventLiveSyncDialog
          open
          onOpenChange={vi.fn()}
          groupId="g1"
          events={[event("e1", "Teaching"), event("e2", "Retreat")]}
          liveSync={liveSync({
            schedules: [
              {
                event_id: "e1",
                enabled: true,
                run_times: ["08:30"],
                timezone: "UTC",
              },
              {
                event_id: "e2",
                enabled: true,
                run_times: ["08:30"],
                timezone: "UTC",
              },
            ],
          })}
        />
      </QueryClientProvider>,
    );
    await userEvent.click(
      screen.getByRole("button", {
        name: "studio.groups.events.live_sync.remove_schedule",
      }),
    );
    await waitFor(() =>
      expect(invalidate).toHaveBeenCalledWith({
        queryKey: ["youtube-live-sync", "g1"],
      }),
    );
  });

  it("adds and removes time rows", async () => {
    renderDialog([event("e1", "Teaching")]);
    expect(
      screen.queryByLabelText(
        "studio.groups.events.live_sync.remove_time_aria 1",
      ),
    ).not.toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("button", {
        name: "studio.groups.events.live_sync.add_time",
      }),
    );
    expect(
      screen.getByLabelText("studio.groups.events.live_sync.time_aria 2"),
    ).toBeInTheDocument();

    await userEvent.click(
      screen.getByLabelText(
        "studio.groups.events.live_sync.remove_time_aria 2",
      ),
    );
    expect(
      screen.queryByLabelText("studio.groups.events.live_sync.time_aria 2"),
    ).not.toBeInTheDocument();
  });

  it("saves a paused schedule without needing a time", async () => {
    vi.mocked(saveYoutubeLiveSync).mockResolvedValue(liveSync());
    renderDialog([event("e1", "Teaching")]);

    await userEvent.click(
      screen.getByRole("checkbox", {
        name: "studio.groups.events.live_sync.enabled",
      }),
    );
    expect(
      screen.queryByText("studio.groups.events.live_sync.needs_time"),
    ).not.toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: "studio.common.save" }),
    );

    await waitFor(() =>
      expect(saveYoutubeLiveSync).toHaveBeenCalledWith("g1", {
        event_ids: ["e1"],
        enabled: false,
        run_times: [],
        timezone: "Asia/Kolkata",
      }),
    );
    expect(toast.success).toHaveBeenCalledWith(
      "studio.groups.events.live_sync.toast_paused_one 1",
    );
  });

  it("says what a run did and keeps the dialog open", async () => {
    vi.mocked(runYoutubeLiveSyncNow).mockResolvedValue({
      live_streams_found: 0,
      events_checked: 1,
      links_added: 0,
      skipped_unknown_language: 0,
    });
    const onOpenChange = renderDialog([event("e1", "Teaching")]);
    await userEvent.click(
      screen.getByRole("button", {
        name: "studio.groups.events.live_sync.run_now",
      }),
    );
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith(
        expect.stringMatching(/live_sync.none_live/),
      ),
    );
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it("reports a failed save and a failed run", async () => {
    vi.mocked(saveYoutubeLiveSync).mockRejectedValue(new Error("nope"));
    vi.mocked(runYoutubeLiveSyncNow).mockRejectedValue(new Error("nope"));
    renderDialog([event("e1", "Teaching")]);

    fireEvent.change(
      screen.getByLabelText("studio.groups.events.live_sync.time_aria 1"),
      {
        target: { value: "08:30" },
      },
    );
    await userEvent.click(
      screen.getByRole("button", { name: "studio.common.save" }),
    );
    await waitFor(() => expect(toast.error).toHaveBeenCalledTimes(1));

    await userEvent.click(
      screen.getByRole("button", {
        name: "studio.groups.events.live_sync.run_now",
      }),
    );
    await waitFor(() => expect(toast.error).toHaveBeenCalledTimes(2));
  });

  it("tells the admin that saving replaces several existing schedules", () => {
    renderDialog(
      [event("e1", "Teaching"), event("e2", "Retreat")],
      liveSync({
        schedules: [
          {
            event_id: "e1",
            enabled: true,
            run_times: ["08:30"],
            timezone: "UTC",
          },
          {
            event_id: "e2",
            enabled: true,
            run_times: ["09:00"],
            timezone: "UTC",
          },
        ],
      }),
    );
    expect(
      screen.getByText("studio.groups.events.live_sync.replaces_all 2"),
    ).toBeInTheDocument();
  });

  it("closes once every schedule is removed", async () => {
    vi.mocked(deleteYoutubeLiveSync).mockResolvedValue(undefined);
    const onOpenChange = renderDialog(
      [event("e1", "Teaching")],
      liveSync({
        schedules: [
          {
            event_id: "e1",
            enabled: true,
            run_times: ["08:30"],
            timezone: "UTC",
          },
        ],
      }),
    );
    await userEvent.click(
      screen.getByRole("button", {
        name: "studio.groups.events.live_sync.remove_schedule",
      }),
    );
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(toast.success).toHaveBeenCalledWith(
      "studio.groups.events.live_sync.removed",
    );
  });
});
