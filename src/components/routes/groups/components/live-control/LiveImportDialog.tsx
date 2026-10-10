import { useRef, useState } from "react";
import { useTranslate } from "@tolgee/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { LuDownload, LuFileJson } from "react-icons/lu";
import { toast } from "sonner";
import { Pecha } from "@/components/ui/shadimport";
import { getApiErrorMessage } from "@/lib/apiErrors";
import {
  downloadJson,
  fetchSettingsExport,
  fetchSettingsSample,
  importSettings,
  liveControlKeys,
  type ImportReport,
} from "../../api/liveControlSettingsApi";

interface Picked {
  name: string;
  content: unknown;
}

/**
 * One JSON file in: checked first, written only once the whole file passes.
 * A list in the file replaces that edition's list; anything left out is kept.
 */
export const LiveImportDialog = ({
  eventId,
  open,
  onOpenChange,
}: {
  eventId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) => {
  const { t } = useTranslate();
  const queryClient = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const [picked, setPicked] = useState<Picked | null>(null);
  const [report, setReport] = useState<ImportReport | null>(null);
  const [readError, setReadError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const reset = () => {
    setPicked(null);
    setReport(null);
    setReadError(null);
  };

  const check = useMutation({
    mutationFn: (file: Picked) =>
      importSettings(file.content, { eventId, dryRun: true }),
    onSuccess: setReport,
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  const apply = useMutation({
    mutationFn: (file: Picked) =>
      importSettings(file.content, { eventId, dryRun: false }),
    onSuccess: (result) => {
      setReport(result);
      if (!result.applied) return;
      queryClient.invalidateQueries({
        queryKey: liveControlKeys.eventSettings(eventId),
      });
      queryClient.invalidateQueries({
        queryKey: ["live-control-edition-settings"],
      });
      toast.success(t("studio.live_settings.import.done"));
      onOpenChange(false);
      reset();
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  const read = async (file: File) => {
    reset();
    try {
      const content: unknown = JSON.parse(await file.text());
      const next = { name: file.name, content };
      setPicked(next);
      check.mutate(next);
    } catch {
      setReadError(
        t("studio.live_settings.import.not_json", { name: file.name }),
      );
    }
  };

  const download = async (which: "sample" | "export") => {
    try {
      if (which === "sample") {
        downloadJson(
          await fetchSettingsSample(),
          "live-control-settings-sample.json",
        );
      } else {
        downloadJson(
          await fetchSettingsExport(eventId),
          "live-control-settings.json",
        );
      }
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    }
  };

  return (
    <Pecha.Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) reset();
      }}
    >
      <Pecha.DialogContent className="sm:max-w-2xl">
        <Pecha.DialogHeader>
          <Pecha.DialogTitle>
            {t("studio.live_settings.import.title")}
          </Pecha.DialogTitle>
        </Pecha.DialogHeader>
        <p className="text-sm text-muted-foreground">
          {t("studio.live_settings.import.description")}
        </p>
        <div className="flex flex-wrap gap-2">
          <Pecha.Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => download("sample")}
          >
            <LuDownload className="h-4 w-4" />
            {t("studio.live_settings.import.sample")}
          </Pecha.Button>
          <Pecha.Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => download("export")}
          >
            <LuDownload className="h-4 w-4" />
            {t("studio.live_settings.import.export_current")}
          </Pecha.Button>
        </div>

        <input
          ref={input}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) read(file);
            e.target.value = "";
          }}
        />
        <button
          type="button"
          onClick={() => input.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            const file = e.dataTransfer.files?.[0];
            if (file) read(file);
          }}
          className={`flex flex-col items-center gap-1.5 rounded-xl border-2 border-dashed p-6 text-center transition-colors ${
            dragging
              ? "border-[#A51C21] bg-[#A51C21]/5"
              : "bg-muted/30 hover:border-[#A51C21]"
          }`}
        >
          <LuFileJson className="h-6 w-6 text-muted-foreground" />
          <span className="text-sm font-medium">
            {picked?.name ?? t("studio.live_settings.import.no_file")}
          </span>
          <span className="text-xs text-muted-foreground">
            {t("studio.live_settings.import.drop")}
          </span>
        </button>

        {readError ? (
          <p className="text-sm text-destructive">{readError}</p>
        ) : null}
        {check.isPending ? (
          <p className="text-sm text-muted-foreground">
            {t("studio.live_settings.import.checking")}
          </p>
        ) : null}

        {report ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Pecha.Badge variant={report.ok ? "outline" : "destructive"}>
                {report.ok
                  ? t("studio.live_settings.import.passed")
                  : t("studio.live_settings.import.failed", {
                      count: report.errors.length,
                    })}
              </Pecha.Badge>
              <span className="text-muted-foreground">
                {t("studio.live_settings.import.editions_count", {
                  count: report.editions.length,
                })}
              </span>
            </div>
            {report.editions.length > 0 ? (
              <div className="max-h-56 overflow-auto rounded-lg border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs text-muted-foreground">
                      <th className="px-2 py-2 font-medium">
                        {t("studio.live_settings.import.edition")}
                      </th>
                      <th className="px-2 py-2 font-medium">
                        {t("studio.live_settings.edition.short_titles")}
                      </th>
                      <th className="px-2 py-2 font-medium">
                        {t("studio.live_settings.edition.repeated_segments")}
                      </th>
                      <th className="px-2 py-2 font-medium">
                        {t("studio.live_settings.edition.return_jumps")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.editions.map((edition) => (
                      <tr
                        key={edition.edition_id}
                        className="border-b last:border-0"
                      >
                        <td className="px-2 py-2 font-mono text-xs">
                          {edition.edition_id}
                        </td>
                        {[
                          edition.short_titles,
                          edition.repeated_segments,
                          edition.return_jumps,
                        ].map((count, index) => (
                          <td key={index} className="px-2 py-2 tabular-nums">
                            {count ?? (
                              <span className="text-muted-foreground">
                                {t("studio.live_settings.import.kept")}
                              </span>
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
            {report.event ? (
              <p className="text-sm text-muted-foreground">
                {t("studio.live_settings.import.event_settings")}
              </p>
            ) : null}
            {report.errors.length > 0 ? (
              <ul className="max-h-48 space-y-1 overflow-auto rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm">
                {report.errors.map((issue, index) => (
                  <li key={`${issue.path}-${index}`}>
                    <code className="text-xs">{issue.path}</code>
                    <span className="text-muted-foreground">
                      : {issue.message}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        <div className="flex justify-end gap-2">
          <Pecha.Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            {t("studio.common.cancel")}
          </Pecha.Button>
          <Pecha.Button
            type="button"
            disabled={!picked || !report?.ok || apply.isPending}
            onClick={() => picked && apply.mutate(picked)}
          >
            {apply.isPending
              ? t("studio.common.saving")
              : t("studio.live_settings.import.import")}
          </Pecha.Button>
        </div>
      </Pecha.DialogContent>
    </Pecha.Dialog>
  );
};
