import { beforeEach, describe, expect, it, vi } from "vitest";
import axiosInstance from "@/config/axios-config";
import {
  DEFAULT_BAN_DURATION_DAYS,
  fetchGroupBans,
  fetchGroupJoinedUsers,
  isBanAlreadyResolvedError,
  liftGroupBan,
  removeGroupJoinedUser,
} from "./groupCommunityApi";

vi.mock("@/config/axios-config", () => ({
  default: { get: vi.fn(), post: vi.fn() },
}));

const GROUP_ID = "group-1";
const USER_ID = "user-1";

const banResponse = {
  data: {
    id: "ban-1",
    user_id: USER_ID,
    fullname: "Dawa Norbu",
    expires_at: "2026-09-24T00:00:00+00:00",
    created_at: "2026-09-17T00:00:00+00:00",
    is_active: true,
  },
};

beforeEach(() => {
  vi.mocked(axiosInstance.get).mockReset();
  vi.mocked(axiosInstance.post).mockReset();
  vi.spyOn(Storage.prototype, "getItem").mockReturnValue("token");
});

describe("fetchGroupJoinedUsers", () => {
  it("requests the CMS joined-users list with pagination", async () => {
    vi.mocked(axiosInstance.get).mockResolvedValueOnce({
      data: { users: [], skip: 20, limit: 20, total: 0 },
    });

    await fetchGroupJoinedUsers(GROUP_ID, { skip: 20, limit: 20 });

    expect(axiosInstance.get).toHaveBeenCalledWith(
      `/api/v1/cms/author/groups/${GROUP_ID}/joined-users`,
      expect.objectContaining({ params: { skip: 20, limit: 20 } }),
    );
  });
});

describe("removeGroupJoinedUser", () => {
  it("defaults to a seven day ban", async () => {
    vi.mocked(axiosInstance.post).mockResolvedValueOnce(banResponse);

    await removeGroupJoinedUser(GROUP_ID, USER_ID);

    expect(DEFAULT_BAN_DURATION_DAYS).toBe(7);
    expect(axiosInstance.post).toHaveBeenCalledWith(
      `/api/v1/cms/author/groups/${GROUP_ID}/joined-users/${USER_ID}/remove`,
      { ban_duration_days: 7, reason: null },
      expect.anything(),
    );
  });

  it("sends the chosen duration and a trimmed reason", async () => {
    vi.mocked(axiosInstance.post).mockResolvedValueOnce(banResponse);

    await removeGroupJoinedUser(GROUP_ID, USER_ID, {
      ban_duration_days: 30,
      reason: "  spam  ",
    });

    expect(axiosInstance.post).toHaveBeenCalledWith(
      expect.any(String),
      { ban_duration_days: 30, reason: "spam" },
      expect.anything(),
    );
  });

  it("sends null for a whitespace-only reason", async () => {
    vi.mocked(axiosInstance.post).mockResolvedValueOnce(banResponse);

    await removeGroupJoinedUser(GROUP_ID, USER_ID, { reason: "   " });

    expect(vi.mocked(axiosInstance.post).mock.calls[0][1]).toMatchObject({
      reason: null,
    });
  });
});

describe("fetchGroupBans", () => {
  it("asks only for active bans by default", async () => {
    vi.mocked(axiosInstance.get).mockResolvedValueOnce({
      data: { bans: [], skip: 0, limit: 20, total: 0 },
    });

    await fetchGroupBans(GROUP_ID);

    expect(axiosInstance.get).toHaveBeenCalledWith(
      `/api/v1/cms/author/groups/${GROUP_ID}/bans`,
      expect.objectContaining({
        params: { skip: 0, limit: 20, active_only: true },
      }),
    );
  });

  it("can ask for the full history", async () => {
    vi.mocked(axiosInstance.get).mockResolvedValueOnce({
      data: { bans: [], skip: 0, limit: 20, total: 0 },
    });

    await fetchGroupBans(GROUP_ID, { activeOnly: false });

    expect(
      vi.mocked(axiosInstance.get).mock.calls[0][1],
    ).toMatchObject({ params: { active_only: false } });
  });
});

describe("liftGroupBan", () => {
  it("posts to the lift endpoint", async () => {
    vi.mocked(axiosInstance.post).mockResolvedValueOnce(banResponse);

    await liftGroupBan(GROUP_ID, "ban-1");

    expect(axiosInstance.post).toHaveBeenCalledWith(
      `/api/v1/cms/author/groups/${GROUP_ID}/bans/ban-1/lift`,
      {},
      expect.anything(),
    );
  });
});

describe("isBanAlreadyResolvedError", () => {
  it("treats a 400 as already resolved", () => {
    expect(isBanAlreadyResolvedError({ response: { status: 400 } })).toBe(true);
  });

  it("leaves other failures alone", () => {
    expect(isBanAlreadyResolvedError({ response: { status: 403 } })).toBe(
      false,
    );
    expect(isBanAlreadyResolvedError(null)).toBe(false);
    expect(isBanAlreadyResolvedError(new Error("network"))).toBe(false);
  });
});
