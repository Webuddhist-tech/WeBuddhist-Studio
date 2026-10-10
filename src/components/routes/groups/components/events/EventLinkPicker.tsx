import { useEffect, useState } from "react";
import { useTranslate } from "@tolgee/react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useInView } from "react-intersection-observer";
import { IoMdClose } from "react-icons/io";
import { FaMagnifyingGlass } from "react-icons/fa6";
import { NO_PROFILE_IMAGE } from "@/lib/constant";
import type { FkOption } from "../FkMultiSearchSelector";

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

type EventLinkPickerProps = {
  label: string;
  value: FkOption | null;
  onChange: (item: FkOption | null) => void;
  searchFn: SearchFn;
  queryKeyPrefix: string;
  searchPlaceholder?: string;
  disabled?: boolean;
};

const PAGE_SIZE = 20;
const DEBOUNCE_MS = 600;

const EventLinkPicker = ({
  label,
  value,
  onChange,
  searchFn,
  queryKeyPrefix,
  searchPlaceholder,
  disabled = false,
}: EventLinkPickerProps) => {
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
      enabled: isDropdownOpen && !disabled,
    });

  const searchResults: FkOption[] =
    data?.pages.flatMap((page) => page.items) ?? [];

  const { ref: sentinelRef, inView } = useInView({ threshold: 0 });
  useEffect(() => {
    if (inView && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [inView, hasNextPage, isFetchingNextPage, fetchNextPage]);

  const handleSelect = (item: FkOption) => {
    onChange(item);
    setIsDropdownOpen(false);
    setSearchQuery("");
  };

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{label}</p>

      {value ? (
        <div className="flex items-center gap-2 rounded-md border border-input bg-white p-2 dark:bg-[#262626]">
          <img
            src={value.image_url || NO_PROFILE_IMAGE}
            alt=""
            className="h-9 w-9 shrink-0 rounded object-cover"
          />
          <span className="min-w-0 flex-1 truncate text-sm">{value.title}</span>
          {value.kind ? (
            <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              {value.kind}
            </span>
          ) : null}
          {!disabled ? (
            <button
              type="button"
              onClick={() => onChange(null)}
              aria-label={t("studio.groups.events.links.remove_item_aria", {
                name: value.title,
              })}
              className="shrink-0 cursor-pointer p-1 text-muted-foreground hover:text-foreground"
            >
              <IoMdClose className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      ) : (
        <div className="relative">
          <FaMagnifyingGlass className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder={
              searchPlaceholder ??
              t("studio.groups.events.links.search_placeholder")
            }
            value={searchQuery}
            disabled={disabled}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setIsDropdownOpen(true)}
            onBlur={() => setTimeout(() => setIsDropdownOpen(false), 150)}
            className="h-11 w-full rounded-md border border-input bg-white pl-10 pr-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 dark:bg-[#262626] dark:text-white"
          />

          {isDropdownOpen && !disabled && (
            <div className="absolute z-10 mt-1 max-h-52 w-full overflow-auto rounded-md border border-input bg-background shadow-md dark:bg-[#262626]">
              {isLoading && searchResults.length === 0 && (
                <div className="px-3 py-2 text-sm text-muted-foreground">
                  {t("studio.groups.events.links.searching")}
                </div>
              )}
              {searchResults.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleSelect(item);
                  }}
                  className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left hover:bg-gray-100 dark:hover:bg-[#333333]"
                >
                  <img
                    src={item.image_url || NO_PROFILE_IMAGE}
                    alt=""
                    className="h-8 w-8 shrink-0 rounded object-cover"
                  />
                  <span className="min-w-0 flex-1 truncate text-sm">
                    {item.title}
                  </span>
                  {item.kind ? (
                    <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                      {item.kind}
                    </span>
                  ) : null}
                </button>
              ))}
              {hasNextPage && (
                <div
                  ref={sentinelRef}
                  className="px-3 py-2 text-center text-xs text-muted-foreground"
                >
                  {isFetchingNextPage
                    ? t("studio.groups.events.links.loading_more")
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
      )}
    </div>
  );
};

export default EventLinkPicker;
