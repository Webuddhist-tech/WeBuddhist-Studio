import {
  GROUP_ACCUMULATOR_LINK_TITLE_MAX,
  isValidLinkUrl,
  type GroupAccumulatorLinkType,
} from "../api/groupAccumulatorsApi";

/**
 * A link row in the group accumulator form. `id` is client-generated because
 * the server regenerates row ids on every save, so a returned id is not a
 * stable React key. `link_type` is only set for rows loaded from the server.
 */
export type AccumulatorLinkRow = {
  id: string;
  url: string;
  title: string;
  link_type: GroupAccumulatorLinkType | null;
};

let linkRowCounter = 0;

export const newLinkRow = (): AccumulatorLinkRow => {
  linkRowCounter += 1;
  return {
    id: `new-${linkRowCounter}`,
    url: "",
    title: "",
    link_type: null,
  };
};

/**
 * Best-effort client-side YouTube id parse, used only to preview a thumbnail
 * and badge while typing. The server does the authoritative derivation.
 */
export function parseYoutubeVideoId(rawUrl: string): string | null {
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^www\./, "").toLowerCase();
  const isId = (value: string | null): value is string =>
    Boolean(value) && /^[\w-]{11}$/.test(value as string);

  if (host === "youtu.be") {
    const id = url.pathname.slice(1).split("/")[0];
    return isId(id) ? id : null;
  }
  if (host === "youtube.com" || host === "m.youtube.com") {
    const param = url.searchParams.get("v");
    if (isId(param)) return param;
    const match = /^\/(?:embed|shorts|live|v)\/([\w-]{11})/.exec(url.pathname);
    return match ? match[1] : null;
  }
  return null;
}

/**
 * Platforms we can recognise from the URL alone. Only YouTube gets a real
 * thumbnail (its image host needs no API key); the rest are identified by
 * name and icon, since reading a page's OG image cross-origin is blocked.
 */
export type LinkPlatform =
  | "YOUTUBE"
  | "VIMEO"
  | "FACEBOOK"
  | "INSTAGRAM"
  | "TIKTOK"
  | "SOUNDCLOUD"
  | "OTHER";

const PLATFORM_HOSTS: ReadonlyArray<
  readonly [LinkPlatform, readonly string[]]
> = [
  ["VIMEO", ["vimeo.com", "player.vimeo.com"]],
  ["FACEBOOK", ["facebook.com", "fb.com", "fb.watch", "m.facebook.com"]],
  ["INSTAGRAM", ["instagram.com", "instagr.am"]],
  ["TIKTOK", ["tiktok.com", "vm.tiktok.com"]],
  ["SOUNDCLOUD", ["soundcloud.com", "on.soundcloud.com"]],
];

export const PLATFORM_LABEL: Record<LinkPlatform, string> = {
  YOUTUBE: "YouTube",
  VIMEO: "Vimeo",
  FACEBOOK: "Facebook",
  INSTAGRAM: "Instagram",
  TIKTOK: "TikTok",
  SOUNDCLOUD: "SoundCloud",
  OTHER: "Link",
};

/** Identifies the platform for the row's icon and label. */
export function detectLinkPlatform(rawUrl: string): LinkPlatform | null {
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;

  const host = url.hostname.replace(/^www\./, "").toLowerCase();
  if (parseYoutubeVideoId(trimmed) != null) return "YOUTUBE";
  if (
    host === "youtube.com" ||
    host === "youtu.be" ||
    host === "m.youtube.com"
  ) {
    return "YOUTUBE";
  }
  for (const [platform, hosts] of PLATFORM_HOSTS) {
    if (hosts.includes(host)) return platform;
  }
  return "OTHER";
}

/** True when the row has content the author expects to be saved. */
export const isLinkRowFilled = (row: AccumulatorLinkRow): boolean =>
  row.url.trim().length > 0 || row.title.trim().length > 0;

/** Row-id-keyed validation errors for the rows that will actually be sent. */
export function validateLinkRows(
  rows: AccumulatorLinkRow[],
): Record<string, string> {
  const errors: Record<string, string> = {};
  rows.filter(isLinkRowFilled).forEach((row) => {
    if (!isValidLinkUrl(row.url)) {
      errors[row.id] = "Enter a valid http or https URL";
      return;
    }
    if (row.title.trim().length > GROUP_ACCUMULATOR_LINK_TITLE_MAX) {
      errors[row.id] =
        `Title must be ${GROUP_ACCUMULATOR_LINK_TITLE_MAX} characters or fewer`;
    }
  });
  return errors;
}
