import { useMemo, useState } from "react";
import { Link, Navigate, useOutletContext, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useTranslate } from "@tolgee/react";
import { LuDownload, LuUpload } from "react-icons/lu";
import { toast } from "sonner";
import { Pecha } from "@/components/ui/shadimport";
import { getApiErrorMessage } from "@/lib/apiErrors";
import { ROUTES } from "@/routes/paths";
import type { GroupOutletContext } from "./GroupLayout";
import { canWriteEvents } from "./lib/eventPermissions";
import { fetchCmsEvent, metadataArray } from "./api/eventsApi";
import {
  downloadJson,
  fetchPlanTexts,
  fetchSettingsExport,
  liveControlKeys,
} from "./api/liveControlSettingsApi";
import { LiveControllersSection } from "./components/live-control/LiveControllersSection";
import { LiveRoomSettingsSection } from "./components/live-control/LiveRoomSettingsSection";
import { LivePlanTextsSection } from "./components/live-control/LivePlanTextsSection";
import { LiveImportDialog } from "./components/live-control/LiveImportDialog";

/**
 * Everything the live controller of one event takes from Studio: who may drive
 * the room (controllers and their tokens), the room's settings, and the texts
 * of the event's plan, each opening its short titles and return jumps.
 */
const GroupEventLivePage = () => {
  const { t } = useTranslate();
  const { groupId = "", eventId = "" } = useParams<{
    groupId: string;
    eventId: string;
  }>();
  const { myRole, userInfo, readOnlyPlatform } =
    useOutletContext<GroupOutletContext>();
  const canWrite =
    !readOnlyPlatform && canWriteEvents(myRole, userInfo?.platform_role);
  const [importOpen, setImportOpen] = useState(false);

  const { data: event } = useQuery({
    queryKey: ["cms-event", eventId],
    queryFn: () => fetchCmsEvent(eventId),
    enabled: Boolean(eventId) && canWrite,
    refetchOnWindowFocus: false,
  });
  const eventTitle = useMemo(() => {
    const rows = event ? metadataArray(event.metadata) : [];
    const row =
      rows.find((r) => (r.language?.trim() || "EN").toUpperCase() === "EN") ??
      rows[0];
    return (
      row?.name?.trim() || t("studio.groups.pages.event_detail.untitled_event")
    );
  }, [event, t]);

  const { data: planTexts, isLoading: textsLoading } = useQuery({
    queryKey: liveControlKeys.planTexts(eventId),
    queryFn: () => fetchPlanTexts(eventId),
    enabled: Boolean(eventId) && canWrite,
  });

  if (!canWrite)
    return <Navigate to={ROUTES.groupEvent(groupId, eventId)} replace />;

  const exportSettings = async () => {
    try {
      downloadJson(
        await fetchSettingsExport(eventId),
        "live-control-settings.json",
      );
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1.5">
          <Link
            to={ROUTES.groupEvent(groupId, eventId)}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            ← {eventTitle}
          </Link>
          <h1 className="text-2xl font-bold">
            {t("studio.live_settings.title")}
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Pecha.Button
            variant="outline"
            size="sm"
            onClick={() => setImportOpen(true)}
          >
            <LuUpload className="h-4 w-4" />
            {t("studio.live_settings.import.title")}
          </Pecha.Button>
          <Pecha.Button variant="outline" size="sm" onClick={exportSettings}>
            <LuDownload className="h-4 w-4" />
            {t("studio.live_settings.export")}
          </Pecha.Button>
        </div>
      </div>

      <LiveControllersSection
        eventId={eventId}
        planTexts={planTexts?.texts ?? []}
      />
      <LiveRoomSettingsSection eventId={eventId} />
      <LivePlanTextsSection
        groupId={groupId}
        eventId={eventId}
        planTexts={planTexts}
        isLoading={textsLoading}
      />

      <LiveImportDialog
        eventId={eventId}
        open={importOpen}
        onOpenChange={setImportOpen}
      />
    </div>
  );
};

export default GroupEventLivePage;
