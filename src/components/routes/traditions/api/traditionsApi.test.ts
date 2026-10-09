import { beforeEach, describe, expect, it, vi } from "vitest";
import axiosInstance from "@/config/axios-config";
import { fetchTraditionOptions } from "./traditionsApi";

vi.mock("@/config/axios-config", () => ({
  default: { get: vi.fn() },
}));

/** What GET /api/v1/traditions returns: the contract the picker relies on. */
const PUBLIC_TRADITIONS_RESPONSE = {
  traditions: [
    { code: "pali", name: "Pāli scriptures", regions: ["LK", "TH"] },
    { code: "tibetan", name: "Sanskrit & Tibetan scriptures", regions: [] },
  ],
};

describe("fetchTraditionOptions", () => {
  beforeEach(() => {
    vi.mocked(axiosInstance.get).mockReset();
  });

  it("asks the public list for the given language", async () => {
    vi.mocked(axiosInstance.get).mockResolvedValue({
      data: PUBLIC_TRADITIONS_RESPONSE,
    });

    await fetchTraditionOptions("bo");

    expect(axiosInstance.get).toHaveBeenCalledWith("/api/v1/traditions", {
      params: { language: "bo" },
    });
  });

  it("returns the traditions from the response", async () => {
    vi.mocked(axiosInstance.get).mockResolvedValue({
      data: PUBLIC_TRADITIONS_RESPONSE,
    });

    await expect(fetchTraditionOptions()).resolves.toEqual(
      PUBLIC_TRADITIONS_RESPONSE.traditions,
    );
  });

  it("returns an empty list when there are no traditions", async () => {
    vi.mocked(axiosInstance.get).mockResolvedValue({
      data: { traditions: [] },
    });

    await expect(fetchTraditionOptions()).resolves.toEqual([]);
  });

  it("fails on a response without a traditions list, rather than showing none", async () => {
    vi.mocked(axiosInstance.get).mockResolvedValue({
      data: PUBLIC_TRADITIONS_RESPONSE.traditions,
    });

    await expect(fetchTraditionOptions()).rejects.toThrow(
      /unexpected traditions response/i,
    );
  });
});
