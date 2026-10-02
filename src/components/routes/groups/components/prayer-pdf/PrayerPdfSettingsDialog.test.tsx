import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import PrayerPdfSettingsDialog from "./PrayerPdfSettingsDialog";
import {
  ZABTIK_DROLCHOK_TEMPLATE,
  fetchPrayerPdfSettings,
  resetPrayerPdfSettings,
  updatePrayerPdfSettings,
  type PrayerPdfScope,
  type PrayerPdfSettings,
} from "../../api/prayerPdfApi";

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

vi.mock("../../api/prayerPdfApi", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../api/prayerPdfApi")>();
  return {
    ...actual,
    fetchPrayerPdfSettings: vi.fn(),
    updatePrayerPdfSettings: vi.fn(),
    resetPrayerPdfSettings: vi.fn(),
  };
});

const settings = (
  overrides: Partial<PrayerPdfSettings> = {},
): PrayerPdfSettings => ({
  group_id: "g1",
  event_id: "e1",
  source: "GROUP",
  title_bo: "སྐྱབས་ཞུ།",
  title: "Prayer Requests",
  title_zh: "迴向祈願名單",
  subtitle_bo: null,
  subtitle: "Prayer requests received during Sangha",
  subtitle_zh: null,
  day_one: null,
  closing_bo: null,
  closing_mantra: null,
  closing_zh: null,
  closing_en: "May all beings have happiness.",
  closing_emoji: "🙏🙏🙏",
  skip_messages: "no sound la\nno video la",
  timezone: "Asia/Kolkata",
  page_size: "A3",
  columns: 5,
  primary_color: "#7a1f1f",
  secondary_color: "#b8872b",
  updated_at: null,
  updated_by: null,
  ...overrides,
});

const eventScope: PrayerPdfScope = { kind: "event", eventId: "e1" };

const renderDialog = (scope: PrayerPdfScope = eventScope) => {
  const onOpenChange = vi.fn();
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <PrayerPdfSettingsDialog scope={scope} open onOpenChange={onOpenChange} />
    </QueryClientProvider>,
  );
  return { onOpenChange };
};

describe("PrayerPdfSettingsDialog", () => {
  beforeEach(() => {
    vi.mocked(fetchPrayerPdfSettings).mockReset();
    vi.mocked(updatePrayerPdfSettings).mockReset();
    vi.mocked(resetPrayerPdfSettings).mockReset();
    vi.mocked(toast.error).mockReset();
  });

  it("shows inherited group settings for an event", async () => {
    vi.mocked(fetchPrayerPdfSettings).mockResolvedValue(settings());
    renderDialog();

    expect(await screen.findByDisplayValue("Prayer Requests")).toBeTruthy();
    expect(screen.getByDisplayValue("迴向祈願名單")).toBeTruthy();
    expect(screen.getByText(/Using the group's PDF settings/)).toBeTruthy();
    // Nothing of its own to reset yet.
    expect(
      screen.queryByRole("button", { name: "Use group settings" }),
    ).toBeNull();
  });

  it("saves trimmed values, blanking emptied text to null", async () => {
    const user = userEvent.setup();
    vi.mocked(fetchPrayerPdfSettings).mockResolvedValue(settings());
    vi.mocked(updatePrayerPdfSettings).mockResolvedValue(
      settings({ source: "EVENT" }),
    );
    const { onOpenChange } = renderDialog();

    await user.clear(await screen.findByLabelText("Chinese title"));
    await user.type(screen.getByLabelText("Mantra"), "  ཨོཾ་ཏཱ་རེ།  ");
    await user.type(screen.getByLabelText("Day 1 date"), "2026-09-25");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(updatePrayerPdfSettings).toHaveBeenCalled());
    const [scope, payload] = vi.mocked(updatePrayerPdfSettings).mock.calls[0];
    expect(scope).toEqual(eventScope);
    expect(payload.title_zh).toBeNull();
    expect(payload.closing_mantra).toBe("ཨོཾ་ཏཱ་རེ།");
    expect(payload.day_one).toBe("2026-09-25");
    expect(payload.title).toBe("Prayer Requests");
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it("fills the Zabtik Drolchok text", async () => {
    const user = userEvent.setup();
    vi.mocked(fetchPrayerPdfSettings).mockResolvedValue(settings());
    vi.mocked(updatePrayerPdfSettings).mockResolvedValue(
      settings({ source: "EVENT" }),
    );
    renderDialog();

    await user.click(
      await screen.findByRole("button", { name: "Fill Zabtik Drolchok text" }),
    );
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(updatePrayerPdfSettings).toHaveBeenCalled());
    const [, payload] = vi.mocked(updatePrayerPdfSettings).mock.calls[0];
    expect(payload).toMatchObject(ZABTIK_DROLCHOK_TEMPLATE);
    expect(payload.closing_en).toContain("Noble Arya Tara");
  });

  it("rejects a malformed color", async () => {
    const user = userEvent.setup();
    vi.mocked(fetchPrayerPdfSettings).mockResolvedValue(settings());
    renderDialog();

    const color = await screen.findByLabelText("Accent color");
    await user.clear(color);
    await user.type(color, "gold");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(toast.error).toHaveBeenCalledWith(
      "Accent color must be a hex color like #7a1f1f",
    );
    expect(updatePrayerPdfSettings).not.toHaveBeenCalled();
  });

  it("lets an event with its own settings go back to the group's", async () => {
    const user = userEvent.setup();
    const inherited = settings({ source: "GROUP", title: "Group title" });
    // First load has the event's own row; the refetch after reset does not.
    vi.mocked(fetchPrayerPdfSettings)
      .mockResolvedValueOnce(settings({ source: "EVENT" }))
      .mockResolvedValue(inherited);
    vi.mocked(resetPrayerPdfSettings).mockResolvedValue(inherited);
    renderDialog();

    await user.click(
      await screen.findByRole("button", { name: "Use group settings" }),
    );

    await waitFor(() =>
      expect(resetPrayerPdfSettings).toHaveBeenCalledWith(eventScope),
    );
    expect(await screen.findByDisplayValue("Group title")).toBeTruthy();
  });

  it("offers a group reset to the defaults", async () => {
    vi.mocked(fetchPrayerPdfSettings).mockResolvedValue(
      settings({ source: "GROUP", event_id: null }),
    );
    renderDialog({ kind: "group", groupId: "g1" });

    expect(
      await screen.findByRole("button", { name: "Reset to defaults" }),
    ).toBeTruthy();
    expect(
      screen.getByText("Events without their own settings use these too."),
    ).toBeTruthy();
  });
});
