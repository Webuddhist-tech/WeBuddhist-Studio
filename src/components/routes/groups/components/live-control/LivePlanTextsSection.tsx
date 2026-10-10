import { useTranslate } from "@tolgee/react";
import { Link } from "react-router-dom";
import { ROUTES } from "@/routes/paths";
import type { PlanTexts } from "../../api/liveControlSettingsApi";

export const LivePlanTextsSection = ({
  groupId,
  eventId,
  planTexts,
  isLoading,
}: {
  groupId: string;
  eventId: string;
  planTexts: PlanTexts | undefined;
  isLoading: boolean;
}) => {
  const { t } = useTranslate();
  const texts = planTexts?.texts ?? [];
  const source = planTexts?.series_id
    ? t("studio.live_settings.texts.from_series")
    : t("studio.live_settings.texts.from_plan");

  return (
    <section
      aria-labelledby="live-texts"
      className="space-y-4 rounded-2xl border bg-card p-5"
    >
      <div className="space-y-1">
        <h2 id="live-texts" className="text-base font-semibold">
          {t("studio.live_settings.texts.title")}
        </h2>
        <p className="text-sm text-muted-foreground">
          {texts.length > 0
            ? source
            : t("studio.live_settings.texts.description")}
        </p>
      </div>
      {isLoading ? (
        <p className="text-sm text-muted-foreground">
          {t("studio.common.loading")}
        </p>
      ) : texts.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {t("studio.live_settings.texts.empty")}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="px-2 py-2 font-medium">
                  {t("studio.live_settings.texts.day")}
                </th>
                <th className="px-2 py-2 font-medium">
                  {t("studio.live_settings.texts.text")}
                </th>
                <th className="px-2 py-2 font-medium">
                  {t("studio.live_settings.texts.language")}
                </th>
                <th className="px-2 py-2" />
              </tr>
            </thead>
            <tbody>
              {texts.map((text) => (
                <tr key={text.text_id} className="border-b last:border-0">
                  <td className="px-2 py-3 tabular-nums">{text.day_number}</td>
                  <td className="px-2 py-3 font-medium">
                    {text.title ?? (
                      <span className="font-mono text-xs">{text.text_id}</span>
                    )}
                  </td>
                  <td className="px-2 py-3 uppercase text-muted-foreground">
                    {text.language ?? ""}
                  </td>
                  <td className="px-2 py-3 text-right">
                    <Link
                      to={ROUTES.groupEventLiveText(
                        groupId,
                        eventId,
                        text.text_id,
                      )}
                      className="inline-flex h-8 items-center rounded-md border bg-background px-3 text-sm font-medium hover:bg-accent"
                    >
                      {t("studio.live_settings.texts.edit")}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};
