import { Pecha } from "@/components/ui/shadimport";
import { useCallback, useEffect, useMemo, useState } from "react";
import { IoMdSearch } from "react-icons/io";
import { useTranslate } from "@tolgee/react";
import { useDebounce } from "use-debounce";
import { useQuery, useInfiniteQuery } from "@tanstack/react-query";
import { useInView } from "react-intersection-observer";
import SourceItem from "./sourceItem";
import pechaIcon from "@/assets/icon/pecha_icon.png";
import { Pagination } from "@/components/ui/molecules/pagination/Pagination";
import SelectedSourceDetail from "./SourceDetail";
import {
  searchSources,
  searchTitles,
  fetchTextDetails,
  fetchTextSegmentCount,
} from "@/components/api/searchApi";
import {
  flattenSegments,
  getFirstSegmentId,
  getLastSegmentId,
} from "@/lib/utils";
import type { SourceData } from "./SourceDetail";

/** The sheet previews one page at a time. A long selection is not downloaded
 * through this query — Add asks for that window in a single request. */
const PREVIEW_PAGE_SIZE = 20;

type TextDetailsPageParam =
  | {
      segmentId?: string;
      direction?: "next" | "previous";
      start?: number;
      end?: number;
      size?: number;
    }
  | undefined;

interface SourceSelectorSheetProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onAddSource: (sourceData: SourceData) => void;
}

