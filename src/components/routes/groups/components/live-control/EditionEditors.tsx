import { useState } from "react";
import { useTranslate } from "@tolgee/react";
import { LuPlus, LuSparkles, LuTrash2 } from "react-icons/lu";
import { Pecha } from "@/components/ui/shadimport";
import { cn } from "@/lib/utils";
import {
  MAX_TIMES,
  type RepeatedSegment,
  type ReturnJump,
} from "../../api/liveControlSettingsApi";
import { SegmentPickerDialog } from "./SegmentPickerDialog";
import {
  keyFromLabel,
  lineLabel,
  RETURN_LABEL_LANGUAGES,
  type EditionLine,
} from "./editionHelpers";

export interface SectionRow {
  sectionId: string;
  /** The section's title in the table of contents. */
  sectionTitle: string;
  depth: number;
  title: string;
  icon: string;
  /** Filled by AI and not yet saved. */
  suggested: boolean;
}

const TimesStepper = ({
  value,
  min,
  onChange,
  label,
}: {
  value: number;
  min: number;
  onChange: (value: number) => void;
  label: string;
}) => {
  const { t } = useTranslate();
  return (
    <div
      role="group"
      aria-label={label}
      className="inline-flex items-center overflow-hidden rounded-md border bg-background"
    >
      <button
        type="button"
        aria-label={t("studio.live_settings.edition.fewer")}
        disabled={value <= min}
        onClick={() => onChange(value - 1)}
        className="h-8 w-8 hover:bg-accent disabled:opacity-40"
      >
        −
      </button>
      <span className="min-w-8 text-center text-sm font-semibold tabular-nums">
        {value}
      </span>
      <button
        type="button"
        aria-label={t("studio.live_settings.edition.more")}
        disabled={value >= MAX_TIMES}
        onClick={() => onChange(value + 1)}
        className="h-8 w-8 hover:bg-accent disabled:opacity-40"
      >
        +
      </button>
    </div>
  );
};

// --- Short titles -------------------------------------------------------------

