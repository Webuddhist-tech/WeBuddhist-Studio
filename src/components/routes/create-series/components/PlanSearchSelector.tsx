import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslate } from "@tolgee/react";
import type { UniqueIdentifier } from "@dnd-kit/core";
import { IoMdClose } from "react-icons/io";
import { FaMagnifyingGlass } from "react-icons/fa6";
import { PiDotsSixVertical } from "react-icons/pi";
import {
  searchPlans,
  type Plan,
} from "@/components/routes/create-series/api/planSearchApi";
import type { SeriesPlan } from "@/schema/SeriesSchema";
import { NO_PROFILE_IMAGE } from "@/lib/constant";
import { reorderArray } from "@/lib/utils";
import { SortableList, SortableItem } from "@/components/ui/atoms/sortable";

const PAGE_SIZE = 10;
const DEBOUNCE_MS = 600;

function planToSeriesPlan(plan: Plan): SeriesPlan {
  return {
    id: plan.id,
    title: plan.title,
    image_url: plan.image_url || undefined,
  };
}

type PlanSearchSelectorProps = {
  value: SeriesPlan[];
  onChange: (plans: SeriesPlan[]) => void;
  searchLanguage?: string;
  /** Only plans in this group can be searched and added. */
  groupId?: string;
  /** Hide the inline selected list (e.g. series details shows plans in a table). */
  hideSelectedList?: boolean;
  searchPlaceholder?: string;
  className?: string;
};

const PlanSearchSelector = ({
  value,
  onChange,
  searchLanguage,
  groupId,
  hideSelectedList = false,
  searchPlaceholder,
  className = "",
}: PlanSearchSelectorProps) => {
  const { t } = useTranslate();
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery.trim());
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const { data, isLoading } = useQuery({
    queryKey: ["search-plans", debouncedQuery, searchLanguage, groupId],
    queryFn: () =>
      searchPlans({
        search: debouncedQuery || undefined,
        language: searchLanguage,
        skip: 0,
        limit: PAGE_SIZE,
        ...(groupId ? { group_id: groupId } : {}),
      }),
    enabled: isDropdownOpen && Boolean(groupId),
  });

  const searchResults: Plan[] = data?.plans ?? [];

  const valueIds = new Set(value.map((p) => p.id));

  const handleTogglePlan = (plan: Plan) => {
    const id = plan.id;
    if (valueIds.has(id)) {
      onChange(value.filter((p) => p.id !== id));
    } else {
      onChange([...value, planToSeriesPlan(plan)]);
    }
  };

  const handleRemovePlan = (planId: string) => {
    onChange(value.filter((p) => p.id !== planId));
  };

  const handleReorder = (
    activeId: UniqueIdentifier,
    overId: UniqueIdentifier,
  ) => {
    const next = reorderArray(value, String(activeId), String(overId));
    if (next) onChange(next);
  };

  const showDropdown = isDropdownOpen && Boolean(groupId);
  const showNoResults =
    showDropdown && !isLoading && searchResults.length === 0;
  const showMissingGroup = isDropdownOpen && !groupId;

  const sortableIds = value.map((p) => p.id);
  const canReorder = value.length > 1;

  return (
    <div
      className={`rounded-md ${hideSelectedList ? "" : "min-h-[200px]"} ${className}`}
    >
      {!hideSelectedList && value.length === 0 ? (
        <div className="rounded-md border border-dashed border-muted-foreground/40 px-4 py-8 text-center text-sm text-muted-foreground">
          {t("studio.series.plan_search.empty")}
        </div>
      ) : !hideSelectedList ? (
        <SortableList
          items={sortableIds}
          onReorder={handleReorder}
          disabled={!canReorder}
        >
          <div className="space-y-2 max-h-80 overflow-auto">
            {value.map((plan) => (
              <SortableItem
                key={plan.id}
                id={plan.id}
                disabled={!canReorder}
                className="flex items-center gap-2 rounded-md border border-input bg-white dark:bg-[#262626] p-2"
              >
                {({ listeners }: { listeners: Record<string, unknown> }) => (
                  <>
                    <button
                      type="button"
                      className="shrink-0 p-1 rounded text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing touch-none disabled:opacity-30 disabled:cursor-not-allowed"
                      aria-label={t("studio.series.plans.reorder_aria", {
                        title: plan.title,
                      })}
                      disabled={!canReorder}
                      {...listeners}
                    >
                      <PiDotsSixVertical className="w-4 h-4" />
                    </button>
                    <img
                      src={plan.image_url || NO_PROFILE_IMAGE}
                      alt=""
                      className="w-10 h-10 rounded object-cover shrink-0"
                    />
                    <span className="flex-1 text-sm min-w-0 truncate">
                      {plan.title}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemovePlan(plan.id)}
                      aria-label={t("studio.series.plan_search.remove_aria", {
                        title: plan.title,
                      })}
                      className="text-muted-foreground hover:text-foreground cursor-pointer p-1 shrink-0"
                    >
                      <IoMdClose className="h-4 w-4" />
                    </button>
                  </>
                )}
              </SortableItem>
            ))}
          </div>
        </SortableList>
      ) : null}

      <div className={`relative ${hideSelectedList ? "" : "pt-16"}`}>
        <div className="relative">
          <FaMagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder={
              searchPlaceholder ?? t("studio.series.plan_search.placeholder")
            }
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setIsDropdownOpen(true)}
            onBlur={() => setTimeout(() => setIsDropdownOpen(false), 150)}
            className="h-12 w-full rounded-md border border-input bg-white dark:bg-[#262626] dark:text-white pl-10 pr-3 text-base placeholder:text-muted-foreground focus-visible:outline-none"
          />
        </div>

        {showMissingGroup && (
          <div className="absolute z-10 mt-1 w-full rounded-md border border-input bg-background dark:bg-[#262626] shadow-md px-3 py-2">
            <p className="text-sm text-muted-foreground">
              {t("studio.series.plan_search.missing_group")}
            </p>
          </div>
        )}

        {showDropdown && (
          <div className="absolute z-10 mt-1 w-full rounded-md border border-input bg-background dark:bg-[#262626] shadow-md max-h-60 overflow-auto">
            {isLoading && searchResults.length === 0 && (
              <div className="px-3 py-2 text-sm text-muted-foreground">
                {t("studio.series.plan_search.searching")}
              </div>
            )}

            {searchResults.map((plan) => {
              const isSelected = valueIds.has(plan.id);
              return (
                <button
                  key={plan.id}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleTogglePlan(plan);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-gray-100 dark:hover:bg-[#333333] cursor-pointer"
                >
                  <img
                    src={plan.image_url || NO_PROFILE_IMAGE}
                    alt=""
                    className="w-9 h-9 rounded object-cover shrink-0"
                  />
                  <span className="text-sm flex-1">{plan.title}</span>
                  {isSelected && (
                    <span className="text-sm text-foreground shrink-0">✓</span>
                  )}
                </button>
              );
            })}

            {showNoResults && (
              <div className="px-3 py-2">
                <p className="text-sm text-muted-foreground">
                  {t("studio.series.plan_search.no_plans_found")}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default PlanSearchSelector;
