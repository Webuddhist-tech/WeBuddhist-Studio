import { beforeEach, describe, expect, it, vi } from "vitest";
import axiosInstance from "@/config/axios-config";
import {
  cleanRunTimes,
  deleteYoutubeLiveSync,
  describeRunResult,
  fetchYoutubeLiveSync,
  formatRunTime,
  normalizeRunTime,
  runYoutubeLiveSyncNow,
  saveYoutubeLiveSync,
} from "./youtubeLiveSyncApi";

vi.mock("@/config/axios-config", () => ({
  default: {
    get: vi.fn(),
    put: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  },
}));

const BASE = "/api/v1/cms/groups/g1/youtube-live-sync";

describe("youtube live sync requests", () => {
  beforeEach(() => {
    vi.mocked(axiosInstance.get).mockReset();
    vi.mocked(axiosInstance.put).mockReset();
    vi.mocked(axiosInstance.post).mockReset();
    vi.mocked(axiosInstance.delete).mockReset();
  });

  it("reads the group's schedules", async () => {
    const list = { group_id: "g1", channel_url: null, schedules: [] };
    vi.mocked(axiosInstance.get).mockResolvedValue({ data: list });
    await expect(fetchYoutubeLiveSync("g1")).resolves.toEqual(list);
    expect(axiosInstance.get).toHaveBeenCalledWith(BASE);
  });

  it("saves one schedule for exactly the listed events", async () => {
    vi.mocked(axiosInstance.put).mockResolvedValue({ data: { schedules: [] } });
    const payload = {
      event_ids: ["e1", "e2"],
      enabled: true,
      run_times: ["08:30", "14:00"],
      timezone: "Asia/Kolkata",
    };
    await saveYoutubeLiveSync("g1", payload);
    expect(axiosInstance.put).toHaveBeenCalledWith(BASE, payload);
  });

  it("removes the schedule of a single event", async () => {
    vi.mocked(axiosInstance.delete).mockResolvedValue({});
    await deleteYoutubeLiveSync("g1", "e1");
    expect(axiosInstance.delete).toHaveBeenCalledWith(`${BASE}/e1`);
  });

  it("runs now only for the listed events", async () => {
    const result = {
      live_streams_found: 1,
      events_checked: 1,
      links_added: 1,
      skipped_unknown_language: 0,
    };
    vi.mocked(axiosInstance.post).mockResolvedValue({ data: result });
    await expect(runYoutubeLiveSyncNow("g1", ["e1"])).resolves.toEqual(result);
    expect(axiosInstance.post).toHaveBeenCalledWith(`${BASE}/run`, {
      event_ids: ["e1"],
    });
  });
});

describe("run times", () => {
  it.each([
    ["8:30", "08:30"],
    ["08:30", "08:30"],
    [" 14:00 ", "14:00"],
    ["23:59", "23:59"],
  ])("normalizes %s", (input, expected) => {
    expect(normalizeRunTime(input)).toBe(expected);
  });

  it.each(["", "24:00", "08:60", "8", "8:3", "ab:cd", "8:30pm"])(
    "rejects %s",
    (input) => {
      expect(normalizeRunTime(input)).toBeNull();
    },
  );

  it("cleans a list: drops blanks and bad rows, dedupes and sorts", () => {
    expect(cleanRunTimes(["14:00", "", "8:30", "08:30", "99:99"])).toEqual([
      "08:30",
      "14:00",
    ]);
  });

  it.each([
    ["00:05", "12:05 AM"],
    ["08:30", "8:30 AM"],
    ["12:00", "12:00 PM"],
    ["14:00", "2:00 PM"],
  ])("formats %s as %s", (input, expected) => {
    expect(formatRunTime(input)).toBe(expected);
  });
});

describe("describeRunResult", () => {
  const base = {
    live_streams_found: 0,
    events_checked: 1,
    links_added: 0,
    skipped_unknown_language: 0,
  };

  it("says how many links were added", () => {
    expect(
      describeRunResult({ ...base, live_streams_found: 1, links_added: 2 }),
    ).toBe("Live stream added 2 links.");
    expect(
      describeRunResult({ ...base, live_streams_found: 1, links_added: 1 }),
    ).toBe("Live stream added 1 link.");
  });

  it("says how many links were replaced", () => {
    expect(
      describeRunResult({
        ...base,
        live_streams_found: 1,
        links_replaced: 1,
      }),
    ).toBe("Live stream replaced 1 link.");
    expect(
      describeRunResult({
        ...base,
        live_streams_found: 1,
        links_replaced: 3,
      }),
    ).toBe("Live stream replaced 3 links.");
  });

  it("says when some links were added and some replaced", () => {
    expect(
      describeRunResult({
        ...base,
        live_streams_found: 1,
        links_added: 1,
        links_replaced: 2,
      }),
    ).toBe("Live stream added 1 link and replaced 2 links.");
  });

  it("says when nothing is live", () => {
    expect(describeRunResult(base)).toMatch(/no stream is live/i);
  });

  it("says when the language was unclear", () => {
    expect(
      describeRunResult({ ...base, live_streams_found: 1, skipped_unknown_language: 1 }),
    ).toMatch(/language/i);
  });

  it("says when the events already have it", () => {
    expect(describeRunResult({ ...base, live_streams_found: 1 })).toMatch(/already have/i);
  });
});
