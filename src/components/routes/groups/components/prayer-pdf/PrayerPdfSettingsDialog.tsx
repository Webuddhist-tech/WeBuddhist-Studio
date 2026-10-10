import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTranslate } from "@tolgee/react";
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
  { value: "A3", label: "studio.groups.prayer_pdf.settings.page_size_a3" },
  { value: "A4", label: "studio.groups.prayer_pdf.settings.page_size_a4" },
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

/** The translation key of the first color field's label that is not a valid hex color. */
const colorProblem = (form: PrayerPdfSettingsPayload): string | null => {
  for (const [key, labelKey] of [
    ["primary_color", "studio.groups.prayer_pdf.settings.main_color"],
    ["secondary_color", "studio.groups.prayer_pdf.settings.accent_color"],
  ] as const) {
    if (!HEX_COLOR.test(form[key])) {
      return labelKey;
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

/** Translation key of the note on where the shown settings come from. */
const sourceNote = (scope: PrayerPdfScope, settings: PrayerPdfSettings) => {
  if (scope.kind === "event") {
    if (settings.source === "EVENT")
      return "studio.groups.prayer_pdf.settings.source_event_own";
    if (settings.source === "GROUP")
      return "studio.groups.prayer_pdf.settings.source_event_group";
  } else if (settings.source === "GROUP") {
    return "studio.groups.prayer_pdf.settings.source_group_own";
  }
  return scope.kind === "event"
    ? "studio.groups.prayer_pdf.settings.source_default_event"
    : "studio.groups.prayer_pdf.settings.source_default_group";
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
  const { t } = useTranslate();
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
      onSaved(saved, t("studio.groups.prayer_pdf.settings.saved_toast"));
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
          ? t("studio.groups.prayer_pdf.settings.reset_event_toast")
          : t("studio.groups.prayer_pdf.settings.reset_group_toast"),
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
            aria-label={t("studio.groups.prayer_pdf.settings.pick_color", {
              label: label.toLowerCase(),
            })}
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
    toast.success(
      t("studio.groups.prayer_pdf.settings.template_applied_toast"),
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    const problem = colorProblem(form);
    if (problem) {
      toast.error(
        t("studio.groups.prayer_pdf.settings.color_invalid", {
          label: t(problem),
        }),
      );
      return;
    }
    if (!form.timezone.trim()) {
      toast.error(t("studio.groups.prayer_pdf.settings.timezone_required"));
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
          <Pecha.DialogTitle>
            {t("studio.groups.prayer_pdf.settings.title")}
          </Pecha.DialogTitle>
        </Pecha.DialogHeader>

        {isLoading || (!form && !isError) ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {t("studio.groups.prayer_pdf.settings.loading")}
          </p>
        ) : isError || !form || !data ? (
          <p className="py-8 text-center text-sm text-destructive">
            {getApiErrorMessage(
              error,
              t("studio.groups.prayer_pdf.settings.load_error"),
            )}
          </p>
        ) : (
          <div className="grid min-h-0 flex-1 gap-5 overflow-y-auto lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:overflow-hidden">
            <form
              onSubmit={handleSubmit}
              className="space-y-5 lg:min-h-0 lg:overflow-y-auto lg:pr-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-muted px-3 py-2">
                <p className="text-xs text-muted-foreground">
                  {t(sourceNote(scope, data))}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={applyTemplate}
                  disabled={busy}
                >
                  {t("studio.groups.prayer_pdf.settings.fill_template")}
                </Button>
              </div>

              <section className="space-y-3">
                <SectionTitle>
                  {t("studio.groups.prayer_pdf.settings.section_header")}
                </SectionTitle>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {textField(
                    "title_bo",
                    t("studio.groups.prayer_pdf.settings.tibetan_title"),
                  )}
                  {textField("title", t("studio.common.title"))}
                  {textField(
                    "title_zh",
                    t("studio.groups.prayer_pdf.settings.chinese_title"),
                  )}
                </div>
                {textField(
                  "subtitle_bo",
                  t("studio.groups.prayer_pdf.settings.tibetan_subtitle"),
                )}
                {textField(
                  "subtitle",
                  t("studio.groups.prayer_pdf.settings.subtitle"),
                  {
                    multiline: true,
                    rows: 2,
                  },
                )}
                {textField(
                  "subtitle_zh",
                  t("studio.groups.prayer_pdf.settings.chinese_subtitle"),
                )}
                <div className="space-y-1.5">
                  <label
                    htmlFor="prayer-pdf-day_one"
                    className="text-sm font-bold"
                  >
                    {t("studio.groups.prayer_pdf.settings.day_one")}
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
                        {t("studio.common.clear")}
                      </Button>
                    ) : null}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t("studio.groups.prayer_pdf.settings.day_one_hint")}
                  </p>
                </div>
              </section>

              <section className="space-y-3">
                <SectionTitle>
                  {t("studio.groups.prayer_pdf.settings.section_closing")}
                </SectionTitle>
                {textField(
                  "closing_bo",
                  t("studio.groups.prayer_pdf.settings.tibetan_verses"),
                  {
                    multiline: true,
                    hint: t(
                      "studio.groups.prayer_pdf.settings.tibetan_verses_hint",
                    ),
                  },
                )}
                {textField(
                  "closing_mantra",
                  t("studio.groups.prayer_pdf.settings.mantra"),
                )}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {textField(
                    "closing_zh",
                    t("studio.groups.prayer_pdf.settings.chinese_translation"),
                    {
                      multiline: true,
                    },
                  )}
                  {textField(
                    "closing_en",
                    t("studio.groups.prayer_pdf.settings.english_translation"),
                    {
                      multiline: true,
                    },
                  )}
                </div>
                {textField(
                  "closing_emoji",
                  t("studio.groups.prayer_pdf.settings.closing_emoji"),
                )}
              </section>

              <section className="space-y-3">
                <SectionTitle>
                  {t("studio.groups.prayer_pdf.settings.section_layout")}
                </SectionTitle>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <span className="text-sm font-bold">
                      {t("studio.groups.prayer_pdf.settings.page_size")}
                    </span>
                    <Pecha.Select
                      value={form.page_size}
                      onValueChange={(value) =>
                        set("page_size", value as PrayerPdfPageSize)
                      }
                    >
                      <Pecha.SelectTrigger
                        aria-label={t(
                          "studio.groups.prayer_pdf.settings.page_size",
                        )}
                        className="w-full"
                      >
                        <Pecha.SelectValue />
                      </Pecha.SelectTrigger>
                      <Pecha.SelectContent>
                        {PAGE_SIZES.map((size) => (
                          <Pecha.SelectItem key={size.value} value={size.value}>
                            {t(size.label)}
                          </Pecha.SelectItem>
                        ))}
                      </Pecha.SelectContent>
                    </Pecha.Select>
                  </div>
                  <div className="space-y-1.5">
                    <span className="text-sm font-bold">
                      {t("studio.groups.prayer_pdf.settings.columns")}
                    </span>
                    <Pecha.Select
                      value={String(form.columns)}
                      onValueChange={(value) => set("columns", Number(value))}
                    >
                      <Pecha.SelectTrigger
                        aria-label={t(
                          "studio.groups.prayer_pdf.settings.columns",
                        )}
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
                  {colorField(
                    "primary_color",
                    t("studio.groups.prayer_pdf.settings.main_color"),
                  )}
                  {colorField(
                    "secondary_color",
                    t("studio.groups.prayer_pdf.settings.accent_color"),
                  )}
                  <div className="space-y-1.5 sm:col-span-2">
                    <label
                      htmlFor="prayer-pdf-timezone"
                      className="text-sm font-bold"
                    >
                      {t("studio.groups.prayer_pdf.settings.timezone")}
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
                      {t("studio.groups.prayer_pdf.settings.timezone_hint")}
                    </p>
                  </div>
                </div>
              </section>

              <section className="space-y-3">
                <SectionTitle>
                  {t("studio.groups.prayer_pdf.settings.section_filtering")}
                </SectionTitle>
                {textField(
                  "skip_messages",
                  t("studio.groups.prayer_pdf.settings.skip_messages"),
                  {
                    multiline: true,
                    hint: t(
                      "studio.groups.prayer_pdf.settings.skip_messages_hint",
                    ),
                    placeholder: "no sound la",
                  },
                )}
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
                      ? t(
                          "studio.groups.prayer_pdf.settings.use_group_settings",
                        )
                      : t(
                          "studio.groups.prayer_pdf.settings.reset_to_defaults",
                        )}
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
                    {t("studio.common.cancel")}
                  </Button>
                  <Button type="submit" disabled={busy}>
                    {saveMutation.isPending
                      ? t("studio.common.saving")
                      : t("studio.common.save")}
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
