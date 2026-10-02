import { beforeEach, describe, expect, it, vi } from "vitest";
import axiosInstance from "@/config/axios-config";
import {
  downloadPrayerPdf,
  fetchPrayerPdfSettings,
  filenameFromContentDisposition,
  getPrayerPdfErrorMessage,
  prayerPdfBasePath,
  resetPrayerPdfSettings,
  todayInTimeZone,
  updatePrayerPdfSettings,
  type PrayerPdfSettingsPayload,
} from "./prayerPdfApi";

vi.mock("@/config/axios-config", () => ({
  default: { get: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

const payload: PrayerPdfSettingsPayload = {
  title_bo: "སྐྱབས་ཞུ།",
  title: "Prayer Requests",
  title_zh: null,
  subtitle_bo: null,
  subtitle: null,
  subtitle_zh: null,
  day_one: "2026-09-25",
  closing_bo: null,
  closing_mantra: null,
  closing_zh: null,
  closing_en: null,
  closing_emoji: null,
  skip_messages: "no sound la",
  timezone: "Asia/Kolkata",
  page_size: "A3",
  columns: 5,
  primary_color: "#7a1f1f",
  secondary_color: "#b8872b",
};

describe("prayerPdfApi", () => {
  beforeEach(() => {
    vi.mocked(axiosInstance.get).mockReset();
    vi.mocked(axiosInstance.put).mockReset();
    vi.mocked(axiosInstance.delete).mockReset();
  });

  it("builds group and event paths", () => {
    expect(prayerPdfBasePath({ kind: "group", groupId: "g1" })).toBe(
      "/api/v1/cms/prayer-pdf/groups/g1",
    );
    expect(prayerPdfBasePath({ kind: "event", eventId: "e1" })).toBe(
      "/api/v1/cms/prayer-pdf/events/e1",
    );
  });

  it("reads, saves and resets settings", async () => {
    vi.mocked(axiosInstance.get).mockResolvedValue({
      data: { source: "GROUP" },
    });
    vi.mocked(axiosInstance.put).mockResolvedValue({
      data: { source: "EVENT" },
    });
    vi.mocked(axiosInstance.delete).mockResolvedValue({
      data: { source: "GROUP" },
    });
    const scope = { kind: "event", eventId: "e1" } as const;

    await fetchPrayerPdfSettings(scope);
    await updatePrayerPdfSettings(scope, payload);
    await resetPrayerPdfSettings(scope);

    expect(axiosInstance.get).toHaveBeenCalledWith(
      "/api/v1/cms/prayer-pdf/events/e1",
    );
    expect(axiosInstance.put).toHaveBeenCalledWith(
      "/api/v1/cms/prayer-pdf/events/e1",
      payload,
    );
    expect(axiosInstance.delete).toHaveBeenCalledWith(
      "/api/v1/cms/prayer-pdf/events/e1",
    );
  });

  it("downloads the PDF as a blob with filename and count", async () => {
    const blob = new Blob(["%PDF"], { type: "application/pdf" });
    vi.mocked(axiosInstance.get).mockResolvedValue({
      data: blob,
      headers: {
        "content-disposition":
          'attachment; filename="Prayer_Requests_sangha_2026-10-01_A3.pdf"',
        "x-prayer-count": "12",
      },
    });

    const result = await downloadPrayerPdf(
      { kind: "group", groupId: "g1" },
      "2026-10-01",
    );

    expect(axiosInstance.get).toHaveBeenCalledWith(
      "/api/v1/cms/prayer-pdf/groups/g1/download",
      expect.objectContaining({
        params: { date: "2026-10-01" },
        responseType: "blob",
      }),
    );
    expect(result.blob).toBe(blob);
    expect(result.filename).toBe("Prayer_Requests_sangha_2026-10-01_A3.pdf");
    expect(result.prayerCount).toBe(12);
  });

  it("falls back to a dated filename when headers are hidden", async () => {
    vi.mocked(axiosInstance.get).mockResolvedValue({
      data: new Blob(["%PDF"]),
      headers: {},
    });

    const result = await downloadPrayerPdf(
      { kind: "event", eventId: "e1" },
      "2026-10-01",
    );

    expect(result.filename).toBe("Prayer_Requests_2026-10-01.pdf");
    expect(result.prayerCount).toBeNull();
  });
});

describe("filenameFromContentDisposition", () => {
  it("parses quoted and bare filenames", () => {
    expect(
      filenameFromContentDisposition('attachment; filename="a b.pdf"'),
    ).toBe("a b.pdf");
    expect(filenameFromContentDisposition("attachment; filename=x.pdf")).toBe(
      "x.pdf",
    );
    expect(filenameFromContentDisposition(undefined)).toBeNull();
  });
});

describe("getPrayerPdfErrorMessage", () => {
  it("reads NO_PRAYER_REQUESTS out of a blob error body", async () => {
    const error = {
      response: {
        status: 404,
        data: new Blob([JSON.stringify({ detail: "NO_PRAYER_REQUESTS" })], {
          type: "application/json",
        }),
      },
    };
    expect(await getPrayerPdfErrorMessage(error)).toBe(
      "There are no prayer requests on this day.",
    );
  });

  it("maps known permission details", async () => {
    const error = {
      response: {
        status: 403,
        data: new Blob([JSON.stringify({ detail: "NO_GROUP_MEMBERSHIP" })]),
      },
    };
    expect(await getPrayerPdfErrorMessage(error)).toBe(
      "You are not a member of this content's group.",
    );
  });

  it("falls back when the body is not JSON", async () => {
    const error = { response: { status: 500, data: new Blob(["oops"]) } };
    expect(await getPrayerPdfErrorMessage(error)).toBe(
      "Could not generate the prayer PDF.",
    );
  });
});

describe("todayInTimeZone", () => {
  it("formats the date in the given zone", () => {
    // 20:00 UTC on 1 Oct is already 2 Oct in India.
    const now = new Date("2026-10-01T20:00:00Z");
    expect(todayInTimeZone("Asia/Kolkata", now)).toBe("2026-10-02");
    expect(todayInTimeZone("UTC", now)).toBe("2026-10-01");
  });

  it("survives an unknown zone", () => {
    const now = new Date("2026-10-01T20:00:00Z");
    expect(todayInTimeZone("Mars/Base", now)).toBe("2026-10-01");
  });
});
