import { useEffect, useRef, useState } from "react";
import { useDebounce } from "use-debounce";
import { useInfiniteQuery, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTranslate } from "@tolgee/react";
import { FiLoader } from "react-icons/fi";
import { IoMdClose } from "react-icons/io";
import { Pecha } from "@/components/ui/shadimport";
import { Input } from "@/components/ui/atoms/input";
import { formatMs } from "@/lib/utils";
import { getApiErrorMessage } from "@/lib/apiErrors";
import {
  attachDayAudio,
  fetchPlanAudioList,
  type PlanAudioDTO,
} from "@/components/routes/task/api/planApi";
import { searchPlans } from "@/components/routes/create-series/api/planSearchApi";

const SEARCH_DEBOUNCE_MS = 400;
const PLAN_SEARCH_DEBOUNCE_MS = 400;
const PAGE_SIZE = 10;

interface PlanAudioSearchInputProps {
  dayId: string;
  planId: string;
  planTitle?: string;
  disabled?: boolean;
  onAttached: () => void;
}

const PlanAudioSearchInput = ({
  dayId,
  planId,
  planTitle,
  disabled = false,
  onAttached,
}: PlanAudioSearchInputProps) => {
  const { t } = useTranslate();
  const containerRef = useRef<HTMLDivElement>(null);
  const audioRefs = useRef<Map<string, HTMLAudioElement>>(new Map());
  const [inputValue, setInputValue] = useState("");
  const [debouncedSearch] = useDebounce(inputValue, SEARCH_DEBOUNCE_MS);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const [filterPlanId, setFilterPlanId] = useState<string | undefined>(planId);
  // Empty means "no title to show": the label then falls back to a
  // translated "This plan" / "All plans" depending on the filter.
  const [filterPlanTitle, setFilterPlanTitle] = useState(planTitle ?? "");
  const [planSearchInput, setPlanSearchInput] = useState("");
  const [debouncedPlanSearch] = useDebounce(
    planSearchInput,
    PLAN_SEARCH_DEBOUNCE_MS,
  );
  const [showPlanPicker, setShowPlanPicker] = useState(false);

  const searchTerm = debouncedSearch.trim();
  const planSearchTerm = debouncedPlanSearch.trim();

  useEffect(() => {
    setFilterPlanId(planId);
    setFilterPlanTitle(planTitle ?? "");
    setPlanSearchInput("");
    setShowPlanPicker(false);
  }, [planId, planTitle]);

  const { data, fetchNextPage, hasNextPage, isFetching, isFetchingNextPage } =
    useInfiniteQuery({
      queryKey: ["plan-audio-search", searchTerm, filterPlanId],
      queryFn: ({ pageParam = 0 }) =>
        fetchPlanAudioList({
          search: searchTerm || undefined,
          plan_id: filterPlanId,
          skip: pageParam,
          limit: PAGE_SIZE,
        }),
      getNextPageParam: (lastPage) => {
        const fetched = lastPage.skip + lastPage.audio.length;
        return fetched < lastPage.total ? fetched : undefined;
      },
      initialPageParam: 0,
      enabled: showSuggestions && !disabled,
      refetchOnWindowFocus: false,
    });

  const { data: planSearchData, isFetching: isPlanSearchFetching } =
    useInfiniteQuery({
      queryKey: ["plan-audio-plan-filter", planSearchTerm],
      queryFn: ({ pageParam = 0 }) =>
        searchPlans({
          search: planSearchTerm || undefined,
          skip: pageParam,
          limit: PAGE_SIZE,
        }),
      getNextPageParam: (lastPage) => {
        const fetched = lastPage.skip + lastPage.plans.length;
        return fetched < lastPage.total ? fetched : undefined;
      },
      initialPageParam: 0,
      enabled: showPlanPicker && !disabled,
      refetchOnWindowFocus: false,
    });

  const attachMutation = useMutation({
    mutationFn: (item: PlanAudioDTO) =>
      attachDayAudio(dayId, item.audio_key, item.duration_ms),
    onSuccess: () => {
      setInputValue("");
      setShowSuggestions(false);
      toast.success(t("studio.day_audio.attached"));
      onAttached();
    },
    onError: (error: unknown) => {
      toast.error(t("studio.day_audio.attach_failed"), {
        description: getApiErrorMessage(
          error,
          t("studio.day_audio.attach_failed_description"),
        ),
      });
    },
  });

  const results = data?.pages.flatMap((page) => page.audio) ?? [];
  const total = data?.pages[0]?.total ?? 0;
  const planOptions = planSearchData?.pages.flatMap((page) => page.plans) ?? [];

  const handleSelect = (item: PlanAudioDTO) => {
    if (attachMutation.isPending) return;
    attachMutation.mutate(item);
  };

  const pauseOtherPlayers = (playingId: string) => {
    audioRefs.current.forEach((el, id) => {
      if (id !== playingId && !el.paused) el.pause();
    });
  };

  const selectPlanFilter = (id: string, title: string) => {
    setFilterPlanId(id);
    setFilterPlanTitle(title);
    setPlanSearchInput("");
    setShowPlanPicker(false);
    setShowSuggestions(true);
  };

  const clearPlanFilter = () => {
    setFilterPlanId(undefined);
    setFilterPlanTitle("");
    setPlanSearchInput("");
    setShowPlanPicker(false);
    setShowSuggestions(true);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
        setShowPlanPicker(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const showDropdown = showSuggestions && !disabled;
  const attachingKey = attachMutation.isPending
    ? attachMutation.variables?.audio_key
    : null;

  const filterPlanLabel =
    filterPlanTitle ||
    (filterPlanId != null
      ? t("studio.day_audio.this_plan")
      : t("studio.day_audio.all_plans"));

  const showPlanDropdown =
    showPlanPicker &&
    !disabled &&
    (isPlanSearchFetching ||
      planOptions.length > 0 ||
      planSearchTerm.length > 0);

  return (
    <div ref={containerRef} className="space-y-2">
      <p className="text-sm font-medium text-muted-foreground">
        {t("studio.day_audio.search_existing")}
      </p>
      <div className="flex items-center gap-2">
        <div className="space-y-1">
          <div className="relative">
            <Input
              placeholder={t("studio.day_audio.search_plans")}
              className="border shadow-none bg-white dark:bg-sidebar-secondary pr-9"
              value={showPlanPicker ? planSearchInput : filterPlanLabel}
              disabled={disabled || attachMutation.isPending}
              autoComplete="off"
              onChange={(e) => {
                setPlanSearchInput(e.target.value);
                setShowPlanPicker(true);
                setShowSuggestions(true);
              }}
              onFocus={() => {
                setPlanSearchInput("");
                setShowPlanPicker(true);
                setShowSuggestions(true);
              }}
            />
            {filterPlanId != null && !showPlanPicker && (
              <button
                type="button"
                aria-label={t("studio.day_audio.clear_plan_filter")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                disabled={disabled || attachMutation.isPending}
                onClick={clearPlanFilter}
              >
                <IoMdClose className="h-4 w-4" />
              </button>
            )}
            {showPlanDropdown && (
              <ul className="absolute z-50 mt-1 w-full max-h-48 overflow-y-auto rounded-md border bg-white dark:bg-[#1e1e1e] shadow-md py-1">
                {filterPlanId != null && (
                  <li>
                    <button
                      type="button"
                      className="w-full px-3 py-2 text-left text-sm text-muted-foreground hover:bg-muted/50 border-b"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={clearPlanFilter}
                    >
                      {t("studio.day_audio.all_plans")}
                    </button>
                  </li>
                )}
                {isPlanSearchFetching && planOptions.length === 0 && (
                  <li className="px-3 py-2 text-sm text-muted-foreground flex items-center gap-2">
                    <FiLoader className="w-4 h-4 animate-spin" />
                    {t("studio.day_audio.searching_plans")}
                  </li>
                )}
                {planOptions.map((plan) => (
                  <li key={plan.id}>
                    <button
                      type="button"
                      className="w-full px-3 py-2 text-left text-sm hover:bg-muted/50 truncate"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => selectPlanFilter(plan.id, plan.title)}
                    >
                      {plan.title}
                      {plan.id === planId
                        ? ` ${t("studio.day_audio.current_suffix")}`
                        : ""}
                    </button>
                  </li>
                ))}
                {!isPlanSearchFetching &&
                  planOptions.length === 0 &&
                  planSearchTerm.length > 0 && (
                    <li className="px-3 py-2 text-sm text-muted-foreground">
                      {t("studio.day_audio.no_plans")}
                    </li>
                  )}
              </ul>
            )}
          </div>
        </div>

        <div className="relative w-full">
          <Input
            placeholder={t("studio.day_audio.search_files")}
            className="border shadow-none bg-white dark:bg-sidebar-secondary"
            value={inputValue}
            disabled={disabled || attachMutation.isPending}
            autoComplete="off"
            aria-autocomplete="list"
            aria-expanded={showDropdown}
            onChange={(e) => {
              setInputValue(e.target.value);
              setShowSuggestions(true);
            }}
            onFocus={() => setShowSuggestions(true)}
          />

          {showDropdown && (
            <ul className="absolute z-50 mt-1 w-full max-h-72 overflow-y-auto rounded-md border bg-white dark:bg-[#1e1e1e] shadow-md py-1">
              {isFetching && results.length === 0 && (
                <li className="px-3 py-2 text-sm text-muted-foreground flex items-center gap-2">
                  <FiLoader className="w-4 h-4 animate-spin" />
                  {t("studio.day_audio.searching")}
                </li>
              )}

              {results.map((item) => {
                const isAttaching = attachingKey === item.audio_key;
                const durationLabel =
                  item.duration_ms != null ? formatMs(item.duration_ms) : null;
                return (
                  <li
                    key={item.id}
                    className="px-3 py-2 space-y-2 border-b border-border/50 last:border-b-0 hover:bg-muted/30"
                  >
                    <div className="flex items-start justify-between gap-2 min-w-0">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">
                          {item.file_name}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {t("studio.day_audio.day_label", {
                            number: item.day_number,
                          })}
                          {item.plan_id === planId
                            ? ` ${t("studio.day_audio.this_plan_suffix")}`
                            : ""}
                          {durationLabel ? ` · ${durationLabel}` : ""}
                        </p>
                      </div>
                      <Pecha.Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="shrink-0 h-8 text-xs"
                        disabled={attachMutation.isPending}
                        onClick={() => handleSelect(item)}
                      >
                        {isAttaching ? (
                          <FiLoader className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          t("studio.day_audio.use")
                        )}
                      </Pecha.Button>
                    </div>
                    <audio
                      ref={(el) => {
                        if (el) audioRefs.current.set(item.id, el);
                        else audioRefs.current.delete(item.id);
                      }}
                      controls
                      src={item.audio_url}
                      preload="none"
                      className="h-8 w-full min-w-0"
                      onClick={(e) => e.stopPropagation()}
                      onPlay={() => pauseOtherPlayers(item.id)}
                    />
                  </li>
                );
              })}

              {!isFetching && results.length === 0 && (
                <li className="px-3 py-2 text-sm text-muted-foreground">
                  {searchTerm
                    ? t("studio.day_audio.no_audio_found")
                    : t("studio.day_audio.library_empty")}
                </li>
              )}

              {hasNextPage && (
                <li className="border-t">
                  <button
                    type="button"
                    className="w-full px-3 py-2 text-left text-sm text-[#A51C21] hover:bg-muted/50 disabled:opacity-50"
                    disabled={isFetchingNextPage}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => fetchNextPage()}
                  >
                    {isFetchingNextPage
                      ? t("studio.editor.link.loading_more")
                      : t("studio.day_audio.load_more", {
                          count: results.length,
                          total,
                        })}
                  </button>
                </li>
              )}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};

export default PlanAudioSearchInput;
