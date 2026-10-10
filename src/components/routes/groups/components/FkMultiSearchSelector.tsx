import { useEffect, useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useInView } from "react-intersection-observer";
import { IoMdClose } from "react-icons/io";
import { FaMagnifyingGlass } from "react-icons/fa6";
import { useTranslate } from "@tolgee/react";
import { NO_PROFILE_IMAGE } from "@/lib/constant";

export type FkOption = {
  id: string;
  title: string;
  image_url?: string;
  kind?: "plan" | "series";
};

type SearchFn = (params: {
  search?: string;
  skip?: number;
  limit?: number;
}) => Promise<{
  items: FkOption[];
  skip: number;
  limit: number;
  total: number;
}>;

type FkMultiSearchSelectorProps = {
  value: FkOption[];
  onChange: (items: FkOption[]) => void;
  searchFn: SearchFn;
  queryKeyPrefix: string;
  label?: string;
  hideLabel?: boolean;
  searchPlaceholder?: string;
  emptyMessage?: string;
};

const PAGE_SIZE = 20;
const DEBOUNCE_MS = 600;

const FkMultiSearchSelector = ({
  value,
  onChange,
  searchFn,
  queryKeyPrefix,
  label,
  hideLabel = false,
  searchPlaceholder,
  emptyMessage,
}: FkMultiSearchSelectorProps) => {
  const { t } = useTranslate();
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  useEffect(() => {
    const timer = setTimeout(
      () => setDebouncedQuery(searchQuery.trim()),
      DEBOUNCE_MS,
    );
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
    useInfiniteQuery({
      queryKey: [queryKeyPrefix, debouncedQuery],
      queryFn: ({ pageParam = 0 }) =>
        searchFn({
          search: debouncedQuery || undefined,
          skip: pageParam,
          limit: PAGE_SIZE,
        }),
      getNextPageParam: (lastPage) => {
        const fetched = lastPage.skip + lastPage.items.length;
        return fetched < lastPage.total ? fetched : undefined;
      },
      initialPageParam: 0,
      enabled: isDropdownOpen,
    });

  const searchResults: FkOption[] =
    data?.pages.flatMap((page) => page.items) ?? [];

  const { ref: sentinelRef, inView } = useInView({ threshold: 0 });
  useEffect(() => {
    if (inView && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [inView, hasNextPage, isFetchingNextPage, fetchNextPage]);

  const valueIds = new Set(value.map((item) => item.id));

  const handleToggle = (item: FkOption) => {
    if (valueIds.has(item.id)) {
      onChange(value.filter((v) => v.id !== item.id));
    } else {
      onChange([...value, item]);
    }
  };

  const handleRemove = (id: string) => {
    onChange(value.filter((v) => v.id !== id));
  };

  return (
    <div className="space-y-3">
      {!hideLabel && label ? (
        <p className="text-sm font-bold">{label}</p>
      ) : null}

      {value.length === 0 ? (
        <div className="rounded-md border border-dashed border-muted-foreground/40 px-4 py-6 text-center text-sm text-muted-foreground">
          {emptyMessage ?? t("studio.groups.components.fk_selector.empty")}
        </div>
      ) : (
        <div className="space-y-2 max-h-60 overflow-auto">
          {value.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-2 rounded-md border border-input bg-white dark:bg-[#262626] p-2"
            >
              <img
                src={item.image_url || NO_PROFILE_IMAGE}
                alt=""
                className="w-9 h-9 rounded object-cover shrink-0"
              />
              <span className="flex-1 text-sm min-w-0 truncate">
                {item.title}
              </span>
              <button
                type="button"
                onClick={() => handleRemove(item.id)}
                aria-label={t(
                  "studio.groups.components.fk_selector.remove_item",
                  {
                    title: item.title,
                  },
                )}
                className="text-muted-foreground hover:text-foreground cursor-pointer p-1 shrink-0"
              >
                <IoMdClose className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="relative">
        <FaMagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          placeholder={
            searchPlaceholder ??
            t("studio.groups.components.fk_selector.search_placeholder")
          }
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onFocus={() => setIsDropdownOpen(true)}
          onBlur={() => setTimeout(() => setIsDropdownOpen(false), 150)}
          className="h-11 w-full rounded-md border border-input bg-white dark:bg-[#262626] dark:text-white pl-10 pr-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none"
        />

        {isDropdownOpen && (
          <div className="absolute z-10 mt-1 w-full rounded-md border border-input bg-background dark:bg-[#262626] shadow-md max-h-52 overflow-auto">
            {isLoading && searchResults.length === 0 && (
              <div className="px-3 py-2 text-sm text-muted-foreground">
                {t("studio.groups.components.fk_selector.searching")}
              </div>
            )}
            {searchResults.map((item) => {
              const selected = valueIds.has(item.id);
              return (
                <button
                  key={item.id}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleToggle(item);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-gray-100 dark:hover:bg-[#333333] cursor-pointer"
                >
                  <img
                    src={item.image_url || NO_PROFILE_IMAGE}
                    alt=""
                    className="w-8 h-8 rounded object-cover shrink-0"
                  />
                  <span className="text-sm flex-1">{item.title}</span>
                  {selected && (
                    <span className="text-sm text-foreground shrink-0">✓</span>
                  )}
                </button>
              );
            })}
            {hasNextPage && (
              <div
                ref={sentinelRef}
                className="px-3 py-2 text-xs text-muted-foreground text-center"
              >
                {isFetchingNextPage
                  ? t("studio.groups.components.fk_selector.loading_more")
                  : ""}
              </div>
            )}
            {!isLoading && searchResults.length === 0 && (
              <div className="px-3 py-2 text-sm text-muted-foreground">
                {t("studio.common.no_results")}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default FkMultiSearchSelector;
