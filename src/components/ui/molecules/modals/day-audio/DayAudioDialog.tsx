import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTranslate } from "@tolgee/react";
import { Pecha } from "@/components/ui/shadimport";
import { AiOutlineSound } from "react-icons/ai";
import DayAudioSection from "@/components/ui/molecules/day-audio-section/DayAudioSection";
import TtsGenerateControls from "@/components/ui/molecules/tts-generate-controls/TtsGenerateControls";
import {
  generateDayAudio,
  waitForAudioJob,
} from "@/components/routes/task/api/taskApi";

interface DayAudioDialogProps {
  planId: string;
  planTitle?: string;
  dayId: string;
  dayNumber: number;
  audioUrl?: string | null;
  audioDurationMs?: number | null;
  hasAudio?: boolean;
  isEditable?: boolean;
  language?: string;
}

const DayAudioDialog = ({
  planId,
  planTitle,
  dayId,
  dayNumber,
  audioUrl,
  audioDurationMs,
  hasAudio,
  isEditable,
  language,
}: DayAudioDialogProps) => {
  const { t } = useTranslate();
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const pollAbortRef = useRef<AbortController | null>(null);

  const abortPolling = () => {
    pollAbortRef.current?.abort();
    pollAbortRef.current = null;
  };

  useEffect(() => abortPolling, []);

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      abortPolling();
    }
  };

  const generateAudioMutation = useMutation({
    mutationFn: async (options: { type?: string; voice_name?: string }) => {
      abortPolling();
      const controller = new AbortController();
      pollAbortRef.current = controller;

      const accepted = await generateDayAudio(
        { day_id: dayId },
        { language: language || "", ...options },
      );
      toast.success(t("studio.modals.day_audio.generation_started"), {
        description: t(
          "studio.modals.day_audio.generation_started_description",
        ),
      });
      return waitForAudioJob(accepted.job_id, { signal: controller.signal });
    },
    onSuccess: (job) => {
      if (job.status === "failed") {
        toast.error(t("studio.modals.day_audio.generate_failed"), {
          description:
            job.error_message || t("studio.common.something_went_wrong"),
        });
        return;
      }
      toast.success(t("studio.modals.day_audio.generated"));
      queryClient.invalidateQueries({ queryKey: ["planDetails", planId] });
    },
    onError: (error: any) => {
      if (error?.name === "AbortError") {
        return;
      }
      toast.error(t("studio.modals.day_audio.generate_failed"), {
        description: error?.message || t("studio.common.something_went_wrong"),
      });
    },
  });

  return (
    <>
      <span
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        className="flex items-center gap-2 cursor-pointer w-full"
      >
        <AiOutlineSound className="w-4 h-4" />{" "}
        {t("studio.modals.day_audio.narration")}
      </span>
      <Pecha.Dialog open={open} onOpenChange={handleOpenChange}>
        <Pecha.DialogContent className="sm:max-w-lg">
          <Pecha.DialogHeader>
            <Pecha.DialogTitle>
              {t("studio.modals.day_audio.title", { day: dayNumber })}
            </Pecha.DialogTitle>
          </Pecha.DialogHeader>
          <DayAudioSection
            planId={planId}
            planTitle={planTitle}
            dayId={dayId}
            dayNumber={dayNumber}
            audioUrl={audioUrl}
            audioDurationMs={audioDurationMs}
            hasAudio={hasAudio}
            isEditable={isEditable}
          />
          {isEditable && (
            <TtsGenerateControls
              planLanguage={language || ""}
              isPending={generateAudioMutation.isPending}
              onGenerate={(options) => generateAudioMutation.mutate(options)}
            />
          )}
        </Pecha.DialogContent>
      </Pecha.Dialog>
    </>
  );
};

export default DayAudioDialog;
