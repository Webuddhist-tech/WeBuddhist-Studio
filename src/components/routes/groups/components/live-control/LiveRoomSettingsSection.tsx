import { useEffect, useState } from "react";
import { useTranslate } from "@tolgee/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Pecha } from "@/components/ui/shadimport";
import { getLanguageLabel } from "@/components/api/languagesApi";
import { getApiErrorMessage } from "@/lib/apiErrors";
import { cn } from "@/lib/utils";
import {
  fetchEventLiveSettings,
  liveControlKeys,
  saveEventLiveSettings,
  type EventLiveSettings,
} from "../../api/liveControlSettingsApi";

/** The languages a live room is offered in today. */
const ROOM_LANGUAGES = ["bo", "en", "zh"];
const LEAD_STEP_MS = 50;
const MAX_LEAD_MS = 10_000;

type Draft = Pick<
  EventLiveSettings,
  | "followed_languages"
  | "fallback_language"
  | "record_play_times"
  | "lead_max_ms"
>;

const toDraft = (settings: EventLiveSettings): Draft => ({
  followed_languages: settings.followed_languages,
  fallback_language: settings.fallback_language,
  record_play_times: settings.record_play_times,
  lead_max_ms: settings.lead_max_ms,
});

export const LiveRoomSettingsSection = ({ eventId }: { eventId: string }) => {
  const { t } = useTranslate();
  const queryClient = useQueryClient();
  const { data } = useQuery({
    queryKey: liveControlKeys.eventSettings(eventId),
    queryFn: () => fetchEventLiveSettings(eventId),
  });
  const [draft, setDraft] = useState<Draft | null>(null);
  useEffect(() => {
    if (data) setDraft(toDraft(data));
  }, [data]);

  const save = useMutation({
    mutationFn: (value: Draft) => saveEventLiveSettings(eventId, value),
    onSuccess: (settings) => {
      queryClient.setQueryData(
        liveControlKeys.eventSettings(eventId),
        settings,
      );
      toast.success(t("studio.live_settings.room.saved"));
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  if (!draft) return null;

  const toggleLanguage = (language: string) =>
    setDraft({
      ...draft,
      followed_languages: draft.followed_languages.includes(language)
        ? draft.followed_languages.filter((code) => code !== language)
        : [...draft.followed_languages, language],
    });
  const leadSeconds = draft.lead_max_ms / 1000;

  return (
    <section
      aria-labelledby="live-room"
      className="space-y-4 rounded-2xl border bg-card p-5"
    >
      <div className="space-y-1">
        <h2 id="live-room" className="text-base font-semibold">
          {t("studio.live_settings.room.title")}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t("studio.live_settings.room.description")}
        </p>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <span className="text-sm font-medium">
            {t("studio.live_settings.room.languages")}
          </span>
          <div className="flex flex-wrap gap-2">
            {ROOM_LANGUAGES.map((language) => {
              const on = draft.followed_languages.includes(language);
              return (
                <button
                  key={language}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggleLanguage(language)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-sm transition-colors",
                    on
                      ? "border-[#A51C21] bg-[#A51C21]/10 text-foreground"
                      : "border-input text-muted-foreground hover:text-foreground",
                  )}
                >
                  {getLanguageLabel(language.toUpperCase())}
                </button>
              );
            })}
          </div>
        </div>
        <div className="space-y-2">
          <span className="text-sm font-medium">
            {t("studio.live_settings.room.fallback")}
          </span>
          <Pecha.Select
            value={draft.fallback_language ?? ROOM_LANGUAGES[0]}
            onValueChange={(value: string) =>
              setDraft({ ...draft, fallback_language: value })
            }
          >
            <Pecha.SelectTrigger className="w-full bg-white dark:bg-[#181818]">
              <Pecha.SelectValue />
            </Pecha.SelectTrigger>
            <Pecha.SelectContent>
              {ROOM_LANGUAGES.map((language) => (
                <Pecha.SelectItem key={language} value={language}>
                  {getLanguageLabel(language.toUpperCase())}
                </Pecha.SelectItem>
              ))}
            </Pecha.SelectContent>
          </Pecha.Select>
          <p className="text-xs text-muted-foreground">
            {t("studio.live_settings.room.fallback_help")}
          </p>
        </div>
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm font-medium">
            <Pecha.Checkbox
              checked={draft.record_play_times}
              onCheckedChange={(value) =>
                setDraft({ ...draft, record_play_times: value === true })
              }
            />
            {t("studio.live_settings.room.record_play_times")}
          </label>
          <p className="text-xs text-muted-foreground">
            {t("studio.live_settings.room.record_play_times_help")}
          </p>
        </div>
        <div className="space-y-2">
          <label htmlFor="live-lead-max" className="text-sm font-medium">
            {t("studio.live_settings.room.lead_max")}
          </label>
          <div className="flex items-center gap-2">
            <Pecha.Input
              id="live-lead-max"
              type="number"
              className="w-24"
              min={0}
              max={MAX_LEAD_MS / 1000}
              step={LEAD_STEP_MS / 1000}
              value={leadSeconds}
              onChange={(e) => {
                const seconds = Number(e.target.value);
                if (!Number.isFinite(seconds)) return;
                const ms =
                  Math.round(
                    Math.min(MAX_LEAD_MS, Math.max(0, seconds * 1000)) /
                      LEAD_STEP_MS,
                  ) * LEAD_STEP_MS;
                setDraft({ ...draft, lead_max_ms: ms });
              }}
            />
            <span className="text-xs text-muted-foreground">
              {t("studio.live_settings.room.lead_max_unit")}
            </span>
          </div>
        </div>
      </div>
      <div className="flex justify-end">
        <Pecha.Button
          type="button"
          disabled={save.isPending}
          onClick={() => save.mutate(draft)}
        >
          {save.isPending ? t("studio.common.saving") : t("studio.common.save")}
        </Pecha.Button>
      </div>
    </section>
  );
};
