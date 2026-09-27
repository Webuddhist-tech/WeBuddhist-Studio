import { beforeEach, describe, expect, it, vi } from "vitest";
import axiosInstance from "@/config/axios-config";
import {
  createLocation,
  fetchLocation,
  formatCoordinates,
  hasCoordinates,
  updateLocation,
} from "./locationsApi";

vi.mock("@/config/axios-config", () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn() },
}));

describe("hasCoordinates", () => {
  it("accepts 0/0 — Null Island is a real place", () => {
    expect(hasCoordinates({ latitude: 0, longitude: 0 })).toBe(true);
  });

  it("rejects a location with no coordinates", () => {
    expect(hasCoordinates({})).toBe(false);
  });

  it("rejects a half-set pair", () => {
    expect(hasCoordinates({ latitude: 32.2 })).toBe(false);
  });
});

describe("formatCoordinates", () => {
  it("formats 0/0 rather than treating it as absent", () => {
    expect(formatCoordinates({ latitude: 0, longitude: 0 }, 1)).toBe(
      "0.0, 0.0",
    );
  });

  it("returns null when coordinates are absent", () => {
    expect(formatCoordinates({})).toBeNull();
  });
});


describe("location requests", () => {
  beforeEach(() => {
    vi.mocked(axiosInstance.get).mockReset();
    vi.mocked(axiosInstance.post).mockReset();
    vi.mocked(axiosInstance.patch).mockReset();
    vi.mocked(axiosInstance.get).mockResolvedValue({
      data: { id: "loc-1", group_id: "g1", name: "Bodh Gaya", translations: [] },
    });
    vi.mocked(axiosInstance.post).mockResolvedValue({ data: { id: "loc-1" } });
    vi.mocked(axiosInstance.patch).mockResolvedValue({ data: { id: "loc-1" } });
  });

  it("fetches one location by id", async () => {
    const location = await fetchLocation("g1", "loc-1");

    expect(axiosInstance.get).toHaveBeenCalledWith(
      "/api/v1/cms/author/groups/g1/locations/loc-1",
    );
    expect(location.id).toBe("loc-1");
  });

  it("sends localized names when creating", async () => {
    await createLocation("g1", {
      name: "Bodh Gaya",
      translations: [{ language: "BO", name: "རྡོ་" }],
    });

    expect(axiosInstance.post).toHaveBeenCalledWith(
      "/api/v1/cms/author/groups/g1/locations",
      {
        name: "Bodh Gaya",
        translations: [{ language: "BO", name: "རྡོ་" }],
      },
    );
  });

  it("PATCHes localized names onto an existing location", async () => {
    await updateLocation("g1", "loc-1", {
      name: "Bodh Gaya",
      latitude: null,
      longitude: null,
      translations: [{ language: "EN", name: "Bodh Gaya" }],
    });

    expect(axiosInstance.patch).toHaveBeenCalledWith(
      "/api/v1/cms/author/groups/g1/locations/loc-1",
      {
        name: "Bodh Gaya",
        latitude: null,
        longitude: null,
        translations: [{ language: "EN", name: "Bodh Gaya" }],
      },
    );
  });
});
