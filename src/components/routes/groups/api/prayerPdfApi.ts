import axiosInstance from "@/config/axios-config";
import { getApiErrorMessage } from "@/lib/apiErrors";

/** A prayer PDF is built from a group's own chat room or one event's room. */
export type PrayerPdfScope =
  | { kind: "group"; groupId: string }
  | { kind: "event"; eventId: string };

export type PrayerPdfPageSize = "A3" | "A4";

/** Where the settings in use came from: the event's own row, its group's, or the built-in defaults. */
export type PrayerPdfSettingsSource = "EVENT" | "GROUP" | "DEFAULT";

/**
 * Everything printed on the PDF. Text is printed as saved: an empty field is
 * left off the page. Multi-line fields print one line per line.
 */
export interface PrayerPdfSettingsPayload {
  title_bo: string | null;
  title: string | null;
  title_zh: string | null;
  subtitle_bo: string | null;
  subtitle: string | null;
  subtitle_zh: string | null;
  /** YYYY-MM-DD; the "Day: n" badge counts from it. Null hides the badge. */
  day_one: string | null;
  closing_bo: string | null;
  closing_mantra: string | null;
  closing_zh: string | null;
  closing_en: string | null;
  closing_emoji: string | null;
  /** One message per line; exact matches (any case) are left out as app feedback. */
  skip_messages: string | null;
  timezone: string;
  page_size: PrayerPdfPageSize;
  columns: number;
  primary_color: string;
  secondary_color: string;
}

export interface PrayerPdfSettings extends PrayerPdfSettingsPayload {
  group_id: string;
  event_id: string | null;
  source: PrayerPdfSettingsSource;
  updated_at: string | null;
  updated_by: string | null;
}

/**
 * The wording of the Zabtik Drolchok (Profound Essence Tara Puja) prayer list,
 * as the daily GitHub action printed it.
 */
export const ZABTIK_DROLCHOK_TEMPLATE: Partial<PrayerPdfSettingsPayload> = {
  title_bo: "སྐྱབས་ཞུ།",
  title: "Prayer Requests",
  title_zh: "迴向祈願名單",
  subtitle_bo: "ཟབ་ཏིག་སྒྲོལ་ཆོག་ཐད་གཏོང་སྟེང་འབྱོར་བའི་སྐྱབས་ཞུ།",
  subtitle:
    "Prayer requests received through the live broadcast of the Zabtik Drolchok (Profound Essence Tara Puja)",
  subtitle_zh:
    "於甚深心要度母法會（Zabtik Drolchok）直播中所收到的迴向祈願名單",
  day_one: "2026-09-25",
  closing_bo:
    "རྗེ་བཙུན་འཕགས་མ་སྒྲོལ་མ་ཁྱེད་མཁྱེན་ནོ།།\nའཇིགས་དང་སྡུག་བསྔལ་ཀུན་ལས་བསྐྱབ་ཏུ་གསོལ།།",
  closing_mantra: "ཨོཾ་ཏཱ་རེ་ཏུཏྟཱ་རེ་ཏུ་རེ་སྭཱ་ཧཱ།",
  closing_zh:
    "至尊聖度母祈以大悲攝受，\n祈願救度我們脫離一切怖畏與苦難。\n嗡 達咧 都達咧 都咧 梭哈",
  closing_en:
    "Noble Arya Tara, embrace us with compassion;\nProtect us from every fear and suffering.\nOṃ Tāre Tuttāre Ture Svāhā",
  closing_emoji: "🙏🙏🙏",
  skip_messages: "no sound la\nno video la",
  timezone: "Asia/Kolkata",
  page_size: "A3",
  columns: 5,
  primary_color: "#7a1f1f",
  secondary_color: "#b8872b",
};

export interface PrayerPdfDownload {
  blob: Blob;
  filename: string;
  prayerCount: number | null;
}

export const NO_PRAYER_REQUESTS = "NO_PRAYER_REQUESTS";

export const prayerPdfBasePath = (scope: PrayerPdfScope): string =>
  scope.kind === "group"
    ? `/api/v1/cms/prayer-pdf/groups/${scope.groupId}`
    : `/api/v1/cms/prayer-pdf/events/${scope.eventId}`;

export const prayerPdfQueryKey = (scope: PrayerPdfScope) => [
  "cms-prayer-pdf-settings",
  scope.kind,
  scope.kind === "group" ? scope.groupId : scope.eventId,
];

export const fetchPrayerPdfSettings = async (
  scope: PrayerPdfScope,
): Promise<PrayerPdfSettings> => {
  const { data } = await axiosInstance.get<PrayerPdfSettings>(
    prayerPdfBasePath(scope),
  );
  return data;
};

export const updatePrayerPdfSettings = async (
  scope: PrayerPdfScope,
  payload: PrayerPdfSettingsPayload,
): Promise<PrayerPdfSettings> => {
  const { data } = await axiosInstance.put<PrayerPdfSettings>(
    prayerPdfBasePath(scope),
    payload,
  );
  return data;
};

