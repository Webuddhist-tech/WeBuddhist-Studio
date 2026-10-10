import { Link } from "react-router-dom";
import { IoMdAdd } from "react-icons/io";
import { Pecha } from "@/components/ui/shadimport";
import { useTranslate } from "@tolgee/react";
import { ROUTES } from "@/routes/paths";
import type { LanguageCode } from "@/schema/SeriesSchema";
import type { SeriesStartDateSettings } from "./seriesDetailsMappers";
import { CloneLanguagePlansPanel } from "./CloneLanguagePlansPanel";

type SeriesLanguageActionsPanelProps = {
  seriesId: string;
  groupId: string;
  activeLanguage: LanguageCode;
  hasActivePlans: boolean;
  showClonePanel: boolean;
  cloneSourceLanguages: LanguageCode[];
  seriesStartDate: SeriesStartDateSettings | null;
};

export function SeriesLanguageActionsPanel({
  seriesId,
  groupId,
  activeLanguage,
  hasActivePlans,
  showClonePanel,
  cloneSourceLanguages,
  seriesStartDate,
}: Readonly<SeriesLanguageActionsPanelProps>) {
  const { t } = useTranslate();
  const planNewState = {
    seriesId,
    language: activeLanguage,
    ...(seriesStartDate ? { start_date: seriesStartDate.start_date } : {}),
  };

  return (
    <div className={hasActivePlans ? "mt-4" : "mt-0"}>
      <div className="flex flex-col items-center gap-6 rounded-xl border border-dashed border-gray-300 bg-white/80 px-6 py-8 dark:border-input dark:bg-[#1d1d1f]/80">
        {showClonePanel ? (
          <CloneLanguagePlansPanel
            seriesId={seriesId}
            targetLanguage={activeLanguage}
            sourceLanguages={cloneSourceLanguages}
            embedded
          />
        ) : null}

        {showClonePanel ? (
          <div className="h-px w-full max-w-md border-t border-dashed border-gray-300 dark:border-input" />
        ) : null}

        <Link to={ROUTES.groupPlanNew(groupId)} state={planNewState}>
          <Pecha.Button
            type="button"
            className="gap-2 bg-[#A51C21] hover:bg-[#8a171c] text-white"
          >
            <IoMdAdd className="h-4 w-4" />
            {t("studio.series.add_new_plan")}
          </Pecha.Button>
        </Link>
      </div>
    </div>
  );
}
