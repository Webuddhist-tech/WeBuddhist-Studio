import { PLATFORM_PATTERNS } from "@/lib/constant";
import type { GroupSocialLinkDTO } from "../api/groupsApi";

export const getSocialLinkUrlError = (
  platform: string,
  url: string,
): string | null => {
  if (!platform || !url || platform === "email") return null;
  const pattern = PLATFORM_PATTERNS[platform];
  if (pattern && !pattern.test(url)) {
    return `URL must be a valid ${platform} link`;
  }
  return null;
};

/** True while any link is still empty or does not match its platform. */
export const hasIncompleteSocialLink = (links: GroupSocialLinkDTO[]) =>
  links.some(
    (link) =>
      !link.url.trim() || getSocialLinkUrlError(link.platform, link.url),
  );
