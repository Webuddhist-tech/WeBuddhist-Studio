export const TTS_AUDIO_TYPES = [
  {
    value: "RECITATION",
    label: "Recitation",
    labelKey: "studio.ui.options.tts_audio_type.recitation",
  },
  {
    value: "INSTRUCTION",
    label: "Instruction",
    labelKey: "studio.ui.options.tts_audio_type.instruction",
  },
  {
    value: "TEXT_READING",
    label: "Text Reading",
    labelKey: "studio.ui.options.tts_audio_type.text_reading",
  },
] as const;

export type TtsAudioType = (typeof TTS_AUDIO_TYPES)[number]["value"];

export const MONLAM_VOICE_REGIONS = [
  {
    label: "Lhasa",
    labelKey: "studio.ui.options.voice_region.lhasa",
    voices: [
      { value: "dolkar_lhasa_female", label: "Dolkar" },
      { value: "yangchen_lhasa_female", label: "Yangchen" },
      { value: "darjeeyalphel_lhasa_male", label: "Darjeeyalphel" },
      { value: "histry_lhasa_male", label: "Histry" },
      { value: "sonamtsering_lhasa_male", label: "Sonamtsering" },
    ],
  },
  {
    label: "Amdo",
    labelKey: "studio.ui.options.voice_region.amdo",
    voices: [
      { value: "dolma_amdo_female", label: "Dolma" },
      { value: "kid_amdo_female", label: "Kid" },
      { value: "buddhahistory_amdo_male", label: "Buddhahistory" },
      { value: "history_amdo_male", label: "History" },
      { value: "kalsang_gyatso_amdo_male", label: "Kalsang Gyatso" },
    ],
  },
  {
    label: "Kham",
    labelKey: "studio.ui.options.voice_region.kham",
    voices: [
      { value: "kotheke_kham_male", label: "Kotheke" },
      { value: "tibet_tongue_kham_male", label: "Tibet Tongue" },
      { value: "tsering_wangmo_kham_female", label: "Tsering Wangmo" },
      { value: "wangdontso_kham_female", label: "Wangdontso" },
    ],
  },
] as const;

export type MonlamVoiceName =
  (typeof MONLAM_VOICE_REGIONS)[number]["voices"][number]["value"];

export const DEFAULT_MONLAM_VOICE: MonlamVoiceName = "dolkar_lhasa_female";
export const DEFAULT_TTS_AUDIO_TYPE: TtsAudioType = "TEXT_READING";

/** Map plan UI language codes (EN, BO, …) to TTS API language (en, bo, …). */
export function planLanguageToTtsApiLanguage(language: string): string {
  const normalized = language.trim().toUpperCase();
  if (normalized === "EN" || normalized.startsWith("EN")) return "en";
  if (normalized === "BO" || normalized.startsWith("BO")) return "bo";
  if (normalized === "ZH" || normalized.startsWith("ZH")) return "zh";
  if (normalized === "HI" || normalized.startsWith("HI")) return "hi";
  if (normalized === "NE" || normalized.startsWith("NE")) return "ne";
  if (normalized === "MN" || normalized.startsWith("MN")) return "mn";
  return language.trim().toLowerCase();
}

export function isTtsSupportedPlanLanguage(language: string): boolean {
  return Boolean(planLanguageToTtsApiLanguage(language));
}

/** Non-Tibetan plans use Gemini TTS (English, Chinese, Hindi, etc.). */
export function isGeminiTtsLanguage(language: string): boolean {
  return planLanguageToTtsApiLanguage(language) !== "bo";
}

export function isEnglishTtsLanguage(language: string): boolean {
  return isGeminiTtsLanguage(language);
}

export function isTibetanTtsLanguage(language: string): boolean {
  return planLanguageToTtsApiLanguage(language) === "bo";
}
