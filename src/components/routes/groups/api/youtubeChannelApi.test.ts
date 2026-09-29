import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  fetchYoutubeChannelLiveVideos,
  findGroupYoutubeLink,
  parseYoutubeChannelUrl,
} from "./youtubeChannelApi";

describe("parseYoutubeChannelUrl", () => {
  it.each([
    [
      "https://www.youtube.com/@dalailama",
      { kind: "handle", value: "@dalailama" },
    ],
    ["youtube.com/@dalailama/streams", { kind: "handle", value: "@dalailama" }],
    [
      "https://www.youtube.com/channel/UC1234567890",
      { kind: "id", value: "UC1234567890" },
    ],
    [
      "https://youtube.com/user/someone",
      { kind: "username", value: "someone" },
    ],
    [
      "https://m.youtube.com/c/MyChannel",
      { kind: "custom", value: "MyChannel" },
    ],
    [
      "https://www.youtube.com/MyChannel",
      { kind: "custom", value: "MyChannel" },
    ],
  ])("parses %s", (url, expected) => {
    expect(parseYoutubeChannelUrl(url)).toEqual(expected);
  });

  it.each([
    "https://www.youtube.com/watch?v=abcdefghijk",
    "https://youtu.be/abcdefghijk",
    "https://example.com/@someone",
    "https://www.youtube.com/",
    "not a url at all",
  ])("rejects %s", (url) => {
    expect(parseYoutubeChannelUrl(url)).toBeNull();
  });
});

describe("findGroupYoutubeLink", () => {
  it("returns the youtube social link", () => {
    expect(
      findGroupYoutubeLink([
        { platform: "facebook", url: "https://facebook.com/x" },
        { platform: "YouTube", url: "https://youtube.com/@x" },
      ]),
    ).toBe("https://youtube.com/@x");
  });

  it("skips a youtube link to a single video", () => {
    expect(
      findGroupYoutubeLink([
        { platform: "YouTube", url: "https://www.youtube.com/watch?v=abc" },
      ]),
    ).toBeNull();
  });

  it("returns null when there is none", () => {
    expect(findGroupYoutubeLink([])).toBeNull();
    expect(findGroupYoutubeLink(undefined)).toBeNull();
  });
});

describe("fetchYoutubeChannelLiveVideos", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubEnv("VITE_YOUTUBE_API_KEY", "test-key");
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  const respond = (body: unknown) =>
    Promise.resolve({ ok: true, json: () => Promise.resolve(body) });

  it("returns only live-stream videos with their status", async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url.includes("/channels?")) {
        expect(url).toContain("forHandle=%40chan");
        return respond({
          items: [
            {
              id: "UC1",
              contentDetails: { relatedPlaylists: { uploads: "UU1" } },
            },
          ],
        });
      }
      if (url.includes("/playlistItems?")) {
        expect(url).toContain("playlistId=UU1");
        return respond({
          items: ["v1", "v2", "v3"].map((videoId) => ({
            contentDetails: { videoId },
          })),
        });
      }
      if (url.includes("/videos?")) {
        return respond({
          items: [
            {
              id: "v1",
              snippet: { title: "Live now", liveBroadcastContent: "live" },
              liveStreamingDetails: { actualStartTime: "2026-09-29T10:00:00Z" },
            },
            { id: "v2", snippet: { title: "Regular upload" } },
            {
              id: "v3",
              snippet: {
                title: "Scheduled",
                liveBroadcastContent: "upcoming",
                thumbnails: { medium: { url: "https://i.ytimg.com/v3.jpg" } },
              },
              liveStreamingDetails: {
                scheduledStartTime: "2026-10-01T10:00:00Z",
              },
            },
          ],
        });
      }
      throw new Error(`unexpected ${url}`);
    });

    const videos = await fetchYoutubeChannelLiveVideos(
      "https://www.youtube.com/@chan",
    );

    expect(videos).toEqual([
      {
        id: "v1",
        title: "Live now",
        url: "https://www.youtube.com/watch?v=v1",
        thumbnail: null,
        status: "live",
        startTime: "2026-09-29T10:00:00Z",
      },
      {
        id: "v3",
        title: "Scheduled",
        url: "https://www.youtube.com/watch?v=v3",
        thumbnail: "https://i.ytimg.com/v3.jpg",
        status: "upcoming",
        startTime: "2026-10-01T10:00:00Z",
      },
    ]);
  });

  it("does not guess a legacy custom URL's channel from a search", async () => {
    fetchMock.mockImplementation(() => respond({ items: [] }));
    await expect(
      fetchYoutubeChannelLiveVideos("https://www.youtube.com/c/SomeName"),
    ).rejects.toThrow("Could not find this YouTube channel");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain("forHandle=%40SomeName");
  });

  it("rejects a link that is not a channel", async () => {
    await expect(
      fetchYoutubeChannelLiveVideos(
        "https://www.youtube.com/watch?v=abcdefghijk",
      ),
    ).rejects.toThrow("not a channel URL");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
