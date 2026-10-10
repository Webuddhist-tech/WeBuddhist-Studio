import { useState } from "react";
import { Pecha } from "@/components/ui/shadimport";
import { useTranslate } from "@tolgee/react";
import { FiLoader } from "react-icons/fi";
import { AiOutlineSound } from "react-icons/ai";
import {
  DEFAULT_MONLAM_VOICE,
  DEFAULT_TTS_AUDIO_TYPE,
  isGeminiTtsLanguage,
  isTibetanTtsLanguage,
  isTtsSupportedPlanLanguage,
  MONLAM_VOICE_REGIONS,
  type MonlamVoiceName,
  type TtsAudioType,
  TTS_AUDIO_TYPES,
} from "@/lib/ttsConstants";

interface TtsGenerateControlsProps {
  planLanguage: string;
  defaultAudioType?: TtsAudioType;
  isPending?: boolean;
  disabled?: boolean;
  size?: "sm" | "default";
  onGenerate: (options: {
    type?: TtsAudioType;
    voice_name?: MonlamVoiceName;
  }) => void;
}

const TtsGenerateControls = ({
  planLanguage,
  defaultAudioType = DEFAULT_TTS_AUDIO_TYPE,
  isPending = false,
  disabled = false,
  size = "default",
  onGenerate,
}: TtsGenerateControlsProps) => {
  const { t } = useTranslate();
  const [audioType, setAudioType] = useState<TtsAudioType>(defaultAudioType);
  const [voiceName, setVoiceName] =
    useState<MonlamVoiceName>(DEFAULT_MONLAM_VOICE);

  const isSupported = isTtsSupportedPlanLanguage(planLanguage);
  const showGeminiOptions = isGeminiTtsLanguage(planLanguage);
  const showTibetanOptions = isTibetanTtsLanguage(planLanguage);
  const isDisabled = disabled || isPending || !isSupported;
  const triggerClassName =
    size === "sm" ? "w-[160px] h-9" : "w-full sm:w-[200px]";

  const handleGenerate = () => {
    onGenerate({
      ...(showGeminiOptions ? { type: audioType } : {}),
      ...(showTibetanOptions ? { voice_name: voiceName } : {}),
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {showGeminiOptions && (
        <Pecha.Select
          value={audioType}
          onValueChange={(value) => setAudioType(value as TtsAudioType)}
        >
          <Pecha.SelectTrigger className={triggerClassName}>
            <Pecha.SelectValue />
          </Pecha.SelectTrigger>
          <Pecha.SelectContent>
            {TTS_AUDIO_TYPES.map(({ value, labelKey }) => (
              <Pecha.SelectItem key={value} value={value}>
                {t(labelKey)}
              </Pecha.SelectItem>
            ))}
          </Pecha.SelectContent>
        </Pecha.Select>
      )}

      {showTibetanOptions && (
        <Pecha.Select
          value={voiceName}
          onValueChange={(value) => setVoiceName(value as MonlamVoiceName)}
        >
          <Pecha.SelectTrigger className={triggerClassName}>
            <Pecha.SelectValue />
          </Pecha.SelectTrigger>
          <Pecha.SelectContent>
            {MONLAM_VOICE_REGIONS.map((region) => (
              <Pecha.SelectGroup key={region.label}>
                <Pecha.SelectLabel>{t(region.labelKey)}</Pecha.SelectLabel>
                {region.voices.map((voice) => (
                  <Pecha.SelectItem key={voice.value} value={voice.value}>
                    {voice.label}
                  </Pecha.SelectItem>
                ))}
              </Pecha.SelectGroup>
            ))}
          </Pecha.SelectContent>
        </Pecha.Select>
      )}

      <Pecha.Button
        type="button"
        variant="outline"
        size={size === "sm" ? "sm" : "default"}
        disabled={isDisabled}
        onClick={handleGenerate}
      >
        {isPending ? (
          <FiLoader className="w-4 h-4 animate-spin" />
        ) : (
          <AiOutlineSound className="w-4 h-4" />
        )}
        {isPending
          ? t("studio.molecules.tts.generating")
          : t("studio.molecules.tts.generate_audio")}
      </Pecha.Button>
    </div>
  );
};

export default TtsGenerateControls;
