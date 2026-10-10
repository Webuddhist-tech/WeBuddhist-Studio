import { useEffect, useRef, useState } from "react";
import { useDebounce } from "use-debounce";
import { useTranslate } from "@tolgee/react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { IoMdAdd, IoMdClose, IoMdRemove } from "react-icons/io";
import { FiLoader } from "react-icons/fi";
import { Pecha } from "@/components/ui/shadimport";
import { Input } from "@/components/ui/atoms/input";
import {
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/atoms/dialog";
import {
  fetchPlanDetails,
  searchCmsPlans,
  type CreateDaysRequest,
} from "@/components/routes/task/api/planApi";
import { getNativeLanguageLabel } from "@/components/routes/create-series/utils/language";
import { normalizeLanguageCode } from "@/lib/languageCodes";

interface DayCreateDialogProps {
  disabled?: boolean;
  isPending?: boolean;
  onSubmit: (req: CreateDaysRequest) => void;
}

const PLAN_SEARCH_DEBOUNCE_MS = 400;
const PAGE_SIZE = 10;

const DayCreateDialog = ({
  disabled,
  isPending,
  onSubmit,
}: DayCreateDialogProps) => {
  const { t } = useTranslate();
  const containerRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  const [numberOfDays, setNumberOfDays] = useState(1);

  const [templatePlanId, setTemplatePlanId] = useState<string | undefined>();
  const [templatePlanTitle, setTemplatePlanTitle] = useState("");
  const [templatePlanLanguage, setTemplatePlanLanguage] = useState("");
  const [sourceDayId, setSourceDayId] = useState<string | undefined>();

  const [planSearch, setPlanSearch] = useState("");
  const [debouncedPlanSearch] = useDebounce(
    planSearch,
    PLAN_SEARCH_DEBOUNCE_MS,
  );
  const [showPlanPicker, setShowPlanPicker] = useState(false);

  const { data: planSearchData, isFetching: isPlanFetching } = useInfiniteQuery(
    {
      queryKey: ["day-create-cms-plan-search", debouncedPlanSearch],
      queryFn: ({ pageParam = 0 }) =>
        searchCmsPlans({
          search: debouncedPlanSearch.trim() || undefined,
          skip: pageParam,
          limit: PAGE_SIZE,
        }),
      getNextPageParam: (lastPage) => {
        const fetched = lastPage.skip + lastPage.plans.length;
        return fetched < lastPage.total ? fetched : undefined;
      },
      initialPageParam: 0,
      enabled: open && showPlanPicker,
      refetchOnWindowFocus: false,
    },
  );

  const {
    data: templatePlanData,
    isFetching: isTemplatePlanFetching,
    isError: isTemplatePlanError,
  } = useQuery({
    queryKey: ["day-create-template-plan", templatePlanId],
    queryFn: () => fetchPlanDetails(templatePlanId!),
    enabled: !!templatePlanId && open,
    refetchOnWindowFocus: false,
  });

  const planOptions = planSearchData?.pages.flatMap((page) => page.plans) ?? [];
  const templateDays: Array<{ id: string; day_number: number }> =
    templatePlanData?.days ?? [];

  const resetForm = () => {
    setNumberOfDays(1);
    setTemplatePlanId(undefined);
    setTemplatePlanTitle("");
    setTemplatePlanLanguage("");
    setSourceDayId(undefined);
    setPlanSearch("");
    setShowPlanPicker(false);
  };

  const handleOpenChange = (o: boolean) => {
    setOpen(o);
    if (!o) resetForm();
  };

  const addLabel =
    numberOfDays === 1
      ? t("studio.modals.day_create.submit_one")
      : t("studio.modals.day_create.submit_other", { count: numberOfDays });

  const handleSubmit = () => {
    onSubmit({
      number_of_days: numberOfDays,
      source_day_id: sourceDayId,
    });
    setOpen(false);
    resetForm();
  };

  const formatPlanLanguage = (language: string | undefined | null) => {
    if (!language) return "";
    const code = normalizeLanguageCode(language);
    return code ? getNativeLanguageLabel(code) : language;
  };

  const selectPlan = (id: string, title: string, language: string) => {
    setTemplatePlanId(id);
    setTemplatePlanTitle(title);
    setTemplatePlanLanguage(language);
    setSourceDayId(undefined);
    setPlanSearch("");
    setShowPlanPicker(false);
  };

  const clearPlan = () => {
    setTemplatePlanId(undefined);
    setTemplatePlanTitle("");
    setTemplatePlanLanguage("");
    setSourceDayId(undefined);
    setPlanSearch("");
    setShowPlanPicker(false);
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setShowPlanPicker(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const showPlanDropdown =
    showPlanPicker &&
    (isPlanFetching ||
      planOptions.length > 0 ||
      debouncedPlanSearch.trim().length > 0);

  const planInputValue = showPlanPicker
    ? planSearch
    : templatePlanLanguage
      ? `${templatePlanTitle} (${formatPlanLanguage(templatePlanLanguage)})`
      : templatePlanTitle;

  return (
    <Pecha.Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Pecha.Button
          type="button"
          disabled={disabled || isPending}
          variant="destructive"
          className="cursor-pointer w-full disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <IoMdAdd className="w-4 h-4" />
          <span className="text-sm font-medium">
            {isPending
              ? t("studio.modals.day_add.adding")
              : t("studio.modals.day_add.add_new_day")}
          </span>
        </Pecha.Button>
      </DialogTrigger>

      <Pecha.DialogContent className="max-w-md">
        <Pecha.DialogHeader>
          <Pecha.DialogTitle>
            {t("studio.modals.day_create.title")}
          </Pecha.DialogTitle>
          <DialogDescription>
            {t("studio.modals.day_create.description")}
          </DialogDescription>
        </Pecha.DialogHeader>

        <div className="space-y-5 py-1">
          {/* Number of days */}
          <div className="space-y-2">
            <label htmlFor="num-days-input" className="text-sm font-medium">
              {t("studio.modals.day_create.number_of_days")}
            </label>
            <div className="flex items-center gap-3">
              <button
                type="button"
                aria-label={t("studio.modals.day_create.decrease")}
                disabled={numberOfDays <= 1}
                className="w-8 h-8 rounded-md border flex items-center justify-center hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                onClick={() => setNumberOfDays((n) => Math.max(1, n - 1))}
              >
                <IoMdRemove className="w-4 h-4" />
              </button>
              <Input
                id="num-days-input"
                type="number"
                min={1}
                max={365}
                value={numberOfDays}
                onChange={(e) => {
                  const v = Number.parseInt(e.target.value, 10);
                  if (!Number.isNaN(v) && v >= 1)
                    setNumberOfDays(Math.min(365, v));
                }}
                className="w-20 text-center"
              />
              <button
                type="button"
                aria-label={t("studio.modals.day_create.increase")}
                disabled={numberOfDays >= 365}
                className="w-8 h-8 rounded-md border flex items-center justify-center hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                onClick={() => setNumberOfDays((n) => Math.min(365, n + 1))}
              >
                <IoMdAdd className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Template section */}
          <div className="space-y-3 border rounded-lg p-3 bg-muted/30">
            <p className="text-sm font-medium">
              {t("studio.modals.day_create.copy_tasks_from_day")}{" "}
              <span className="text-muted-foreground font-normal">
                ({t("studio.common.optional")})
              </span>
            </p>

            {/* Plan search */}
            <div ref={containerRef} className="space-y-2">
              <p className="text-xs text-muted-foreground">
                {t("studio.modals.day_create.plan_label")}
              </p>
              <div className="relative">
                <Input
                  placeholder={t(
                    "studio.modals.day_create.search_plans_placeholder",
                  )}
                  className="bg-background pr-8"
                  value={planInputValue}
                  autoComplete="off"
                  onChange={(e) => {
                    setPlanSearch(e.target.value);
                    setShowPlanPicker(true);
                  }}
                  onFocus={() => {
                    setPlanSearch("");
                    setShowPlanPicker(true);
                  }}
                />
                {templatePlanId && !showPlanPicker && (
                  <button
                    type="button"
                    aria-label={t("studio.modals.day_create.clear_plan")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    onClick={clearPlan}
                  >
                    <IoMdClose className="h-4 w-4" />
                  </button>
                )}
                {showPlanDropdown && (
                  <ul className="absolute z-50 mt-1 w-full max-h-48 overflow-y-auto rounded-md border bg-white dark:bg-[#1e1e1e] shadow-md py-1">
                    {isPlanFetching && planOptions.length === 0 && (
                      <li className="px-3 py-2 text-sm text-muted-foreground flex items-center gap-2">
                        <FiLoader className="w-4 h-4 animate-spin" />
                        {t("studio.modals.day_create.searching_plans")}
                      </li>
                    )}
                    {planOptions.map((plan) => (
                      <li key={plan.id}>
                        <button
                          type="button"
                          className="w-full px-3 py-2 text-left text-sm hover:bg-muted/50"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() =>
                            selectPlan(plan.id, plan.title, plan.language)
                          }
                        >
                          <span className="block truncate">{plan.title}</span>
                          <span className="text-xs text-muted-foreground">
                            {formatPlanLanguage(plan.language)} ·{" "}
                            {plan.total_days === 1
                              ? t("studio.modals.day_create.day_count_one")
                              : t("studio.modals.day_create.day_count_other", {
                                  count: plan.total_days,
                                })}
                          </span>
                        </button>
                      </li>
                    ))}
                    {!isPlanFetching &&
                      planOptions.length === 0 &&
                      debouncedPlanSearch.trim().length > 0 && (
                        <li className="px-3 py-2 text-sm text-muted-foreground">
                          {t("studio.modals.day_create.no_plans_found")}
                        </li>
                      )}
                    {!isPlanFetching &&
                      planOptions.length === 0 &&
                      debouncedPlanSearch.trim().length === 0 && (
                        <li className="px-3 py-2 text-sm text-muted-foreground">
                          {t("studio.modals.day_create.start_typing")}
                        </li>
                      )}
                  </ul>
                )}
              </div>

              {/* Day selector */}
              {templatePlanId && (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">
                    {t("studio.modals.day_create.source_day")}
                  </p>
                  {isTemplatePlanFetching ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground py-1">
                      <FiLoader className="w-4 h-4 animate-spin" />
                      {t("studio.modals.day_create.loading_days")}
                    </div>
                  ) : isTemplatePlanError ? (
                    <p className="text-sm text-destructive py-1">
                      {t("studio.modals.day_create.load_days_failed")}
                    </p>
                  ) : templateDays.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-1">
                      {t("studio.modals.day_create.no_days")}
                    </p>
                  ) : (
                    <Pecha.Select
                      value={sourceDayId}
                      onValueChange={setSourceDayId}
                    >
                      <Pecha.SelectTrigger className="bg-background">
                        <Pecha.SelectValue
                          placeholder={t(
                            "studio.modals.day_create.select_day_placeholder",
                          )}
                        />
                      </Pecha.SelectTrigger>
                      <Pecha.SelectContent>
                        {templateDays.map((day) => (
                          <Pecha.SelectItem key={day.id} value={String(day.id)}>
                            {t("studio.modals.day_create.day_label", {
                              day: day.day_number,
                            })}
                          </Pecha.SelectItem>
                        ))}
                      </Pecha.SelectContent>
                    </Pecha.Select>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Pecha.Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
          >
            {t("studio.common.cancel")}
          </Pecha.Button>
          <Pecha.Button
            type="button"
            disabled={isPending}
            className="bg-[#AD1B21] dark:text-white hover:bg-[#AD1B21]/90"
            onClick={handleSubmit}
          >
            {isPending ? (
              <FiLoader className="w-4 h-4 animate-spin" />
            ) : (
              addLabel
            )}
          </Pecha.Button>
        </DialogFooter>
      </Pecha.DialogContent>
    </Pecha.Dialog>
  );
};

export default DayCreateDialog;
