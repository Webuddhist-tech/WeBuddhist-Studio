import { beforeEach, describe, expect, it, vi } from "vitest";
import axiosInstance from "@/config/axios-config";
import {
  createPrayerIntention,
  fetchPrayerIntentions,
  patchPrayerIntention,
} from "./prayerIntentionsApi";

vi.mock("@/config/axios-config", () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn() },
}));

describe("prayerIntentionsApi", () => {
  beforeEach(() => {
    vi.mocked(axiosInstance.get).mockReset();
    vi.mocked(axiosInstance.post).mockReset();
    vi.mocked(axiosInstance.patch).mockReset();
    vi.mocked(axiosInstance.get).mockResolvedValue({
      data: { intentions: [] },
    });
    vi.mocked(axiosInstance.post).mockResolvedValue({ data: { id: "1" } });
    vi.mocked(axiosInstance.patch).mockResolvedValue({ data: { id: "1" } });
    vi.spyOn(Storage.prototype, "getItem").mockReturnValue("token");
  });

  it("lists intentions from the CMS catalog", async () => {
    await fetchPrayerIntentions();

    expect(axiosInstance.get).toHaveBeenCalledWith(`/api/v1/cms/intentions`, {
      headers: { Authorization: "Bearer token" },
    });
  });

  it("creates an intention", async () => {
    const payload = {
      slug: "healing",
      label: "Healing",
      color: "#4A78C2",
      description: "Recovery",
      display_order: 1,
    };

    await createPrayerIntention(payload);

    expect(axiosInstance.post).toHaveBeenCalledWith(
      `/api/v1/cms/intentions`,
      payload,
      { headers: { Authorization: "Bearer token" } },
    );
  });

  it("patches an intention by id", async () => {
    await patchPrayerIntention("intention-1", { label: "Recovery" });

    expect(axiosInstance.patch).toHaveBeenCalledWith(
      `/api/v1/cms/intentions/intention-1`,
      { label: "Recovery" },
      { headers: { Authorization: "Bearer token" } },
    );
  });
});
