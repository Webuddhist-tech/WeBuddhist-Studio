import { useEffect, useRef } from "react";
import { formatMs } from "@/lib/utils";
import { useTranslate } from "@tolgee/react";

interface AudioSegmentPlayerProps {
  audioUrl: string;
  startMs: number;
  endMs: number;
}

export const AudioSegmentPlayer = ({
  audioUrl,
  startMs,
  endMs,
}: AudioSegmentPlayerProps) => {
  const { t } = useTranslate();
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onPlay = () => {
      const currentMs = audio.currentTime * 1000;
      if (currentMs < startMs || currentMs >= endMs) {
        audio.currentTime = startMs / 1000;
      }
    };

    const onTimeUpdate = () => {
      if (audio.currentTime * 1000 >= endMs) {
        audio.pause();
        audio.currentTime = startMs / 1000;
      }
    };

    audio.addEventListener("play", onPlay);
    audio.addEventListener("timeupdate", onTimeUpdate);
    return () => {
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("timeupdate", onTimeUpdate);
    };
  }, [audioUrl, startMs, endMs]);

  return (
    <div className="border-t border-dashed pt-2 space-y-2">
      <p className="text-xs text-muted-foreground">
        {t("studio.molecules.audio_segment.range", {
          start: formatMs(startMs),
          end: formatMs(endMs),
        })}
      </p>
      <audio
        ref={audioRef}
        controls
        src={audioUrl}
        preload="metadata"
        className="w-full"
      />
    </div>
  );
};
