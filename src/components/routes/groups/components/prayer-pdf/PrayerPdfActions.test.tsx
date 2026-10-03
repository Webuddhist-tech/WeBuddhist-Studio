import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PrayerPdfActions from "./PrayerPdfActions";
import {
  copyTextFromPromise,
  downloadPrayerPdf,
  fetchAllPrayerRequests,
  fetchPrayerPdfSettings,
  fetchPrayerRequests,
  saveBlobAs,
  type PrayerPdfScope,
  type PrayerRequest,
  type PrayerRequestList,
} from "../../api/prayerPdfApi";

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

vi.mock("./PrayerPdfSettingsDialog", () => ({
  default: ({ open }: { open: boolean }) =>
    open ? <div>Settings dialog</div> : null,
}));

vi.mock("../../api/prayerPdfApi", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../api/prayerPdfApi")>();
  return {
    ...actual,
    fetchPrayerPdfSettings: vi.fn(),
    fetchPrayerRequests: vi.fn(),
    downloadPrayerPdf: vi.fn(),
    saveBlobAs: vi.fn(),
    fetchAllPrayerRequests: vi.fn(),
    copyTextFromPromise: vi.fn(),
  };
});

const request = (overrides: Partial<PrayerRequest> = {}): PrayerRequest => ({
  id: "m1",
  user_id: "u1",
  posted_by: "Tenzin Dolma",
  avatar_url: null,
  message: "Please pray for my mother.",
  intention: "healing",
  is_edited: false,
  created_at: "2026-10-01T04:30:00Z",
  ...overrides,
});

const list = (
  overrides: Partial<PrayerRequestList> = {},
): PrayerRequestList => ({
  items: [request()],
  total: 1,
  skip: 0,
  limit: 20,
  day: null,
  timezone: "Asia/Kolkata",
  ...overrides,
});

const scope: PrayerPdfScope = { kind: "group", groupId: "g1" };

const renderActions = () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <PrayerPdfActions scope={scope} />
    </QueryClientProvider>,
  );
};

const openSidebar = async () => {
  await userEvent.click(screen.getByRole("button", { name: /prayers/i }));
  await screen.findByText("Prayer requests");
};

describe("PrayerPdfActions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fetchPrayerPdfSettings).mockResolvedValue({
      timezone: "Asia/Kolkata",
    } as never);
    vi.mocked(fetchPrayerRequests).mockResolvedValue(list());
  });

  it("shows one Prayers button and loads nothing until it is opened", () => {
    renderActions();
    expect(screen.getByRole("button", { name: /prayers/i })).toBeTruthy();
    expect(screen.queryByText(/download prayers/i)).toBeNull();
    expect(fetchPrayerRequests).not.toHaveBeenCalled();
  });

  it("lists every day's requests when no day is chosen", async () => {
    renderActions();
    await openSidebar();

    expect(await screen.findByText("Please pray for my mother.")).toBeTruthy();
    expect(screen.getByText("Tenzin Dolma")).toBeTruthy();
    expect(screen.getByText("healing")).toBeTruthy();
    expect(fetchPrayerRequests).toHaveBeenCalledWith(scope, {
      day: null,
      skip: 0,
      limit: 20,
    });
    const download = screen.getByRole("button", { name: /download prayers/i });
    expect((download as HTMLButtonElement).disabled).toBe(true);
  });

  it("pages through all days", async () => {
    vi.mocked(fetchPrayerRequests).mockResolvedValue(list({ total: 45 }));
    renderActions();
    await openSidebar();
    await screen.findByText("Please pray for my mother.");

    await userEvent.click(screen.getByText(/next/i));

    await waitFor(() =>
      expect(fetchPrayerRequests).toHaveBeenLastCalledWith(scope, {
        day: null,
        skip: 20,
        limit: 20,
      }),
    );
  });

  it("filters to a chosen day and downloads its PDF", async () => {
    const blob = new Blob(["%PDF"]);
    vi.mocked(downloadPrayerPdf).mockResolvedValue({
      blob,
      filename: "Prayer_Requests_2026-10-01_A3.pdf",
      prayerCount: 1,
    });
    renderActions();
    await openSidebar();

    fireEvent.change(screen.getByLabelText("Day"), {
      target: { value: "2026-10-01" },
    });

    await waitFor(() =>
      expect(fetchPrayerRequests).toHaveBeenLastCalledWith(scope, {
        day: "2026-10-01",
        skip: 0,
        limit: 20,
      }),
    );

    await userEvent.click(
      screen.getByRole("button", { name: /download prayers/i }),
    );
    await waitFor(() =>
      expect(saveBlobAs).toHaveBeenCalledWith(
        blob,
        "Prayer_Requests_2026-10-01_A3.pdf",
      ),
    );
    expect(downloadPrayerPdf).toHaveBeenCalledWith(scope, "2026-10-01");
  });

  it("opens the PDF settings from the sidebar", async () => {
    renderActions();
    await openSidebar();

    await userEvent.click(screen.getByRole("button", { name: /prayer pdf/i }));

    expect(screen.getByText("Settings dialog")).toBeTruthy();
  });

  it("copies every request the filter matches as CSV", async () => {
    vi.mocked(fetchAllPrayerRequests).mockResolvedValue([
      request(),
      request({ id: "m2", posted_by: "Pema", message: "Long life, health" }),
    ]);
    vi.mocked(copyTextFromPromise).mockImplementation(async (text) => {
      await text;
    });
    renderActions();
    await openSidebar();
    await screen.findByText("Please pray for my mother.");

    await userEvent.click(screen.getByRole("button", { name: /copy as csv/i }));

    await waitFor(() => expect(copyTextFromPromise).toHaveBeenCalled());
    expect(fetchAllPrayerRequests).toHaveBeenCalledWith(scope, null);
    await expect(vi.mocked(copyTextFromPromise).mock.calls[0][0]).resolves.toBe(
      'Name,Prayer request\nTenzin Dolma,Please pray for my mother.\nPema,"Long life, health"',
    );
  });
});
