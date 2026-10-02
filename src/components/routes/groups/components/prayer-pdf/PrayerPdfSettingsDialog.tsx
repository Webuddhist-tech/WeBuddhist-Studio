import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Pecha } from "@/components/ui/shadimport";
import { Button } from "@/components/ui/atoms/button";
import { Textarea } from "@/components/ui/atoms/textarea";
import { getApiErrorMessage } from "@/lib/apiErrors";
import {
  ZABTIK_DROLCHOK_TEMPLATE,
  fetchPrayerPdfSettings,
  prayerPdfQueryKey,
  resetPrayerPdfSettings,
  updatePrayerPdfSettings,
  type PrayerPdfPageSize,
  type PrayerPdfScope,
  type PrayerPdfSettings,
  type PrayerPdfSettingsPayload,
} from "../../api/prayerPdfApi";
import PrayerPdfPreview from "./PrayerPdfPreview";

interface PrayerPdfSettingsDialogProps {
  scope: PrayerPdfScope;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type TextKey = {
  [K in keyof PrayerPdfSettingsPayload]: PrayerPdfSettingsPayload[K] extends
    | string
    | null
    ? K
    : never;
}[keyof PrayerPdfSettingsPayload];

const PAGE_SIZES: { value: PrayerPdfPageSize; label: string }[] = [
  { value: "A3", label: "A3 (297 × 420 mm)" },
  { value: "A4", label: "A4 (210 × 297 mm)" },
];

const COLUMN_OPTIONS = [2, 3, 4, 5, 6];
const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;

const NULLABLE_TEXT_KEYS: TextKey[] = [
  "title_bo",
  "title",
  "title_zh",
  "subtitle_bo",
  "subtitle",
  "subtitle_zh",
  "day_one",
  "closing_bo",
  "closing_mantra",
  "closing_zh",
  "closing_en",
  "closing_emoji",
  "skip_messages",
];

const supportedTimeZones = (): string[] => {
  const intl = Intl as unknown as {
    supportedValuesOf?: (key: string) => string[];
  };
  try {
    return intl.supportedValuesOf?.("timeZone") ?? [];
  } catch {
    return [];
  }
};

const toPayload = (settings: PrayerPdfSettings): PrayerPdfSettingsPayload => ({
  title_bo: settings.title_bo,
  title: settings.title,
  title_zh: settings.title_zh,
  subtitle_bo: settings.subtitle_bo,
  subtitle: settings.subtitle,
  subtitle_zh: settings.subtitle_zh,
  day_one: settings.day_one,
  closing_bo: settings.closing_bo,
  closing_mantra: settings.closing_mantra,
  closing_zh: settings.closing_zh,
  closing_en: settings.closing_en,
  closing_emoji: settings.closing_emoji,
  skip_messages: settings.skip_messages,
  timezone: settings.timezone,
  page_size: settings.page_size,
  columns: settings.columns,
  primary_color: settings.primary_color,
  secondary_color: settings.secondary_color,
});

const blankToNull = (value: string | null): string | null => {
  const trimmed = (value ?? "").trim();
  return trimmed ? trimmed : null;
};

const colorProblem = (form: PrayerPdfSettingsPayload): string | null => {
  for (const [key, label] of [
    ["primary_color", "Main color"],
    ["secondary_color", "Accent color"],
  ] as const) {
    if (!HEX_COLOR.test(form[key])) {
      return `${label} must be a hex color like #7a1f1f`;
    }
  }
  return null;
};

/** What Save sends, and what the preview renders: trimmed, blanks as null. */
const toRequest = (
  form: PrayerPdfSettingsPayload,
): PrayerPdfSettingsPayload => {
  const payload = { ...form, timezone: form.timezone.trim() };
  for (const key of NULLABLE_TEXT_KEYS) {
    (payload as Record<TextKey, string | null>)[key] = blankToNull(
      payload[key],
    );
  }
  return payload;
};

const sourceNote = (scope: PrayerPdfScope, settings: PrayerPdfSettings) => {
  if (scope.kind === "event") {
    if (settings.source === "EVENT")
      return "This event has its own PDF settings.";
    if (settings.source === "GROUP")
      return "Using the group's PDF settings. Saving here gives this event its own.";
  } else if (settings.source === "GROUP") {
    return "Events without their own settings use these too.";
  }
  return (
    "Using the default text. Saving creates settings for this " +
    (scope.kind === "event" ? "event." : "group, which its events also use.")
  );
};

const SectionTitle = ({ children }: { children: React.ReactNode }) => (
  <h3 className="border-b border-dashed pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
    {children}
  </h3>
);

const PrayerPdfSettingsDialog = ({
  scope,
  open,
  onOpenChange,
}: PrayerPdfSettingsDialogProps) => {
  const queryClient = useQueryClient();
  const queryKey = prayerPdfQueryKey(scope);
  const timeZones = useMemo(supportedTimeZones, []);

  const { data, isLoading, isError, error } = useQuery({
    queryKey,
    queryFn: () => fetchPrayerPdfSettings(scope),
    enabled: open,
    refetchOnWindowFocus: false,
  });

  const [form, setForm] = useState<PrayerPdfSettingsPayload | null>(null);
  useEffect(() => {
    if (open && data) setForm(toPayload(data));
    if (!open) setForm(null);
  }, [open, data]);

  const onSaved = (saved: PrayerPdfSettings, message: string) => {
    queryClient.setQueryData(queryKey, saved);
    // An event without its own row reads its group's, so a group change can
    // move any event's settings too.
    queryClient.invalidateQueries({ queryKey: ["cms-prayer-pdf-settings"] });
    toast.success(message);
  };

  const saveMutation = useMutation({
    mutationFn: (payload: PrayerPdfSettingsPayload) =>
      updatePrayerPdfSettings(scope, payload),
    onSuccess: (saved) => {
      onSaved(saved, "Prayer PDF settings saved");
      onOpenChange(false);
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  const resetMutation = useMutation({
    mutationFn: () => resetPrayerPdfSettings(scope),
    onSuccess: (saved) => {
      onSaved(
        saved,
        scope.kind === "event"
          ? "Event now uses the group's settings"
          : "Prayer PDF settings reset to defaults",
      );
      setForm(toPayload(saved));
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  const ownsSettings =
    data?.source === (scope.kind === "event" ? "EVENT" : "GROUP");
  const busy = saveMutation.isPending || resetMutation.isPending;

  const set = <K extends keyof PrayerPdfSettingsPayload>(
    key: K,
    value: PrayerPdfSettingsPayload[K],
  ) => setForm((prev) => (prev ? { ...prev, [key]: value } : prev));

  const textField = (
    key: TextKey,
    label: string,
    options: {
      multiline?: boolean;
      rows?: number;
      hint?: string;
      placeholder?: string;
    } = {},
  ) => {
    const id = `prayer-pdf-${key}`;
    const value = form?.[key] ?? "";
    return (
      <div className="space-y-1.5">
        <label htmlFor={id} className="text-sm font-bold">
          {label}
        </label>
        {options.multiline ? (
          <Textarea
            id={id}
            value={value}
            rows={options.rows ?? 3}
            placeholder={options.placeholder}
            onChange={(e) => set(key, e.target.value)}
          />
        ) : (
          <Pecha.Input
            id={id}
            value={value}
            placeholder={options.placeholder}
            onChange={(e) => set(key, e.target.value)}
          />
        )}
        {options.hint ? (
          <p className="text-xs text-muted-foreground">{options.hint}</p>
        ) : null}
      </div>
    );
  };

  const colorField = (
    key: "primary_color" | "secondary_color",
    label: string,
  ) => {
    const value = form?.[key] ?? "";
    return (
      <div className="space-y-1.5">
        <label htmlFor={`prayer-pdf-${key}`} className="text-sm font-bold">
          {label}
        </label>
        <div className="flex items-center gap-2">
          <Pecha.Input
            id={`prayer-pdf-${key}`}
            value={value}
            onChange={(e) => set(key, e.target.value)}
            className="font-mono"
          />
          <input
            type="color"
            aria-label={`Pick ${label.toLowerCase()}`}
            value={HEX_COLOR.test(value) ? value : "#000000"}
            onChange={(e) => set(key, e.target.value)}
            className="h-9 w-10 shrink-0 cursor-pointer rounded border border-input bg-transparent p-0.5"
          />
        </div>
      </div>
    );
  };

  const applyTemplate = () => {
    setForm((prev) => (prev ? { ...prev, ...ZABTIK_DROLCHOK_TEMPLATE } : prev));
    toast.success("Filled in the Zabtik Drolchok text. Review and save.");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    const problem = colorProblem(form);
    if (problem) {
      toast.error(problem);
      return;
    }
    if (!form.timezone.trim()) {
      toast.error("Timezone is required");
      return;
    }
    saveMutation.mutate(toRequest(form));
  };

  const previewRequest = useMemo(() => (form ? toRequest(form) : null), [form]);
  const previewValid =
    form != null && colorProblem(form) == null && form.timezone.trim() !== "";

  return (
    <Pecha.Dialog open={open} onOpenChange={onOpenChange}>
      <Pecha.DialogContent className="flex h-[92vh] max-w-[calc(100%-1rem)] flex-col p-4 sm:max-w-[min(96vw,1400px)] sm:p-6">
        <Pecha.DialogHeader>
          <Pecha.DialogTitle>Prayer request PDF</Pecha.DialogTitle>
        </Pecha.DialogHeader>

        {isLoading || (!form && !isError) ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Loading settings…
          </p>
        ) : isError || !form || !data ? (
          <p className="py-8 text-center text-sm text-destructive">
            {getApiErrorMessage(error, "Could not load the PDF settings.")}
          </p>
        ) : (
          <div className="grid min-h-0 flex-1 gap-5 overflow-y-auto lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:overflow-hidden">
            <form
              onSubmit={handleSubmit}
              className="space-y-5 lg:min-h-0 lg:overflow-y-auto lg:pr-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-muted px-3 py-2">
                <p className="text-xs text-muted-foreground">
                  {sourceNote(scope, data)}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={applyTemplate}
                  disabled={busy}
                >
                  Fill Zabtik Drolchok text
                </Button>
              </div>

              <section className="space-y-3">
                <SectionTitle>Header</SectionTitle>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {textField("title_bo", "Tibetan title")}
                  {textField("title", "Title")}
                  {textField("title_zh", "Chinese title")}
                </div>
                {textField("subtitle_bo", "Tibetan subtitle")}
                {textField("subtitle", "Subtitle", {
                  multiline: true,
                  rows: 2,
                })}
                {textField("subtitle_zh", "Chinese subtitle")}
                <div className="space-y-1.5">
                  <label
                    htmlFor="prayer-pdf-day_one"
                    className="text-sm font-bold"
                  >
                    Day 1 date
                  </label>
                  <div className="flex items-center gap-2">
                    <Pecha.Input
                      id="prayer-pdf-day_one"
                      type="date"
                      value={form.day_one ?? ""}
                      onChange={(e) => set("day_one", e.target.value || null)}
                      className="max-w-48"
                    />
                    {form.day_one ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => set("day_one", null)}
                      >
                        Clear
                      </Button>
                    ) : null}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Shows the &ldquo;Day: n&rdquo; badge, counting from this
                    date. Leave empty for no badge.
                  </p>
                </div>
              </section>

              <section className="space-y-3">
                <SectionTitle>Closing prayer</SectionTitle>
                {textField("closing_bo", "Tibetan verses", {
                  multiline: true,
                  hint: "One printed line per line.",
                })}
                {textField("closing_mantra", "Mantra")}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {textField("closing_zh", "Chinese translation", {
                    multiline: true,
                  })}
                  {textField("closing_en", "English translation", {
                    multiline: true,
                  })}
                </div>
                {textField("closing_emoji", "Closing emoji")}
              </section>

              <section className="space-y-3">
                <SectionTitle>Layout</SectionTitle>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <span className="text-sm font-bold">Page size</span>
                    <Pecha.Select
                      value={form.page_size}
                      onValueChange={(value) =>
                        set("page_size", value as PrayerPdfPageSize)
                      }
                    >
                      <Pecha.SelectTrigger
                        aria-label="Page size"
                        className="w-full"
                      >
                        <Pecha.SelectValue />
                      </Pecha.SelectTrigger>
                      <Pecha.SelectContent>
                        {PAGE_SIZES.map((size) => (
                          <Pecha.SelectItem key={size.value} value={size.value}>
                            {size.label}
                          </Pecha.SelectItem>
                        ))}
                      </Pecha.SelectContent>
                    </Pecha.Select>
                  </div>
                  <div className="space-y-1.5">
                    <span className="text-sm font-bold">Columns</span>
                    <Pecha.Select
                      value={String(form.columns)}
                      onValueChange={(value) => set("columns", Number(value))}
                    >
                      <Pecha.SelectTrigger
                        aria-label="Columns"
                        className="w-full"
                      >
                        <Pecha.SelectValue />
                      </Pecha.SelectTrigger>
                      <Pecha.SelectContent>
                        {COLUMN_OPTIONS.map((n) => (
                          <Pecha.SelectItem key={n} value={String(n)}>
                            {n}
                          </Pecha.SelectItem>
                        ))}
                      </Pecha.SelectContent>
                    </Pecha.Select>
                  </div>
                  {colorField("primary_color", "Main color")}
                  {colorField("secondary_color", "Accent color")}
                  <div className="space-y-1.5 sm:col-span-2">
                    <label
                      htmlFor="prayer-pdf-timezone"
                      className="text-sm font-bold"
                    >
                      Timezone
                    </label>
                    <Pecha.Input
                      id="prayer-pdf-timezone"
                      value={form.timezone}
                      onChange={(e) => set("timezone", e.target.value)}
                      list="prayer-pdf-timezones"
                      placeholder="Asia/Kolkata"
                    />
                    <datalist id="prayer-pdf-timezones">
                      {timeZones.map((zone) => (
                        <option key={zone} value={zone} />
                      ))}
                    </datalist>
                    <p className="text-xs text-muted-foreground">
                      Decides which day a prayer request falls on.
                    </p>
                  </div>
                </div>
              </section>

              <section className="space-y-3">
                <SectionTitle>Filtering</SectionTitle>
                {textField("skip_messages", "Messages to leave out", {
                  multiline: true,
                  hint: "One per line. Requests that say exactly this (any case) are app feedback, not prayers.",
                  placeholder: "no sound la",
                })}
              </section>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                {ownsSettings ? (
                  <Button
                    type="button"
                    variant="ghost"
                    className="text-muted-foreground"
                    onClick={() => resetMutation.mutate()}
                    disabled={busy}
                  >
                    {scope.kind === "event"
                      ? "Use group settings"
                      : "Reset to defaults"}
                  </Button>
                ) : (
                  <span />
                )}
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => onOpenChange(false)}
                    disabled={busy}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={busy}>
                    {saveMutation.isPending ? "Saving…" : "Save"}
                  </Button>
                </div>
              </div>
            </form>
            {previewRequest ? (
              <PrayerPdfPreview
                scope={scope}
                settings={previewRequest}
                valid={previewValid}
              />
            ) : null}
          </div>
        )}
      </Pecha.DialogContent>
    </Pecha.Dialog>
  );
};

export default PrayerPdfSettingsDialog;
