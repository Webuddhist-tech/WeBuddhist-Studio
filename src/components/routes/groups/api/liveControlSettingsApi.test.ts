import { beforeEach, describe, expect, it, vi } from "vitest";
import axiosInstance from "@/config/axios-config";
import {
  controllerLink,
  createController,
  fetchControllers,
  fetchPlanTexts,
  hasToken,
  importSettings,
  issuesFromError,
  saveEditionLiveSettings,
  updateController,
  type LiveController,
} from "./liveControlSettingsApi";

vi.mock("@/config/axios-config", () => ({
  default: {
    get: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    post: vi.fn(),
  },
}));

const controller: LiveController = {
  id: "c1",
  event_id: "e1",
  name: "Main hall iPad",
  token_hint: "a7f2",
  default_text_id: null,
  created_by: "a@b.c",
  created_at: "2026-10-10T00:00:00Z",
  last_used_at: null,
  revoked_at: null,
};

describe("liveControlSettingsApi", () => {
  beforeEach(() => vi.clearAllMocks());

  it("lists an event's controllers", async () => {
    vi.mocked(axiosInstance.get).mockResolvedValue({
      data: { controllers: [controller] },
    });

    await expect(fetchControllers("e1")).resolves.toEqual([controller]);
    expect(axiosInstance.get).toHaveBeenCalledWith(
      "/api/v1/cms/events/e1/live-control/controllers",
    );
  });

  it("creates a controller, the backend generating its token", async () => {
    vi.mocked(axiosInstance.post).mockResolvedValue({
      data: { ...controller, token: "x".repeat(28) + "a7f2" },
    });

    const created = await createController("e1", { name: "Main hall iPad" });

    expect(hasToken(created)).toBe(true);
    expect(axiosInstance.post).toHaveBeenCalledWith(
      "/api/v1/cms/events/e1/live-control/controllers",
      { name: "Main hall iPad" },
    );
  });

  it("asks for a new token by patching the controller", async () => {
    vi.mocked(axiosInstance.patch).mockResolvedValue({ data: controller });

    const updated = await updateController("e1", "c1", {
      regenerate_token: true,
    });

    expect(hasToken(updated)).toBe(false);
    expect(axiosInstance.patch).toHaveBeenCalledWith(
      "/api/v1/cms/events/e1/live-control/controllers/c1",
      { regenerate_token: true },
    );
  });

  it("reads plan texts from the public recitation route", async () => {
    vi.mocked(axiosInstance.get).mockResolvedValue({
      data: { event_id: "e1", plan_id: null, series_id: null, texts: [] },
    });

    await fetchPlanTexts("e1");

    expect(axiosInstance.get).toHaveBeenCalledWith(
      "/api/v1/events/e1/recitation/texts",
    );
  });

  it("saves only the lists given for an edition", async () => {
    vi.mocked(axiosInstance.put).mockResolvedValue({ data: {} });

    await saveEditionLiveSettings("Zt5c", {
      repeated_segments: [{ segment_id: "s", times: 3 }],
    });

    expect(axiosInstance.put).toHaveBeenCalledWith(
      "/api/v1/cms/live-control/editions/Zt5c",
      {
        repeated_segments: [{ segment_id: "s", times: 3 }],
      },
    );
  });

  it("checks an import without writing it", async () => {
    vi.mocked(axiosInstance.post).mockResolvedValue({
      data: { ok: true, applied: false },
    });
    const file = { format: "webuddhist-live-control-settings", version: 1 };

    await importSettings(file, { eventId: "e1", dryRun: true });

    expect(axiosInstance.post).toHaveBeenCalledWith(
      "/api/v1/cms/live-control/import",
      file,
      {
        params: { event_id: "e1", dry_run: true },
      },
    );
  });
});

describe("controllerLink", () => {
  it("carries the token in the fragment, never the query", () => {
    const link = controllerLink("e1", "tok/en+1", "https://studio.example");

    expect(link).toBe(
      "https://studio.example/live-control/e1#token=tok%2Fen%2B1",
    );
    expect(new URL(link).search).toBe("");
  });
});

describe("issuesFromError", () => {
  it("reads the check's issues from a 400", () => {
    const issue = {
      path: "short_titles[0].section_id",
      message: "not a section",
    };

    expect(
      issuesFromError({ response: { data: { detail: [issue, { nope: 1 }] } } }),
    ).toEqual([issue]);
  });

  it("is empty for any other error", () => {
    expect(
      issuesFromError({ response: { data: { detail: "Forbidden" } } }),
    ).toEqual([]);
    expect(issuesFromError(new Error("network"))).toEqual([]);
  });
});
