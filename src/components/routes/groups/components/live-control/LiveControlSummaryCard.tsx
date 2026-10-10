import { useTranslate } from "@tolgee/react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ROUTES } from "@/routes/paths";
import {
  fetchControllers,
  fetchEventLiveSettings,
  fetchPlanTexts,
  liveControlKeys,
} from "../../api/liveControlSettingsApi";

/** On the event page: how live control is set up, and the way in. */
export const LiveControlSummaryCard = ({
  groupId,
  eventId,
}: {
  groupId: string;
  eventId: string;
}) => {
  const { t } = useTranslate();
  const { data: controllers = [] } = useQuery({
    queryKey: liveControlKeys.controllers(eventId),
    queryFn: () => fetchControllers(eventId),
  });
  const { data: planTexts } = useQuery({
    queryKey: liveControlKeys.planTexts(eventId),
    queryFn: () => fetchPlanTexts(eventId),
  });
  const { data: settings } = useQuery({
    queryKey: liveControlKeys.eventSettings(eventId),
    queryFn: () => fetchEventLiveSettings(eventId),
  });
  const active = controllers.filter((controller) => !controller.revoked_at);

  const stats = [
    {
      label: t("studio.live_settings.summary.controllers"),
      value: t("studio.live_settings.summary.active", { count: active.length }),
      detail: active.map((controller) => controller.name).join(", "),
    },
    {
      label: t("studio.live_settings.summary.texts"),
      value: String(planTexts?.texts.length ?? 0),
      detail: t("studio.live_settings.summary.texts_detail"),
    },
    {
      label: t("studio.live_settings.summary.languages"),
      value: (settings?.followed_languages ?? []).join(" · ") || "—",
      detail: settings?.record_play_times
        ? t("studio.live_settings.summary.recording_on")
        : t("studio.live_settings.summary.recording_off"),
    },
  ];

  return (
    <section
      aria-labelledby="live-summary"
      className="space-y-4 rounded-2xl border bg-card p-5"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 id="live-summary" className="text-base font-semibold">
          {t("studio.groups.pages.event_detail.live_control")}
        </h2>
        <Link
          to={ROUTES.groupEventLive(groupId, eventId)}
          className="inline-flex h-8 items-center rounded-md border bg-background px-3 text-sm font-medium hover:bg-accent"
        >
          {t("studio.live_settings.summary.manage")} →
        </Link>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="space-y-1 rounded-xl border bg-muted/40 p-3"
          >
            <div className="text-xs text-muted-foreground">{stat.label}</div>
            <div className="text-lg font-semibold">{stat.value}</div>
            <div className="truncate text-xs text-muted-foreground">
              {stat.detail}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};