export const SourceSelectorSheet = ({
  isOpen,
  onOpenChange,
  onAddSource,
}: SourceSelectorSheetProps) => {
  const [searchFilter, setSearchFilter] = useState("");
  const [debouncedSearchFilter] = useDebounce(searchFilter, 500);
  const [pagination, setPagination] = useState({ currentPage: 1, limit: 10 });
  const [searchOnlyTitles, setSearchOnlyTitles] = useState(true);
  const [selectedSource, setSelectedSource] = useState<any>(null);
  const [segmentRange, setSegmentRange] = useState<{
    start: number;
    end: number;
  } | null>(null);
  const [scrollToSegmentNumber, setScrollToSegmentNumber] = useState<
    number | null
  >(null);
  /** After a previous-page fetch (or initial/range load), wait until top leaves view before fetching again. */
  const [blockPreviousUntilLeave, setBlockPreviousUntilLeave] = useState(true);
  const { t } = useTranslate();

  const skip = useMemo(
    () => (pagination.currentPage - 1) * pagination.limit,
    [pagination],
  );

  const { data: multilingualData, isLoading: isMultilingualLoading } = useQuery(
    {
      queryKey: [
        "topics",
        debouncedSearchFilter,
        pagination.currentPage,
        pagination.limit,
      ],
      queryFn: () =>
        searchSources({
          query: debouncedSearchFilter,
          limit: pagination.limit,
          skip,
        }),
      refetchOnWindowFocus: false,
      enabled: isOpen && !searchOnlyTitles && debouncedSearchFilter.length > 0,
    },
  );

  const { data: titleData, isLoading: isTitleLoading } = useQuery({
    queryKey: [
      "titleSearch",
      debouncedSearchFilter,
      pagination.currentPage,
      pagination.limit,
    ],
    queryFn: () =>
      searchTitles({
        title: debouncedSearchFilter,
        limit: pagination.limit,
        offset: skip,
      }),
    refetchOnWindowFocus: false,
    enabled: isOpen && searchOnlyTitles && debouncedSearchFilter.length > 0,
  });

  const {
    data: detailsData,
    fetchNextPage,
    fetchPreviousPage,
    hasNextPage,
    hasPreviousPage,
    isFetchingNextPage,
    isFetchingPreviousPage,
  } = useInfiniteQuery<
    any,
    Error,
    any,
    (string | { start: number; end: number } | null | undefined)[],
    TextDetailsPageParam
  >({
    queryKey: ["textDetails", selectedSource?.id, segmentRange],
    initialPageParam: (segmentRange
      ? { start: segmentRange.start, end: segmentRange.end }
      : { size: PREVIEW_PAGE_SIZE }) as TextDetailsPageParam,
    queryFn: ({ pageParam }) =>
      fetchTextDetails({
        textId: selectedSource.id,
        segmentId: pageParam?.segmentId,
        direction: pageParam?.direction,
        size: pageParam?.size ?? PREVIEW_PAGE_SIZE,
        start: pageParam?.start,
        end: pageParam?.end,
      }),
    getNextPageParam: (lastPage) => {
      if (!lastPage?.has_more_down) return undefined;
      const segments = flattenSegments(lastPage.content.sections);
      const lastNumber = segments.at(-1)?.segment_number;
      if (!lastNumber) {
        const lastSegmentId = getLastSegmentId(lastPage.content.sections);
        if (!lastSegmentId) return undefined;
        return {
          segmentId: lastSegmentId,
          direction: "next" as const,
          size: PREVIEW_PAGE_SIZE,
        };
      }
      return { start: lastNumber + 1, end: lastNumber + PREVIEW_PAGE_SIZE };
    },
    getPreviousPageParam: (firstPage) => {
      if (!firstPage?.has_more_up) return undefined;
      const segments = flattenSegments(firstPage.content.sections);
      const firstNumber = segments[0]?.segment_number;
      if (!firstNumber || firstNumber <= 1) {
        const firstSegmentId = getFirstSegmentId(firstPage.content.sections);
        if (!firstSegmentId) return undefined;
        return {
          segmentId: firstSegmentId,
          direction: "previous" as const,
          size: PREVIEW_PAGE_SIZE,
        };
      }
      return {
        start: Math.max(1, firstNumber - PREVIEW_PAGE_SIZE),
        end: firstNumber - 1,
      };
    },
    enabled: !!selectedSource?.id && searchOnlyTitles,
    refetchOnWindowFocus: false,
  });

  const { ref: bottomSentinelRef, inView: isBottomVisible } = useInView({
    threshold: 0.1,
    rootMargin: "50px",
  });

  const { ref: topSentinelRef, inView: isTopVisible } = useInView({
    threshold: 0.1,
    rootMargin: "50px",
  });

  useEffect(() => {
    if (isBottomVisible && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [isBottomVisible, hasNextPage, isFetchingNextPage, fetchNextPage]);

  // While previous pages are loading/prepended, the top sentinel often stays in view —
  // block further upward fetches until the user scrolls away from the top.
  useEffect(() => {
    if (isFetchingPreviousPage) {
      setBlockPreviousUntilLeave(true);
    }
  }, [isFetchingPreviousPage]);

  useEffect(() => {
    if (blockPreviousUntilLeave && !isTopVisible) {
      setBlockPreviousUntilLeave(false);
    }
  }, [blockPreviousUntilLeave, isTopVisible]);

  useEffect(() => {
    if (blockPreviousUntilLeave) return;
    if (isTopVisible && hasPreviousPage && !isFetchingPreviousPage) {
      void fetchPreviousPage();
    }
  }, [
    blockPreviousUntilLeave,
    isTopVisible,
    hasPreviousPage,
    isFetchingPreviousPage,
    fetchPreviousPage,
  ]);

  // The text's real length, asked for on its own so "Select All" can cover the
  // whole text before any of it has been paged in.
  const { data: segmentCount } = useQuery({
    queryKey: ["textSegmentCount", selectedSource?.id],
    queryFn: () => fetchTextSegmentCount(selectedSource.id),
    enabled: !!selectedSource?.id && searchOnlyTitles,
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000,
  });

  const detailSegments = useMemo(() => {
    if (!detailsData?.pages) return [];
    const allSegments = detailsData.pages.flatMap((page: any) =>
      flattenSegments(page.content.sections),
    );
    return Array.from(
      new Map(allSegments.map((s: any) => [s.segment_id, s])).values(),
    ).sort(
      (a: any, b: any) => (a.segment_number ?? 0) - (b.segment_number ?? 0),
    );
  }, [detailsData?.pages]);

  const totalSegments =
    segmentCount ?? detailsData?.pages?.[0]?.total_segments ?? 0;

  const handleRangeNavigate = useCallback((start: number, end: number) => {
    setBlockPreviousUntilLeave(true);
    // Jump the preview to the start of the range. Keep the page short so
    // Select All does not turn into a request for every segment.
    setSegmentRange({
      start,
      end: Math.min(end, start + PREVIEW_PAGE_SIZE - 1),
    });
    setScrollToSegmentNumber(start);
  }, []);

  const isLoading = searchOnlyTitles ? isTitleLoading : isMultilingualLoading;

  const sources = searchOnlyTitles
    ? titleData || []
    : multilingualData?.sources || [];

  const segments = searchOnlyTitles
    ? detailSegments
    : selectedSource?.segment_matches || [];

  const totalSearchResults = multilingualData?.total || 0;
  const totalPages = Math.ceil(totalSearchResults / pagination.limit);

  const handlePageChange = (pageNumber: number) => {
    setPagination((prev) => ({ ...prev, currentPage: pageNumber }));
  };

  const handleAddSource = (sourceData: SourceData) => {
    if (sourceData?.content) {
      onAddSource(sourceData);
      onOpenChange(false);
      setSelectedSource(null);
      setSegmentRange(null);
      setScrollToSegmentNumber(null);
    }
  };

  const handleTitleClick = (source: any) => {
    setSelectedSource((prev: any) => {
      if (prev?.id === source.id) return null;
      setSegmentRange(null);
      setScrollToSegmentNumber(null);
      setBlockPreviousUntilLeave(true);
      return source;
    });
  };

  const renderSegmentList = () => {
    if (sources.length === 0) {
      return (
        <div className="text-center min-h-[400px] flex items-center justify-center flex-col">
          <img
            src={pechaIcon}
            alt={t("studio.source.no_data_found")}
            className="w-15 h-15 opacity-80"
          />
          <p>{t("studio.source.no_data_found")}</p>
          <span className="dark:text-[#b1b1b1] text-gray-600">
            {t("studio.source.try_adjusting_search")}
          </span>
        </div>
      );
    }

    if (searchOnlyTitles) {
      return (
        <>
          {sources.map((source: any, index: number) => {
            const isSelected = selectedSource?.id === source.id;
            return (
              <div key={source.id || index}>
                <button
                  className={`border p-3 rounded-md text-left w-full flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-input/50 ${
                    isSelected
                      ? "border-[#801A1E] dark:border-[#801A1E]"
                      : "border-gray-300 dark:border-[#313132]"
                  }`}
                  onClick={() => handleTitleClick(source)}
                >
                  <p className="font-bold text-[#801A1E] dark:text-[#b0b0b0]">
                    {source.title}
                  </p>
                  <img
                    src={pechaIcon}
                    alt={t("studio.source.source_icon_alt")}
                    className="w-8 h-8"
                  />
                </button>

                {isSelected && (
                  <SelectedSourceDetail
                    segments={segments}
                    selectedSource={selectedSource}
                    onAdd={handleAddSource}
                    bottomRef={bottomSentinelRef}
                    topRef={topSentinelRef}
                    isFetchingNextPage={isFetchingNextPage}
                    isFetchingPreviousPage={isFetchingPreviousPage}
                    totalSegments={totalSegments}
                    onRangeNavigate={handleRangeNavigate}
                    scrollToSegmentNumber={scrollToSegmentNumber}
                  />
                )}
              </div>
            );
          })}
        </>
      );
    }

    return sources.map((source: any) => (
      <SourceItem
        key={source.text.text_id}
        source={source}
        onSegment={handleAddSource}
        searchQuery={debouncedSearchFilter}
      />
    ));
  };

  return (
    <Pecha.Sheet
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          setSelectedSource(null);
          setSearchFilter("");
          setPagination({ currentPage: 1, limit: 10 });
          setSegmentRange(null);
          setScrollToSegmentNumber(null);
        }
        onOpenChange(open);
      }}
    >
      <Pecha.SheetContent side="right" className="w-full sm:max-w-md">
        <Pecha.SheetHeader>
          <Pecha.SheetTitle>{t("studio.source.add_source")}</Pecha.SheetTitle>
          <Pecha.SheetDescription>
            {t("studio.source.sheet_description")}
          </Pecha.SheetDescription>
        </Pecha.SheetHeader>
        <div className="border-b w-full border-dashed border-gray-300 dark:border-input" />
        <div className="px-2 pt-2">
          <div className="border w-full px-2 rounded-md border-gray-200 dark:border-[#313132] flex items-center">
            <IoMdSearch className="w-4 h-4" />
            <Pecha.Input
              placeholder={t("common.placeholder.search")}
              className="rounded-md border-none dark:bg-transparent px-4 shadow-none py-2"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
            />
          </div>
          <label className="flex items-center gap-2 px-1 pt-5 cursor-pointer">
            <Pecha.Checkbox
              checked={searchOnlyTitles}
              onCheckedChange={(checked: boolean) => {
                setSearchOnlyTitles(!!checked);
                setPagination({ currentPage: 1, limit: 10 });
                setSelectedSource(null);
                setSegmentRange(null);
                setScrollToSegmentNumber(null);
              }}
              className="data-[state=checked]:bg-transparent data-[state=checked]:text-primary"
            />
            <span className="text-sm select-none">
              {t("studio.source.search_only_titles")}
            </span>
          </label>
        </div>
        <div className="h-[calc(100vh-200px)] overflow-hidden flex flex-col">
          <div className="px-4 pb-4 pt-2 flex-1 min-h-0 overflow-y-auto space-y-4 [&::-webkit-scrollbar]:hidden [scrollbar-width:none]">
            {isLoading ? (
              <div className="w-full flex items-center justify-center h-full">
                <p>{t("studio.source.loading_segments")}</p>
              </div>
            ) : (
              renderSegmentList()
            )}
          </div>
        </div>
        {sources.length > 0 && !searchOnlyTitles && (
          <Pagination
            currentPage={pagination.currentPage}
            totalPages={totalPages}
            onPageChange={handlePageChange}
          />
        )}
      </Pecha.SheetContent>
    </Pecha.Sheet>
  );
};
