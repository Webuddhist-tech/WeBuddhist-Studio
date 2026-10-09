import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PrayerPdfPreview from "./PrayerPdfPreview";
import {
  previewPrayerPdf,
  type PrayerPdfSettingsPayload,
} from "../../api/prayerPdfApi";

vi.mock("../../api/prayerPdfApi", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../api/prayerPdfApi")>();
  return { ...actual, previewPrayerPdf: vi.fn() };
});

const settings: PrayerPdfSettingsPayload = {
  title_bo: null,
  title: "Prayer Requests",
  title_zh: null,
  subtitle_bo: null,
  subtitle: null,
  subtitle_zh: null,
  day_one: null,
  closing_bo: null,
  closing_mantra: null,
  closing_zh: null,
  closing_en: null,
  closing_emoji: null,
  skip_messages: null,
  timezone: "Asia/Kolkata",
  page_size: "A3",
  columns: 5,
  primary_color: "#7a1f1f",
  secondary_color: "#b8872b",
};

const renderPreview = (valid = true) => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <PrayerPdfPreview
        scope={{ kind: "group", groupId: "g1" }}
        settings={settings}
        valid={valid}
      />
    </QueryClientProvider>,
  );
};

describe("PrayerPdfPreview", () => {
  beforeEach(() => {
    vi.mocked(previewPrayerPdf).mockReset();
  });

  it("renders the server's page in a sandboxed frame", async () => {
    vi.mocked(previewPrayerPdf).mockResolvedValue({
      html: "<html><head></head><body>page</body></html>",
      day: "2026-10-01",
      prayer_count: 0,
      is_sample: true,
    });
    renderPreview();

    const frame = (await screen.findByTitle(
      "Prayer PDF preview",
    )) as HTMLIFrameElement;
    expect(frame.getAttribute("sandbox")).toBe("allow-scripts");
    expect(frame.getAttribute("srcdoc")).toContain("<base href=");
    expect(frame.getAttribute("srcdoc")).toContain("page");
    expect(
      screen.getByText(
        "No prayer requests on this day — showing sample requests.",
      ),
    ).toBeTruthy();
    expect(vi.mocked(previewPrayerPdf).mock.calls[0][0]).toEqual({
      kind: "group",
      groupId: "g1",
    });
  });

  it("waits for valid settings", async () => {
    renderPreview(false);

    expect(
      screen.getByText("Fix the highlighted values to update the preview."),
    ).toBeTruthy();
    await new Promise((resolve) => setTimeout(resolve, 800));
    expect(previewPrayerPdf).not.toHaveBeenCalled();
  });

  it("shows the server's error", async () => {
    vi.mocked(previewPrayerPdf).mockRejectedValue({
      response: { status: 403, data: { detail: "NO_GROUP_MEMBERSHIP" } },
    });
    renderPreview();

    await waitFor(() =>
      expect(
        screen.getByText("You are not a member of this content's group."),
      ).toBeTruthy(),
    );
  });
});
