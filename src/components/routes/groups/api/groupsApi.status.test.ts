import { beforeEach, describe, expect, it, vi } from "vitest";
import axiosInstance from "@/config/axios-config";
import {
  fetchGroups,
  isGroupVisibleInApp,
  updateGroupStatus,
} from "./groupsApi";

vi.mock("@/config/axios-config", () => ({
  default: { get: vi.fn(), patch: vi.fn() },
}));

beforeEach(() => {
  vi.mocked(axiosInstance.get).mockReset();
  vi.mocked(axiosInstance.patch).mockReset();
  localStorage.setItem("accessToken", "token");
});

/** The endpoint returns the same shape as GET /cms/author/groups/{id}. */
const detailDto = {
  id: "g1",
  slug: "g1",
  is_public: true,
  status: "PUBLISHED",
  metadata: [{ title: "Group one", language: "EN" }],
  tags: [],
  follower_count: 0,
  members: [],
  social_links: [],
  series: [],
  plans: [],
};

describe("updateGroupStatus", () => {
  it("PATCHes the status endpoint with the exact case-sensitive value", async () => {
    vi.mocked(axiosInstance.patch).mockResolvedValueOnce({ data: detailDto });

    const result = await updateGroupStatus("g1", "PUBLISHED");

    expect(axiosInstance.patch).toHaveBeenCalledWith(
      "/api/v1/cms/author/groups/g1/status",
      { status: "PUBLISHED" },
      { headers: { Authorization: "Bearer token" } },
    );
    expect(result).toEqual(detailDto);
  });

  it("sends UNPUBLISHED when hiding a live group", async () => {
    vi.mocked(axiosInstance.patch).mockResolvedValueOnce({
      data: { ...detailDto, status: "UNPUBLISHED" },
    });

    await updateGroupStatus("g1", "UNPUBLISHED");

    expect(axiosInstance.patch).toHaveBeenCalledWith(
      "/api/v1/cms/author/groups/g1/status",
      { status: "UNPUBLISHED" },
      expect.anything(),
    );
  });
});

describe("fetchGroups status filter", () => {
  const emptyPage = {
    data: { groups: [], skip: 0, limit: 10, total: 0 },
  };

  it("passes status through when filtering", async () => {
    vi.mocked(axiosInstance.get).mockResolvedValueOnce(emptyPage);

    await fetchGroups({ page: 1, limit: 10, status: "DRAFT" });

    expect(vi.mocked(axiosInstance.get).mock.calls[0][1]).toMatchObject({
      params: expect.objectContaining({ status: "DRAFT" }),
    });
  });

  it("omits status entirely when not filtering, preserving today's behaviour", async () => {
    vi.mocked(axiosInstance.get).mockResolvedValueOnce(emptyPage);

    await fetchGroups({ page: 1, limit: 10 });

    const params = vi.mocked(axiosInstance.get).mock.calls[0][1]?.params;
    expect(params).not.toHaveProperty("status");
  });
});

describe("isGroupVisibleInApp", () => {
  it("treats only PUBLISHED as visible", () => {
    expect(isGroupVisibleInApp("PUBLISHED")).toBe(true);
    expect(isGroupVisibleInApp("DRAFT")).toBe(false);
    expect(isGroupVisibleInApp("UNPUBLISHED")).toBe(false);
  });

  it("is not visible when the backend sent no status", () => {
    expect(isGroupVisibleInApp(undefined)).toBe(false);
  });
});
