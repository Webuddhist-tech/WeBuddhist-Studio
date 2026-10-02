import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { LuDownload, LuSettings2 } from "react-icons/lu";
import { toast } from "sonner";
import { Pecha } from "@/components/ui/shadimport";
import {
  downloadPrayerPdf,
  fetchPrayerPdfSettings,
  getPrayerPdfErrorMessage,
  prayerPdfQueryKey,
  saveBlobAs,
  todayInTimeZone,
  type PrayerPdfScope,
} from "../../api/prayerPdfApi";
import PrayerPdfSettingsDialog from "./PrayerPdfSettingsDialog";

interface PrayerPdfActionsProps {
  scope: PrayerPdfScope;
}

/**
 * "Prayer PDF" settings and "Download prayers" for a group's or an event's
 * chat room. Callers render it only for people who may export (OWNER, ADMIN,
 * AUTHOR, super admin), which is what the server enforces too.
 */
const PrayerPdfActions = ({ scope }: PrayerPdfActionsProps) => {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [downloadOpen, setDownloadOpen] = useState(false);
  const [day, setDay] = useState("");

  const { data: settings } = useQuery({
    queryKey: prayerPdfQueryKey(scope),
    queryFn: () => fetchPrayerPdfSettings(scope),
    enabled: downloadOpen,
    refetchOnWindowFocus: false,
  });
  const timeZone = settings?.timezone ?? "Asia/Kolkata";

  // Default to today where the prayers are counted, as the server does.
  useEffect(() => {
    if (downloadOpen && !day) setDay(todayInTimeZone(timeZone));
  }, [downloadOpen, day, timeZone]);

  const downloadMutation = useMutation({
    mutationFn: (selectedDay: string) => downloadPrayerPdf(scope, selectedDay),
    onSuccess: ({ blob, filename, prayerCount }) => {
      saveBlobAs(blob, filename);
      toast.success(
        prayerCount != null
          ? `Downloaded ${prayerCount} prayer request${prayerCount === 1 ? "" : "s"}`
          : "Prayer PDF downloaded",
      );
      setDownloadOpen(false);
    },
    onError: async (err) => toast.error(await getPrayerPdfErrorMessage(err)),
  });

  return (
    <>
      <Pecha.Button
        variant="outline"
        size="sm"
        className="gap-1.5"
        onClick={() => setSettingsOpen(true)}
      >
        <LuSettings2 className="h-4 w-4" />
        Prayer PDF
      </Pecha.Button>

      <Pecha.Popover open={downloadOpen} onOpenChange={setDownloadOpen}>
        <Pecha.PopoverTrigger asChild>
          <Pecha.Button variant="outline" size="sm" className="gap-1.5">
            <LuDownload className="h-4 w-4" />
            Download prayers
          </Pecha.Button>
        </Pecha.PopoverTrigger>
        <Pecha.PopoverContent align="end" className="w-72 space-y-3">
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (!day) {
                toast.error("Choose a day");
                return;
              }
              downloadMutation.mutate(day);
            }}
          >
            <div className="space-y-1.5">
              <label htmlFor="prayer-pdf-day" className="text-sm font-bold">
                Day
              </label>
              <Pecha.Input
                id="prayer-pdf-day"
                type="date"
                value={day}
                max={todayInTimeZone(timeZone)}
                onChange={(e) => setDay(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Prayer requests posted that day ({timeZone}).
              </p>
            </div>
            <Pecha.Button
              type="submit"
              size="sm"
              className="w-full gap-1.5"
              disabled={downloadMutation.isPending}
            >
              <LuDownload className="h-4 w-4" />
              {downloadMutation.isPending ? "Generating PDF…" : "Download PDF"}
            </Pecha.Button>
          </form>
        </Pecha.PopoverContent>
      </Pecha.Popover>

      <PrayerPdfSettingsDialog
        scope={scope}
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
      />
    </>
  );
};

export default PrayerPdfActions;
