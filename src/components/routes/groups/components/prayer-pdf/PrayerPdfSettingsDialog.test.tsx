import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import PrayerPdfSettingsDialog from "./PrayerPdfSettingsDialog";
import {
  ZABTIK_DROLCHOK_TEMPLATE,
  fetchPrayerPdfSettings,
  previewPrayerPdf,
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
    previewPrayerPdf: vi.fn(),
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
  it("shows a live preview of the unsaved settings", async () => {
    const user = userEvent.setup();
    vi.mocked(fetchPrayerPdfSettings).mockResolvedValue(settings());
    renderDialog();

    expect(
      await screen.findByTitle("studio.groups.prayer_pdf.preview.frame_title"),
    ).toBeTruthy();
    expect(
      screen.getByText("studio.groups.prayer_pdf.preview.count_other"),
    ).toBeTruthy();

    const title = screen.getByLabelText("studio.common.title");
    await user.clear(title);
    await user.type(title, "Live title");

    await waitFor(
      () => {
        const calls = vi.mocked(previewPrayerPdf).mock.calls;
        expect(calls[calls.length - 1][1].title).toBe("Live title");
      },
      { timeout: 3000 },
    );
    expect(updatePrayerPdfSettings).not.toHaveBeenCalled();
  });

  beforeEach(() => {
    vi.mocked(fetchPrayerPdfSettings).mockReset();
    vi.mocked(updatePrayerPdfSettings).mockReset();
    vi.mocked(resetPrayerPdfSettings).mockReset();
    vi.mocked(toast.error).mockReset();
    vi.mocked(previewPrayerPdf).mockReset();
    vi.mocked(previewPrayerPdf).mockResolvedValue({
      html: "<html><head></head><body>preview</body></html>",
      day: "2026-10-01",
      prayer_count: 2,
      is_sample: false,
    });
  });

  it("shows inherited group settings for an event", async () => {
    vi.mocked(fetchPrayerPdfSettings).mockResolvedValue(settings());
    renderDialog();

    expect(await screen.findByDisplayValue("Prayer Requests")).toBeTruthy();
    expect(screen.getByDisplayValue("迴向祈願名單")).toBeTruthy();
    expect(
      screen.getByText("studio.groups.prayer_pdf.settings.source_event_group"),
    ).toBeTruthy();
    // Nothing of its own to reset yet.
    expect(
      screen.queryByRole("button", {
        name: "studio.groups.prayer_pdf.settings.use_group_settings",
      }),
    ).toBeNull();
  });

  it("saves trimmed values, blanking emptied text to null", async () => {
    const user = userEvent.setup();
    vi.mocked(fetchPrayerPdfSettings).mockResolvedValue(settings());
    vi.mocked(updatePrayerPdfSettings).mockResolvedValue(
      settings({ source: "EVENT" }),
    );
    const { onOpenChange } = renderDialog();

    await user.clear(
      await screen.findByLabelText(
        "studio.groups.prayer_pdf.settings.chinese_title",
      ),
    );
    await user.type(
      screen.getByLabelText("studio.groups.prayer_pdf.settings.mantra"),
      "  ཨོཾ་ཏཱ་རེ།  ",
    );
    await user.type(
      screen.getByLabelText("studio.groups.prayer_pdf.settings.day_one"),
      "2026-09-25",
    );
    await user.click(
      screen.getByRole("button", { name: "studio.common.save" }),
    );

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
      await screen.findByRole("button", {
        name: "studio.groups.prayer_pdf.settings.fill_template",
      }),
    );
    await user.click(
      screen.getByRole("button", { name: "studio.common.save" }),
    );

    await waitFor(() => expect(updatePrayerPdfSettings).toHaveBeenCalled());
    const [, payload] = vi.mocked(updatePrayerPdfSettings).mock.calls[0];
    expect(payload).toMatchObject(ZABTIK_DROLCHOK_TEMPLATE);
    expect(payload.closing_en).toContain("Noble Arya Tara");
  });

  it("rejects a malformed color", async () => {
    const user = userEvent.setup();
    vi.mocked(fetchPrayerPdfSettings).mockResolvedValue(settings());
    renderDialog();

    const color = await screen.findByLabelText(
      "studio.groups.prayer_pdf.settings.accent_color",
    );
    await user.clear(color);
    await user.type(color, "gold");
    await user.click(
      screen.getByRole("button", { name: "studio.common.save" }),
    );

    expect(toast.error).toHaveBeenCalledWith(
      "studio.groups.prayer_pdf.settings.color_invalid",
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
      await screen.findByRole("button", {
        name: "studio.groups.prayer_pdf.settings.use_group_settings",
      }),
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
      await screen.findByRole("button", {
        name: "studio.groups.prayer_pdf.settings.reset_to_defaults",
      }),
    ).toBeTruthy();
    expect(
      screen.getByText("studio.groups.prayer_pdf.settings.source_group_own"),
    ).toBeTruthy();
  });
});
