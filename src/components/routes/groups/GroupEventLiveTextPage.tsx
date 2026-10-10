import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useOutletContext, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslate } from "@tolgee/react";
import { toast } from "sonner";
import { Pecha } from "@/components/ui/shadimport";
import { getLanguageLabel } from "@/components/api/languagesApi";
import { getApiErrorMessage } from "@/lib/apiErrors";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/routes/paths";
import {
  fetchEditionSections,
  resolveEditionId,
} from "@/components/routes/live-control/api/libraryTocApi";
import {
  fetchRecitationDetails,
  fetchTextEditions,
  toOperatorSegments,
  type TextEdition,
} from "@/components/routes/live-control/api/liveControlApi";
import type { GroupOutletContext } from "./GroupLayout";
import { canWriteEvents } from "./lib/eventPermissions";
import {
  downloadJson,
  fetchEditionLiveSettings,
  fetchEditionTemplate,
  issuesFromError,
  liveControlKeys,
  saveEditionLiveSettings,
  suggestShortTitles,
  type ImportIssue,
  type RepeatedSegment,
  type ReturnJump,
} from "./api/liveControlSettingsApi";
import {
  RepeatedSegmentsEditor,
  ReturnJumpsEditor,
  ShortTitlesEditor,
  type SectionRow,
} from "./components/live-control/EditionEditors";

/**
 * Short titles, repeated segments and return jumps of one text, edition by
 * edition. Stored per library edition, so every event reciting the edition
 * shares them; reached from an event only because that is where they are used.
 */