export const ShortTitlesEditor = ({
  rows,
  onChange,
  onSuggest,
  suggesting,
  onDownloadTemplate,
}: {
  rows: SectionRow[];
  onChange: (rows: SectionRow[]) => void;
  onSuggest: (mode: "empty" | "all") => void;
  suggesting: boolean;
  onDownloadTemplate: () => void;
}) => {
  const { t } = useTranslate();
  const [aiOpen, setAiOpen] = useState(false);
  const [mode, setMode] = useState<"empty" | "all">("empty");
  const suggested = rows.filter((row) => row.suggested).length;
  const update = (index: number, patch: Partial<SectionRow>) =>
    onChange(
      rows.map((row, i) =>
        i === index ? { ...row, ...patch, suggested: false } : row,
      ),
    );

  return (
    <section
      aria-labelledby="live-short-titles"
      className="space-y-4 rounded-2xl border bg-card p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-xl space-y-1">
          <h2 id="live-short-titles" className="text-base font-semibold">
            {t("studio.live_settings.edition.short_titles")}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t("studio.live_settings.edition.short_titles_help")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Pecha.Button
            type="button"
            size="sm"
            variant="outline"
            onClick={onDownloadTemplate}
          >
            {t("studio.live_settings.edition.download_template")}
          </Pecha.Button>
          <Pecha.Button
            type="button"
            size="sm"
            variant="outline"
            disabled={rows.length === 0}
            onClick={() => setAiOpen((open) => !open)}
          >
            <LuSparkles className="h-4 w-4" />
            {t("studio.live_settings.edition.fill_with_ai")}
          </Pecha.Button>
        </div>
      </div>

      {aiOpen ? (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-dashed bg-muted/30 p-3">
          <span className="text-sm font-medium">
            {t("studio.live_settings.edition.ai_for")}
          </span>
          {(["empty", "all"] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={mode === value}
              onClick={() => setMode(value)}
              className={cn(
                "rounded-full border px-3 py-1 text-sm",
                mode === value
                  ? "border-[#A51C21] bg-[#A51C21]/10 text-foreground"
                  : "border-input text-muted-foreground hover:text-foreground",
              )}
            >
              {value === "empty"
                ? t("studio.live_settings.edition.ai_empty_rows")
                : t("studio.live_settings.edition.ai_all_rows")}
            </button>
          ))}
          <span className="min-w-[12rem] flex-1 text-xs text-muted-foreground">
            {t("studio.live_settings.edition.ai_help")}
          </span>
          <Pecha.Button
            type="button"
            size="sm"
            disabled={suggesting}
            onClick={() => {
              onSuggest(mode);
              setAiOpen(false);
            }}
          >
            {suggesting
              ? t("studio.live_settings.edition.suggesting")
              : t("studio.live_settings.edition.suggest")}
          </Pecha.Button>
        </div>
      ) : null}

      {suggested > 0 ? (
        <p className="text-sm">
          <Pecha.Badge variant="secondary" className="mr-2">
            {t("studio.live_settings.edition.suggested_count", {
              count: suggested,
            })}
          </Pecha.Badge>
          <span className="text-muted-foreground">
            {t("studio.live_settings.edition.review_then_save")}
          </span>
        </p>
      ) : null}

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {t("studio.live_settings.edition.no_sections")}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="w-8 px-2 py-2 font-medium">#</th>
                <th className="px-2 py-2 font-medium">
                  {t("studio.live_settings.edition.section")}
                </th>
                <th className="px-2 py-2 font-medium">
                  {t("studio.live_settings.edition.short_title")}
                </th>
                <th className="w-28 px-2 py-2 font-medium">
                  {t("studio.live_settings.edition.icon")}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr
                  key={row.sectionId}
                  className={cn(
                    "border-b last:border-0",
                    row.suggested && "bg-amber-50 dark:bg-amber-950/30",
                  )}
                >
                  <td className="px-2 py-2 text-muted-foreground tabular-nums">
                    {index + 1}
                  </td>
                  <td
                    className="px-2 py-2"
                    style={{ paddingLeft: `${0.5 + row.depth * 1}rem` }}
                  >
                    <span className="text-muted-foreground">
                      {row.sectionTitle || row.sectionId}
                    </span>
                  </td>
                  <td className="px-2 py-2">
                    <Pecha.Input
                      aria-label={t("studio.live_settings.edition.short_title")}
                      value={row.title}
                      maxLength={120}
                      className="min-w-[14rem]"
                      onChange={(e) => update(index, { title: e.target.value })}
                    />
                  </td>
                  <td className="px-2 py-2">
                    <div className="flex items-center gap-2">
                      <Pecha.Input
                        aria-label={t("studio.live_settings.edition.icon")}
                        value={row.icon}
                        maxLength={16}
                        className="w-14 text-center text-lg"
                        onChange={(e) =>
                          update(index, { icon: e.target.value })
                        }
                      />
                      {row.suggested ? (
                        <Pecha.Badge variant="secondary">
                          {t("studio.live_settings.edition.suggested")}
                        </Pecha.Badge>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        {t("studio.live_settings.edition.order_on_controller")}
      </p>
    </section>
  );
};

// --- Repeated segments --------------------------------------------------------

export const RepeatedSegmentsEditor = ({
  rows,
  lines,
  onChange,
}: {
  rows: RepeatedSegment[];
  lines: EditionLine[];
  onChange: (rows: RepeatedSegment[]) => void;
}) => {
  const { t } = useTranslate();
  const [picking, setPicking] = useState<number | null>(null);
  const label = (id: string) =>
    lineLabel(
      lines,
      id,
      t("studio.live_settings.edition.pick_segment"),
      t("studio.live_settings.edition.line"),
    );

  return (
    <section
      aria-labelledby="live-repeats"
      className="space-y-4 rounded-2xl border bg-card p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-xl space-y-1">
          <h2 id="live-repeats" className="text-base font-semibold">
            {t("studio.live_settings.edition.repeated_segments")}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t("studio.live_settings.edition.repeated_segments_help")}
          </p>
        </div>
        <Pecha.Button
          type="button"
          size="sm"
          onClick={() => {
            onChange([...rows, { segment_id: "", times: 2 }]);
            setPicking(rows.length);
          }}
        >
          <LuPlus className="h-4 w-4" />
          {t("studio.live_settings.edition.add_repeated_segment")}
        </Pecha.Button>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {t("studio.live_settings.edition.no_repeats")}
        </p>
      ) : (
        <ul className="space-y-2">
          {rows.map((row, index) => (
            <li
              key={index}
              className="flex flex-wrap items-center gap-3 rounded-lg border p-2"
            >
              <button
                type="button"
                onClick={() => setPicking(index)}
                className="min-w-0 flex-1 rounded-md border border-dashed px-3 py-2 text-left text-sm hover:border-[#A51C21]"
              >
                {label(row.segment_id)}
              </button>
              <TimesStepper
                label={t("studio.live_settings.edition.times")}
                value={row.times}
                min={2}
                onChange={(times) =>
                  onChange(
                    rows.map((r, i) => (i === index ? { ...r, times } : r)),
                  )
                }
              />
              <span className="text-sm text-muted-foreground">
                {t("studio.live_settings.edition.times")}
              </span>
              <Pecha.Button
                type="button"
                size="sm"
                variant="ghost"
                aria-label={t("studio.common.delete")}
                onClick={() => onChange(rows.filter((_, i) => i !== index))}
              >
                <LuTrash2 className="h-4 w-4" />
              </Pecha.Button>
            </li>
          ))}
        </ul>
      )}
      <SegmentPickerDialog
        open={picking !== null}
        title={t("studio.live_settings.edition.pick_repeated")}
        lines={lines}
        selectedId={picking !== null ? rows[picking]?.segment_id : undefined}
        onPick={(segmentId) =>
          picking !== null &&
          onChange(
            rows.map((r, i) =>
              i === picking ? { ...r, segment_id: segmentId } : r,
            ),
          )
        }
        onClose={() => setPicking(null)}
      />
    </section>
  );
};

