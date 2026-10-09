import type { IconType } from "react-icons";
import { LuGlobe, LuLink, LuVideo } from "react-icons/lu";
import { SiGooglemeet, SiZoom, SiYoutube } from "react-icons/si";

export const EVENT_YOUTUBE_ICON: IconType = SiYoutube;

export type EventLinkTypeOption = {
  value: string;
  label: string;
  Icon: IconType;
};

export const EVENT_LINK_TYPES: EventLinkTypeOption[] = [
  { value: "web", label: "Website", Icon: LuGlobe },
  { value: "google-meet", label: "Google Meet", Icon: SiGooglemeet },
  { value: "zoom", label: "Zoom", Icon: SiZoom },
  { value: "video", label: "Video", Icon: LuVideo },
];

const TYPE_MAP = new Map(
  EVENT_LINK_TYPES.map((option) => [option.value, option]),
);

export const eventLinkIcon = (type: string): IconType =>
  TYPE_MAP.get(type.trim().toLowerCase())?.Icon ?? LuLink;

export const eventLinkTypeLabel = (type: string): string => {
  const trimmed = type.trim();
  return TYPE_MAP.get(trimmed.toLowerCase())?.label ?? trimmed;
};

export const isSafeLinkUrl = (url: string): boolean =>
  /^https?:\/\//i.test(url.trim());
