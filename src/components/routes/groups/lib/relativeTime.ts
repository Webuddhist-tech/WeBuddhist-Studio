import { formatDistanceToNow } from "date-fns";
import { tolgee } from "@/i18n/tolgee";

const MINUTE = 60;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const MONTH = 30 * DAY;
const YEAR = 365 * DAY;

/**
 * "3 hours ago" style label for a timestamp, in the current UI language.
 * English keeps date-fns' wording; other languages are built from
 * translation keys, since date-fns ships no Tibetan locale. Falls back to
 * `fallback` (the date part by default) when the value cannot be parsed.
 */
export const formatRelativeTime = (
  value: string,
  fallback: string = value.slice(0, 10),
): string => {
  try {
    const date = new Date(value);
    if (tolgee.getLanguage() === "en" || !tolgee.getLanguage()) {
      return formatDistanceToNow(date, { addSuffix: true });
    }
    const time = date.getTime();
    if (Number.isNaN(time)) throw new Error("Invalid date");
    const seconds = Math.max(0, Math.floor((Date.now() - time) / 1000));
    if (seconds < MINUTE)
      return tolgee.t("studio.groups.shared.relative.just_now");
    if (seconds < HOUR) {
      return tolgee.t("studio.groups.shared.relative.minutes_ago", {
        count: Math.floor(seconds / MINUTE),
      });
    }
    if (seconds < DAY) {
      return tolgee.t("studio.groups.shared.relative.hours_ago", {
        count: Math.floor(seconds / HOUR),
      });
    }
    if (seconds < MONTH) {
      return tolgee.t("studio.groups.shared.relative.days_ago", {
        count: Math.floor(seconds / DAY),
      });
    }
    if (seconds < YEAR) {
      return tolgee.t("studio.groups.shared.relative.months_ago", {
        count: Math.floor(seconds / MONTH),
      });
    }
    return tolgee.t("studio.groups.shared.relative.years_ago", {
      count: Math.floor(seconds / YEAR),
    });
  } catch {
    return fallback;
  }
};