// --- Return jumps -------------------------------------------------------------

type PickTarget = {
  index: number;
  field: "after_segment_id" | "to_segment_id";
};

export const ReturnJumpsEditor = ({
  rows,
  lines,
  onChange,
}: {
  rows: ReturnJump[];
  lines: EditionLine[];
  onChange: (rows: ReturnJump[]) => void;
}) => {
  const { t } = useTranslate();
  const [picking, setPicking] = useState<PickTarget | null>(null);
  const label = (id: string) =>
    lineLabel(
      lines,
      id,
      t("studio.live_settings.edition.pick_segment"),
      t("studio.live_settings.edition.line"),
    );
  const update = (index: number, patch: Partial<ReturnJump>) =>
    onChange(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));

  return (
    <section
      aria-labelledby="live-returns"
      className="space-y-4 rounded-2xl border bg-card p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-xl space-y-1">
          <h2 id="live-returns" className="text-base font-semibold">
            {t("studio.live_settings.edition.return_jumps")}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t("studio.live_settings.edition.return_jumps_help")}
          </p>
        </div>
        <Pecha.Button
          type="button"
          size="sm"
          onClick={() =>
            onChange([
              ...rows,
              {
                key: keyFromLabel(
                  "return",
                  rows.map((row) => row.key),
                ),
                after_segment_id: "",
                to_segment_id: "",
                times: 1,
                label: {},
              },
            ])
          }
        >
          <LuPlus className="h-4 w-4" />
          {t("studio.live_settings.edition.add_return_jump")}
        </Pecha.Button>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {t("studio.live_settings.edition.no_returns")}
        </p>
      ) : (
        <ul className="space-y-3">
          {rows.map((row, index) => (
            <li key={index} className="space-y-3 rounded-xl border p-3">
              <div className="grid gap-2 sm:grid-cols-3">
                {RETURN_LABEL_LANGUAGES.map((language) => (
                  <Pecha.Input
                    key={language}
                    aria-label={t("studio.live_settings.edition.label_in", {
                      language,
                    })}
                    placeholder={t("studio.live_settings.edition.label_in", {
                      language,
                    })}
                    value={row.label[language] ?? ""}
                    maxLength={200}
                    onChange={(e) =>
                      update(index, {
                        label: { ...row.label, [language]: e.target.value },
                      })
                    }
                  />
                ))}
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {(["after_segment_id", "to_segment_id"] as const).map(
                  (field) => (
                    <div key={field} className="space-y-1">
                      <span className="text-xs font-medium text-muted-foreground">
                        {field === "after_segment_id"
                          ? t("studio.live_settings.edition.after_segment")
                          : t("studio.live_settings.edition.jumps_to")}
                      </span>
                      <button
                        type="button"
                        onClick={() => setPicking({ index, field })}
                        className="w-full rounded-md border border-dashed px-3 py-2 text-left text-sm hover:border-[#A51C21]"
                      >
                        {label(row[field])}
                      </button>
                    </div>
                  ),
                )}
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-sm font-medium">
                  {t("studio.live_settings.edition.times")}
                </span>
                <TimesStepper
                  label={t("studio.live_settings.edition.times")}
                  value={row.times}
                  min={1}
                  onChange={(times) => update(index, { times })}
                />
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  {t("studio.live_settings.edition.key")}
                  <Pecha.Input
                    value={row.key}
                    maxLength={64}
                    className="h-8 w-40 font-mono text-xs"
                    onChange={(e) =>
                      update(index, {
                        key: e.target.value.replace(/[^A-Za-z0-9_.-]/g, ""),
                      })
                    }
                  />
                </label>
                <Pecha.Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="ml-auto text-destructive hover:text-destructive"
                  onClick={() => onChange(rows.filter((_, i) => i !== index))}
                >
                  <LuTrash2 className="h-4 w-4" />
                  {t("studio.common.delete")}
                </Pecha.Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-muted-foreground">
        {t("studio.live_settings.edition.key_help")}
      </p>
      <SegmentPickerDialog
        open={picking !== null}
        title={
          picking?.field === "to_segment_id"
            ? t("studio.live_settings.edition.jumps_to")
            : t("studio.live_settings.edition.after_segment")
        }
        lines={lines}
        selectedId={picking ? rows[picking.index]?.[picking.field] : undefined}
        onPick={(segmentId) =>
          picking && update(picking.index, { [picking.field]: segmentId })
        }
        onClose={() => setPicking(null)}
      />
    </section>
  );
};
