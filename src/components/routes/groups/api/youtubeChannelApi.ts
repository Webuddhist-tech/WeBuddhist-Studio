import type { GroupSocialLinkDTO } from "./groupsApi";

const API_BASE = "https://www.googleapis.com/youtube/v3";

export type YoutubeLiveStatus = "live" | "upcoming" | "completed";

export interface YoutubeLiveVideo {
  id: string;
  title: string;
  url: string;
  thumbnail: string | null;
  status: YoutubeLiveStatus;
  /** Actual start when it has aired, otherwise the scheduled start. */
  startTime: string | null;
}

/** How a channel is identified in a channel URL. */
export type YoutubeChannelRef =
  | { kind: "id"; value: string }
  | { kind: "handle"; value: string }
  | { kind: "username"; value: string }
  | { kind: "custom"; value: string };

/** The group's YouTube social link, if it has one that names a channel. A
 *  link to a single video has no streams to pick from, so it counts as none. */
export const findGroupYoutubeLink = (
  links: GroupSocialLinkDTO[] | undefined,
): string | null =>
  links?.find(
    (link) =>
      link.platform.trim().toLowerCase() === "youtube" &&
      link.url &&
      parseYoutubeChannelUrl(link.url) !== null,
  )?.url ?? null;

/** Parse a YouTube channel URL (`/channel/UC…`, `/@handle`, `/user/…`,
 *  `/c/…`, or a bare `/<custom>`). Returns null for video/playlist URLs. */
export const parseYoutubeChannelUrl = (
  raw: string,
): YoutubeChannelRef | null => {
  let url: URL;
  try {
    const trimmed = raw.trim();
    url = new URL(
      /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`,
    );
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase();
  if (host !== "youtube.com" && !host.endsWith(".youtube.com")) return null;

  const [first, second] = url.pathname
    .split("/")
    .filter(Boolean)
    .map((part) => decodeURIComponent(part));
  if (!first) return null;

  if (first.startsWith("@")) return { kind: "handle", value: first };
  if (first === "channel" && second) return { kind: "id", value: second };
  if (first === "user" && second) return { kind: "username", value: second };
  if (first === "c" && second) return { kind: "custom", value: second };
  if (
    ["watch", "playlist", "shorts", "live", "embed", "results"].includes(first)
  ) {
    return null;
  }
  return { kind: "custom", value: first };
};

const apiKey = (): string => {
  const key = import.meta.env.VITE_YOUTUBE_API_KEY || "";
  if (!key) throw new Error("YouTube API key is not configured");
  return key;
};

async function youtubeGet<T>(
  path: string,
  params: Record<string, string>,
): Promise<T> {
  const query = new URLSearchParams({ ...params, key: apiKey() });
  const response = await fetch(`${API_BASE}/${path}?${query}`);
  const data = await response.json().catch(() => null);
  if (!response.ok || data?.error) {
    throw new Error(
      `YouTube API error: ${data?.error?.message ?? response.statusText}`,
    );
  }
  return data as T;
}

type ChannelsResponse = {
  items?: {
    id: string;
    contentDetails?: { relatedPlaylists?: { uploads?: string } };
  }[];
};

/** Resolve a channel reference to its uploads playlist id. */
async function fetchUploadsPlaylistId(ref: YoutubeChannelRef): Promise<string> {
  let channelId: string | null = null;
  if (ref.kind === "id") channelId = ref.value;

  if (ref.kind === "custom") {
    // Legacy custom URLs have no direct lookup. YouTube turned them into
    // handles of the same name, so that is the one lookup tried. A channel
    // search is not: its top hit can be any channel with a similar name, and
    // the picker would then offer someone else's streams.
    const byHandle = await youtubeGet<ChannelsResponse>("channels", {
      part: "id",
      forHandle: `@${ref.value}`,
    });
    channelId = byHandle.items?.[0]?.id ?? null;
    if (!channelId) {
      throw new Error(
        "Could not find this YouTube channel. Use its /@handle or /channel/ link in the group's social links.",
      );
    }
  }

  const lookup: Record<string, string> = channelId
    ? { id: channelId }
    : ref.kind === "handle"
      ? { forHandle: ref.value }
      : ref.kind === "username"
        ? { forUsername: ref.value }
        : {};
  if (!Object.keys(lookup).length) throw new Error("YouTube channel not found");

  const channels = await youtubeGet<ChannelsResponse>("channels", {
    part: "contentDetails",
    ...lookup,
  });
  const uploads =
    channels.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
  if (!uploads) throw new Error("YouTube channel not found");
  return uploads;
}

type VideosResponse = {
  items?: {
    id: string;
    snippet?: {
      title?: string;
      liveBroadcastContent?: string;
      thumbnails?: Record<string, { url?: string }>;
    };
    liveStreamingDetails?: {
      actualStartTime?: string;
      actualEndTime?: string;
      scheduledStartTime?: string;
    };
  }[];
};

/** The channel's live streams (live now, upcoming and past), newest first,
 *  taken from its most recent uploads.
 *
 *  Uses the uploads playlist rather than `search?eventType=` because search
 *  costs 100 quota units per call; this path costs ~3. */
export async function fetchYoutubeChannelLiveVideos(
  channelUrl: string,
  maxUploads = 50,
): Promise<YoutubeLiveVideo[]> {
  const ref = parseYoutubeChannelUrl(channelUrl);
  if (!ref) throw new Error("The group's YouTube link is not a channel URL");

  const playlistId = await fetchUploadsPlaylistId(ref);
  const playlist = await youtubeGet<{
    items?: { contentDetails?: { videoId?: string } }[];
  }>("playlistItems", {
    part: "contentDetails",
    playlistId,
    maxResults: String(maxUploads),
  });
  const ids = (playlist.items ?? [])
    .map((item) => item.contentDetails?.videoId)
    .filter((id): id is string => Boolean(id));
  if (!ids.length) return [];

  const videos = await youtubeGet<VideosResponse>("videos", {
    part: "snippet,liveStreamingDetails",
    id: ids.join(","),
  });

  return (videos.items ?? [])
    .filter((video) => video.liveStreamingDetails)
    .map((video): YoutubeLiveVideo => {
      const live = video.liveStreamingDetails ?? {};
      const broadcast = video.snippet?.liveBroadcastContent;
      const status: YoutubeLiveStatus =
        broadcast === "live"
          ? "live"
          : broadcast === "upcoming"
            ? "upcoming"
            : "completed";
      const thumbs = video.snippet?.thumbnails ?? {};
      return {
        id: video.id,
        title: video.snippet?.title ?? video.id,
        url: `https://www.youtube.com/watch?v=${video.id}`,
        thumbnail:
          thumbs.medium?.url ?? thumbs.default?.url ?? thumbs.high?.url ?? null,
        status,
        startTime: live.actualStartTime ?? live.scheduledStartTime ?? null,
      };
    });
}
