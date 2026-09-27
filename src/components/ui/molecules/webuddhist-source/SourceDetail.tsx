import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Pecha } from "@/components/ui/shadimport";
import { useDebounce } from "use-debounce";
import { fetchTextDetails } from "@/components/api/searchApi";
import { flattenSegments, parseRangeBounds, parseSelection } from "@/lib/utils";

/** A whole-text selection can run to thousands of segments; past this many the
 * preview list is trimmed so the sheet stays responsive. Add does not wait for
 * those rows — it loads the selected window in one request. */
const MAX_RENDERED_SEGMENTS = 200;

export interface SourceData {
  content: string;
  pecha_segment_id: string;
  text_id: string;
  segment_ids: string[];
  segment_numbers?: number[];
}

const SelectedSourceDetail = ({
  segments,
  selectedSource,
  onAdd,
  bottomRef,
  topRef,
  isFetchingNextPage,
  isFetchingPreviousPage,
  totalSegments = 0,
  onRangeNavigate,
  scrollToSegmentNumber,
}: {
  segments: any[];
  selectedSource: any;
  onAdd: (sourceData: SourceData) => void;
  bottomRef?: (node?: Element | null) => void;
  topRef?: (node?: Element | null) => void;
  isFetchingNextPage?: boolean;
  isFetchingPreviousPage?: boolean;
  totalSegments?: number;
  onRangeNavigate?: (start: number, end: number) => void;
  scrollToSegmentNumber?: number | null;
}) => {
  const [rangeInput, setRangeInput] = useState("");
  const [selectAll, setSelectAll] = useState(false);
  const [isResolvingSelection, setIsResolvingSelection] = useState(false);
  const [debouncedRangeInput] = useDebounce(rangeInput, 400);
  const lastNavigatedRange = useRef<string | null>(null);
  const scrolledToRef = useRef<number | null>(null);
  const addRequestRef = useRef(0);

  const selectionMax = totalSegments || segments.length;

  const selectedIndices = useMemo(() => {
    if (!selectionMax) return null;
    return parseSelection(rangeInput, selectionMax);
  }, [rangeInput, selectionMax]);

  const loadedSegmentNumbers = useMemo(() => {
    const numbers = new Set<number>();
    segments.forEach((seg: any, i: number) => {
      numbers.add(seg.segment_number ?? i + 1);
    });
    return numbers;
  }, [segments]);

  const rangePending =
    Boolean(parseRangeBounds(rangeInput)) &&
    rangeInput.trim() !== debouncedRangeInput.trim();

  const isAddDisabled =
    !selectedIndices || rangePending || isResolvingSelection;

  useEffect(() => {
    addRequestRef.current += 1;
    lastNavigatedRange.current = null;
    scrolledToRef.current = null;
    setIsResolvingSelection(false);
    setRangeInput("");
    setSelectAll(false);
  }, [selectedSource?.id]);

  useEffect(() => {
    const bounds = parseRangeBounds(debouncedRangeInput);
    if (!bounds || !onRangeNavigate) return;

    const key = `${bounds.start}-${bounds.end}`;
    if (lastNavigatedRange.current === key) return;
    lastNavigatedRange.current = key;
    scrolledToRef.current = null;
    onRangeNavigate(bounds.start, bounds.end);
  }, [debouncedRangeInput, onRangeNavigate]);

  useEffect(() => {
    if (scrollToSegmentNumber == null) {
      scrolledToRef.current = null;
      return;
    }
    // Only scroll once per range jump — not again when infinite-scroll appends pages.
    if (scrolledToRef.current === scrollToSegmentNumber) return;
    if (!loadedSegmentNumbers.has(scrollToSegmentNumber)) return;

    scrolledToRef.current = scrollToSegmentNumber;
    requestAnimationFrame(() => {
      const el = document.querySelector(
        `[data-segment-number="${scrollToSegmentNumber}"]`,
      );
      if (!el) {
        scrolledToRef.current = null;
        return;
      }
      const viewport = el.closest(
        '[data-slot="scroll-area-viewport"]',
      ) as HTMLElement | null;
      if (viewport) {
        const elRect = el.getBoundingClientRect();
        const vpRect = viewport.getBoundingClientRect();
        viewport.scrollTo({
          top: viewport.scrollTop + (elRect.top - vpRect.top),
          behavior: "smooth",
        });
        return;
      }
      el.scrollIntoView({ block: "start", behavior: "smooth" });
    });
  }, [scrollToSegmentNumber, loadedSegmentNumbers]);

  // The count comes from the library API rather than from the pages loaded so
  // far, so the whole text is selectable without typing a range or scrolling
  // to the end. The preview only jumps to the start of that range; Add loads
  // the selected window itself.
  const handleSelectAll = (checked: boolean) => {
    // Same as editing the range: a fetch already in flight was for the previous
    // selection, and must not Add after Select All is cleared or replaced.
    addRequestRef.current += 1;
    setIsResolvingSelection(false);
    setSelectAll(checked);
    if (checked && selectionMax > 0) {
      setRangeInput(`1-${selectionMax}`);
    } else {
      setRangeInput("");
    }
  };

  const visibleSegments =
    selectAll && segments.length > MAX_RENDERED_SEGMENTS
      ? segments.slice(0, MAX_RENDERED_SEGMENTS)
      : segments;
  const hiddenSegmentCount = segments.length - visibleSegments.length;

  /** `firstNumber` is the absolute number of the pool's first row, used only
   * when the API leaves `segment_number` off: a window fetched for 500-520
   * is numbered from 500, not from 1. */
  const segmentsForNumbers = (
    pool: any[],
    numbers: number[],
    firstNumber = 1,
  ) => {
    const byNumber = new Map<number, any>();
    pool.forEach((seg: any, index: number) => {
      byNumber.set(seg.segment_number ?? firstNumber + index, seg);
    });
    return numbers
      .map((number) => byNumber.get(number))
      .filter((seg) => seg != null);
  };

  const handleRangeInputChange = (value: string) => {
    addRequestRef.current += 1;
    setIsResolvingSelection(false);
    setRangeInput(value);
    setSelectAll(false);
  };

  const handleAdd = async () => {
    if (!selectedIndices || !selectedSource || isResolvingSelection) return;
    const request = addRequestRef.current + 1;
    addRequestRef.current = request;
    const sortedIndices = Array.from(selectedIndices).sort((a, b) => a - b);
    let selected = segmentsForNumbers(segments, sortedIndices);

    // The preview pages 20 segments at a time. A long range is loaded here, in
    // one details request, instead of by scrolling that preview to the end.
    if (selected.length !== sortedIndices.length) {
      const bounds = parseRangeBounds(rangeInput);
      if (!bounds) return;
      const start = bounds.start;
      const end = Math.min(bounds.end, selectionMax);
      setIsResolvingSelection(true);
      try {
        const page = await fetchTextDetails({
          textId: selectedSource.id,
          start,
          end,
          size: end - start + 1,
        });
        if (addRequestRef.current !== request) return;
        selected = segmentsForNumbers(
          flattenSegments(page?.content?.sections ?? []),
          sortedIndices,
          start,
        );
      } catch {
        if (addRequestRef.current !== request) return;
        toast.error("Couldn't load the selected segments. Try again.");
        return;
      } finally {
        if (addRequestRef.current === request) {
          setIsResolvingSelection(false);
        }
      }
    }

    if (addRequestRef.current !== request) return;
    if (selected.length !== sortedIndices.length) {
      toast.error("Couldn't load the selected segments. Try again.");
      return;
    }

    const content = selected.map((seg: any) => seg.content).join("\n");
    const segmentIds = selected.map((seg: any) => seg.segment_id);
    const pechaSegmentId = selected[0]?.pecha_segment_id || "";

    onAdd({
      content,
      pecha_segment_id: pechaSegmentId,
      text_id: selectedSource.id,
      segment_ids: segmentIds,
      // Each row was looked up by number, and the lengths matched above, so
      // the selection's own numbers are the absolute ones.
      segment_numbers: sortedIndices,
    });
  };

  return (
    <div className="mt-3 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          Select Range (e.g. 1-{selectionMax || "N"})
        </span>
        <label
          className={`flex items-center gap-1.5 ${
            selectionMax === 0
              ? "cursor-not-allowed opacity-60"
              : "cursor-pointer"
          }`}
        >
          <span
            className={`text-sm select-none${selectAll ? "" : " text-muted-foreground"}`}
          >
            Select All
          </span>
          <Pecha.Checkbox
            checked={selectAll}
            disabled={selectionMax === 0}
            onCheckedChange={(checked: boolean) => handleSelectAll(!!checked)}
            className="data-[state=checked]:bg-transparent dark:data-[state=checked]:bg-transparent data-[state=checked]:text-primary"
          />
        </label>
      </div>

      <div className="flex items-center gap-2">
        <Pecha.Input
          placeholder="1-10"
          value={rangeInput}
          onChange={(e) => handleRangeInputChange(e.target.value)}
          className={`flex-1 h-10 ${rangeInput.trim() !== "" && !rangeInput.trim().endsWith("-") && !selectedIndices ? "ring-1 ring-red-500 dark:ring-red-400" : ""}`}
        />
        <Pecha.Button
          type="button"
          variant="destructive"
          disabled={isAddDisabled}
          aria-busy={isResolvingSelection}
          onClick={handleAdd}
          className="h-10 px-6 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isResolvingSelection || rangePending ? "Loading…" : "Add"}
        </Pecha.Button>
      </div>

      {rangeInput.trim() !== "" &&
        !rangeInput.trim().endsWith("-") &&
        !selectedIndices && (
          <p className="text-xs text-red-500 dark:text-red-400 -mt-1">
            Enter a single number (e.g. 3) or a range (e.g. 1-10)
          </p>
        )}

      <Pecha.ScrollArea
        type="scroll"
        className="border border-[#DEDEDE] dark:border-[#313132] rounded-[10px] h-[calc(100vh-380px)]"
      >
        <div className="p-4 space-y-4">
          {segments.length === 0 &&
            !isFetchingNextPage &&
            !isFetchingPreviousPage && (
              <p className="text-center text-sm text-gray-500">
                Loading segments...
              </p>
            )}
          {topRef && (
            <div
              ref={topRef}
              className="h-5 w-full opacity-0 pointer-events-none"
            />
          )}
          {isFetchingPreviousPage && (
            <p className="text-center text-sm text-gray-500">
              Loading earlier segments...
            </p>
          )}
          {visibleSegments.map((segment: any, segIndex: number) => {
            const segmentNumber = segment.segment_number ?? segIndex + 1;
            const isSelected = selectedIndices?.has(segmentNumber);
            return (
              <div
                key={segment.segment_id || segIndex}
                data-segment-number={segmentNumber}
                className={`border p-3 rounded-[10px] text-sm transition-colors bg-[#F9F9F9] dark:bg-sidebar-secondary  ${
                  isSelected
                    ? "border-solid border-foreground dark:border-foreground"
                    : "dark:bg-sidebar-secondary border-dashed border-[#E1E1E1] dark:border-[#313132]"
                }`}
              >
                <span className="font-medium">{segmentNumber}. </span>
                <span
                  dangerouslySetInnerHTML={{
                    __html: segment.content,
                  }}
                />
              </div>
            );
          })}
          {hiddenSegmentCount > 0 && (
            <p className="text-center text-sm text-gray-500">
              … and {hiddenSegmentCount} more selected segment
              {hiddenSegmentCount === 1 ? "" : "s"} not shown
            </p>
          )}
          {bottomRef && (
            <div
              ref={bottomRef}
              className="h-5 w-full opacity-0 pointer-events-none"
            />
          )}
          {isFetchingNextPage && (
            <p className="text-center text-sm text-gray-500">
              Loading more segments...
            </p>
          )}
        </div>
      </Pecha.ScrollArea>
    </div>
  );
};

export default SelectedSourceDetail;