/** Drops this scope's own settings: an event falls back to its group's, a group to the defaults. */
export const resetPrayerPdfSettings = async (
  scope: PrayerPdfScope,
): Promise<PrayerPdfSettings> => {
  const { data } = await axiosInstance.delete<PrayerPdfSettings>(
    prayerPdfBasePath(scope),
  );
  return data;
};

export const filenameFromContentDisposition = (
  header: string | undefined | null,
): string | null => {
  if (!header) return null;
  const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(header);
  return match ? decodeURIComponent(match[1].trim()) : null;
};

/** `day` is YYYY-MM-DD in the settings' timezone. */
export const downloadPrayerPdf = async (
  scope: PrayerPdfScope,
  day: string,
): Promise<PrayerPdfDownload> => {
  const response = await axiosInstance.get<Blob>(
    `${prayerPdfBasePath(scope)}/download`,
    {
      params: { date: day },
      responseType: "blob",
      // Chromium renders the whole day server-side; give it room.
      timeout: 180_000,
    },
  );
  const headers = response.headers ?? {};
  const count = Number(headers["x-prayer-count"]);
  return {
    blob: response.data,
    filename:
      filenameFromContentDisposition(headers["content-disposition"]) ??
      `Prayer_Requests_${day}.pdf`,
    prayerCount: Number.isFinite(count) ? count : null,
  };
};

export const saveBlobAs = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Let the click start the download before the URL goes away.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

const readBlobText = (blob: Blob): Promise<string> =>
  typeof blob.text === "function"
    ? blob.text()
    : new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result ?? ""));
        reader.onerror = () => reject(reader.error);
        reader.readAsText(blob);
      });

/**
 * A failed blob request carries its JSON error body as a Blob, so the usual
 * `response.data.detail` is not there until it is read back as text.
 */
export const getPrayerPdfErrorMessage = async (
  error: unknown,
): Promise<string> => {
  const err = error as { response?: { data?: unknown; status?: number } };
  let detail: unknown;
  const data = err?.response?.data;
  if (data instanceof Blob) {
    try {
      detail = JSON.parse(await readBlobText(data))?.detail;
    } catch {
      detail = undefined;
    }
  } else {
    detail = (data as { detail?: unknown } | undefined)?.detail;
  }
  if (detail === NO_PRAYER_REQUESTS) {
    return "There are no prayer requests on this day.";
  }
  return getApiErrorMessage(
    detail !== undefined ? { response: { data: { detail } } } : error,
    "Could not generate the prayer PDF.",
  );
};

/** Today's date (YYYY-MM-DD) in `timeZone`, which is what the server defaults to. */
export const todayInTimeZone = (timeZone: string, now = new Date()): string => {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(now);
  } catch {
    return now.toISOString().slice(0, 10);
  }
};

export interface PrayerPdfPreview {
  /** The page laid out by its own script; fonts are relative URLs. */
  html: string;
  day: string;
  /** Requests on that day; 0 when `is_sample`. */
  prayer_count: number;
  /** True when the day had no requests and samples are shown instead. */
  is_sample: boolean;
}

/** How the PDF would look with these (unsaved) settings, as HTML. */
export const previewPrayerPdf = async (
  scope: PrayerPdfScope,
  payload: PrayerPdfSettingsPayload,
  day: string,
): Promise<PrayerPdfPreview> => {
  const { data } = await axiosInstance.post<PrayerPdfPreview>(
    `${prayerPdfBasePath(scope)}/preview`,
    payload,
    { params: { date: day } },
  );
  return data;
};

export const PREVIEW_SCROLL_MESSAGE = "prayer-pdf-preview-scroll";

/**
 * Readies the preview HTML for an iframe's srcdoc:
 * - Its fonts are at `fonts/<name>` beside the prayer-pdf routes, and in a
 *   srcdoc a relative URL would resolve against Studio itself, so a <base>
 *   points it at the backend.
 * - `scrollRatio` (0–1) is where the reader was in the previous render; the
 *   page scrolls back there once laid out.
 */
export const withPreviewBase = (
  html: string,
  {
    scrollRatio = 0,
    backendBaseUrl = axiosInstance.defaults?.baseURL || window.location.origin,
  }: { scrollRatio?: number; backendBaseUrl?: string } = {},
): string => {
  const base = `${backendBaseUrl.replace(/\/+$/, "")}/api/v1/cms/prayer-pdf/`;
  const ratio = Number.isFinite(scrollRatio)
    ? Math.min(1, Math.max(0, scrollRatio))
    : 0;
  const tags =
    `<base href="${base.replace(/"/g, "&quot;")}">` +
    `<script>window.__previewScroll=${ratio}</script>`;
  return html.includes("<head>")
    ? html.replace("<head>", () => `<head>${tags}`)
    : tags + html;
};