const GroupEventLiveTextPage = () => {
  const { t } = useTranslate();
  const queryClient = useQueryClient();
  const {
    groupId = "",
    eventId = "",
    textId = "",
  } = useParams<{
    groupId: string;
    eventId: string;
    textId: string;
  }>();
  const { myRole, userInfo, readOnlyPlatform } =
    useOutletContext<GroupOutletContext>();
  const canWrite =
    !readOnlyPlatform && canWriteEvents(myRole, userInfo?.platform_role);

  const { data: work, isLoading: editionsLoading } = useQuery({
    queryKey: ["live-control-editions", textId],
    queryFn: () => fetchTextEditions(textId),
    enabled: Boolean(textId) && canWrite,
  });
  const editions: TextEdition[] = useMemo(
    () => (work ? [work.text, ...work.editions] : []),
    [work],
  );
  const [selected, setSelected] = useState<string | null>(null);
  const edition = editions.find((e) => e.textId === selected) ?? editions[0];

  const { data: libraryEditionId } = useQuery({
    queryKey: ["live-control-library-edition", edition?.textId],
    queryFn: () => resolveEditionId(edition!.textId),
    enabled: Boolean(edition),
    staleTime: Infinity,
  });
  const { data: sections } = useQuery({
    queryKey: ["live-control-sections", edition?.textId, edition?.language],
    queryFn: () => fetchEditionSections(edition!.textId, edition!.language),
    enabled: Boolean(edition),
  });
  const { data: lines = [] } = useQuery({
    queryKey: ["live-control-lines", edition?.textId, edition?.language],
    queryFn: async () =>
      toOperatorSegments(
        await fetchRecitationDetails(edition!.textId, edition!.language),
        edition!.language,
      ),
    enabled: Boolean(edition),
  });
  const { data: stored } = useQuery({
    queryKey: liveControlKeys.editionSettings(libraryEditionId ?? ""),
    queryFn: () => fetchEditionLiveSettings(libraryEditionId!),
    enabled: Boolean(libraryEditionId),
  });

  const [titles, setTitles] = useState<SectionRow[]>([]);
  const [repeats, setRepeats] = useState<RepeatedSegment[]>([]);
  const [returns, setReturns] = useState<ReturnJump[]>([]);
  const [issues, setIssues] = useState<ImportIssue[]>([]);

  // Short titles are saved as one list, so the rows wait for both the stored
  // titles and the table of contents: saving before then would drop titles.
  const ready = Boolean(stored && sections);

  useEffect(() => {
    if (!stored || !sections) return;
    const bySection = new Map(
      stored.short_titles.map((row) => [row.section_id, row]),
    );
    setTitles(
      sections.map((section) => ({
        sectionId: section.id,
        sectionTitle: section.fullTitle,
        depth: section.depth,
        title: bySection.get(section.id)?.title ?? "",
        icon: bySection.get(section.id)?.icon ?? "",
        suggested: false,
      })),
    );
    setRepeats(stored.repeated_segments);
    setReturns(stored.return_jumps);
    setIssues([]);
  }, [stored, sections]);

  const save = useMutation({
    mutationFn: () =>
      saveEditionLiveSettings(libraryEditionId!, {
        short_titles: titles.map((row) => ({
          section_id: row.sectionId,
          title: row.title.trim(),
          icon: row.icon.trim(),
        })),
        repeated_segments: repeats.filter((row) => row.segment_id),
        return_jumps: returns,
      }),
    onSuccess: (settings) => {
      queryClient.setQueryData(
        liveControlKeys.editionSettings(settings.edition_id),
        settings,
      );
      setIssues([]);
      toast.success(t("studio.live_settings.edition.saved"));
    },
    onError: (error) => {
      const found = issuesFromError(error);
      setIssues(found);
      toast.error(
        found.length > 0
          ? t("studio.live_settings.edition.save_issues", {
              count: found.length,
            })
          : getApiErrorMessage(error),
      );
    },
  });

  /** Fills the rows the mode asks for; nothing is saved until Save. */
  const suggest = useMutation({
    mutationFn: async (mode: "empty" | "all") => ({
      mode,
      suggestions: await suggestShortTitles(libraryEditionId!),
    }),
    onSuccess: ({ mode, suggestions }) => {
      const bySection = new Map(suggestions.map((s) => [s.section_id, s]));
      setTitles((rows) =>
        rows.map((row) => {
          const suggestion = bySection.get(row.sectionId);
          const fill =
            suggestion && (mode === "all" || (!row.title && !row.icon));
          return fill
            ? {
                ...row,
                title: suggestion.title,
                icon: suggestion.icon,
                suggested: true,
              }
            : row;
        }),
      );
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  if (!canWrite)
    return <Navigate to={ROUTES.groupEvent(groupId, eventId)} replace />;

  const downloadTemplate = async () => {
    if (!libraryEditionId) return;
    try {
      downloadJson(
        await fetchEditionTemplate(libraryEditionId),
        `live-control-${libraryEditionId}.json`,
      );
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <Link
          to={ROUTES.groupEventLive(groupId, eventId)}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← {t("studio.live_settings.title")}
        </Link>
        <h1 className="text-2xl font-bold">{work?.text.title ?? textId}</h1>
        <p className="text-sm text-muted-foreground">
          {t("studio.live_settings.edition.description")}
        </p>
      </div>

      {editionsLoading ? (
        <p className="text-sm text-muted-foreground">
          {t("studio.common.loading")}
        </p>
      ) : (
        <div
          role="tablist"
          aria-label={t("studio.live_settings.edition.editions")}
          className="flex flex-wrap gap-2"
        >
          {editions.map((item) => (
            <button
              key={item.textId}
              type="button"
              role="tab"
              aria-selected={item.textId === edition?.textId}
              onClick={() => setSelected(item.textId)}
              className={cn(
                "rounded-full border px-3 py-1 text-sm transition-colors",
                item.textId === edition?.textId
                  ? "border-[#A51C21] bg-[#A51C21]/10 text-foreground"
                  : "border-input text-muted-foreground hover:text-foreground",
              )}
            >
              {item.language
                ? getLanguageLabel(item.language.toUpperCase())
                : item.title}
            </button>
          ))}
        </div>
      )}

      {issues.length > 0 ? (
        <ul className="space-y-1 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm">
          {issues.map((issue, index) => (
            <li key={`${issue.path}-${index}`}>
              <code className="text-xs">{issue.path}</code>
              <span className="text-muted-foreground">: {issue.message}</span>
            </li>
          ))}
        </ul>
      ) : null}

      <ShortTitlesEditor
        rows={titles}
        onChange={setTitles}
        suggesting={suggest.isPending || !libraryEditionId}
        onSuggest={(mode) => suggest.mutate(mode)}
        onDownloadTemplate={downloadTemplate}
      />
      <RepeatedSegmentsEditor
        rows={repeats}
        lines={lines}
        onChange={setRepeats}
      />
      <ReturnJumpsEditor rows={returns} lines={lines} onChange={setReturns} />

      <div className="sticky bottom-4 flex justify-end gap-2">
        <Pecha.Button
          type="button"
          variant="outline"
          disabled={!ready || save.isPending}
          onClick={() =>
            queryClient.invalidateQueries({
              queryKey: liveControlKeys.editionSettings(libraryEditionId ?? ""),
            })
          }
        >
          {t("studio.live_settings.edition.discard")}
        </Pecha.Button>
        <Pecha.Button
          type="button"
          disabled={!libraryEditionId || !ready || save.isPending}
          onClick={() => save.mutate()}
        >
          {save.isPending ? t("studio.common.saving") : t("studio.common.save")}
        </Pecha.Button>
      </div>
    </div>
  );
};

export default GroupEventLiveTextPage;
