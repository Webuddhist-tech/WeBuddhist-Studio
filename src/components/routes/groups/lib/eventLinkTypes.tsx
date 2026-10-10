import type { IconType } from "react-icons";
import { LuGlobe, LuLink, LuVideo } from "react-icons/lu";
import { SiGooglemeet, SiZoom, SiYoutube } from "react-icons/si";

export const EVENT_YOUTUBE_ICON: IconType = SiYoutube;

export type EventLinkTypeOption = {
  value: string;
  /** English text; render `t(labelKey)` in the UI. */
  label: string;
  labelKey: string;
  Icon: IconType;
};

export const EVENT_LINK_TYPES: EventLinkTypeOption[] = [
  {
    value: "web",
    label: "Website",
    labelKey: "studio.groups.shared.event_link_types.web",
    Icon: LuGlobe,
  },
  {
    value: "google-meet",
    label: "Google Meet",
    labelKey: "studio.groups.shared.event_link_types.google_meet",
    Icon: SiGooglemeet,
  },
  {
    value: "zoom",
    label: "Zoom",
    labelKey: "studio.groups.shared.event_link_types.zoom",
    Icon: SiZoom,
  },
  {
    value: "video",
    label: "Video",
    labelKey: "studio.groups.shared.event_link_types.video",
    Icon: LuVideo,
  },
];

const TYPE_MAP = new Map(
  EVENT_LINK_TYPES.map((option) => [option.value, option]),
);

export const eventLinkIcon = (type: string): IconType =>
  TYPE_MAP.get(type.trim().toLowerCase())?.Icon ?? LuLink;

/** Label for a link type. Pass `t` to get it in the current UI language;
 *  without it the English label is returned. Unknown types echo back as-is. */
export const eventLinkTypeLabel = (
  type: string,
  t?: (key: string) => string,
): string => {
  const trimmed = type.trim();
  const option = TYPE_MAP.get(trimmed.toLowerCase());
  if (!option) return trimmed;
  return t ? t(option.labelKey) : option.label;
};

export const isSafeLinkUrl = (url: string): boolean =>
  /^https?:\/\//i.test(url.trim());
