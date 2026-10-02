import { useEffect, useMemo, useRef, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useDebounce } from "use-debounce";
import { LuLoaderCircle } from "react-icons/lu";
import { Pecha } from "@/components/ui/shadimport";
import { getApiErrorMessage } from "@/lib/apiErrors";
import {
  PREVIEW_SCROLL_MESSAGE,
  previewPrayerPdf,
  prayerPdfQueryKey,
  todayInTimeZone,
  withPreviewBase,
  type PrayerPdfScope,
  type PrayerPdfSettingsPayload,
} from "../../api/prayerPdfApi";

interface PrayerPdfPreviewProps {
  scope: PrayerPdfScope;
  settings: PrayerPdfSettingsPayload;
  /** False while the form has a value the server would reject; the last good preview stays up. */
  valid: boolean;
}

const PREVIEW_DEBOUNCE_MS = 600;

/**
 * The PDF as it will print with the settings being edited: the server's own
 * template and layout script, shown in a sandboxed frame. It refreshes a
 * moment after typing stops.
 */
const PrayerPdfPreview = ({
  scope,
  settings,
  valid,
}: PrayerPdfPreviewProps) => {
  const [day, setDay] = useState(() => todayInTimeZone(settings.timezone));
  const [debounced] = useDebounce(settings, PREVIEW_DEBOUNCE_MS);
  // Both must hold: `debounced` lags the form, so it may still be a value
  // from before the form became valid.
  const [debouncedValid] = useDebounce(valid, PREVIEW_DEBOUNCE_MS);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const scrollRatio = useRef(0);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.source !== frameRef.current?.contentWindow) return;
      const message = event.data as { type?: unknown; ratio?: unknown };
      if (
        message?.type === PREVIEW_SCROLL_MESSAGE &&
        typeof message.ratio === "number"
      ) {
        scrollRatio.current = message.ratio;
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  const { data, isFetching, isError, error } = useQuery({
    queryKey: [...prayerPdfQueryKey(scope), "preview", day, debounced],
    queryFn: () => previewPrayerPdf(scope, debounced, day),
    enabled: valid && debouncedValid && Boolean(day),
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,
    staleTime: 60_000,
  });

  const srcDoc = useMemo(
    () =>
      data
        ? withPreviewBase(data.html, { scrollRatio: scrollRatio.current })
        : undefined,
    [data],
  );

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <label htmlFor="prayer-pdf-preview-day" className="text-sm font-bold">
            Preview
          </label>
          <Pecha.Input
            id="prayer-pdf-preview-day"
            type="date"
            value={day}
            onChange={(e) => e.target.value && setDay(e.target.value)}
            className="h-8 w-40"
            aria-label="Preview day"
          />
          {isFetching ? (
            <LuLoaderCircle
              className="h-4 w-4 animate-spin text-muted-foreground"
              aria-label="Updating preview"
            />
          ) : null}
        </div>
        <p className="text-xs text-muted-foreground" aria-live="polite">
          {!valid
            ? "Fix the highlighted values to update the preview."
            : data?.is_sample
              ? "No prayer requests on this day — showing sample requests."
              : data
                ? `${data.prayer_count} prayer request${data.prayer_count === 1 ? "" : "s"} on this day.`
                : null}
        </p>
      </div>

      <div className="relative min-h-[60vh] flex-1 overflow-hidden rounded-md border bg-[#d9d4cc] lg:min-h-0">
        {srcDoc ? (
          <iframe
            ref={frameRef}
            title="Prayer PDF preview"
            // Scripts lay the page out; no same-origin, so the frame cannot
            // reach Studio's session or storage.
            sandbox="allow-scripts"
            srcDoc={srcDoc}
            className="absolute inset-0 h-full w-full border-0"
          />
        ) : (
          <div className="flex h-full items-center justify-center p-6 text-center text-sm text-muted-foreground">
            {isError
              ? getApiErrorMessage(error, "Could not load the preview.")
              : "Loading preview…"}
          </div>
        )}
        {isError && srcDoc ? (
          <div className="absolute inset-x-0 bottom-0 bg-destructive/90 px-3 py-1.5 text-xs text-white">
            {getApiErrorMessage(error, "Could not update the preview.")}
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default PrayerPdfPreview;
