import { useEffect, useMemo, useState } from "react";
import { useQuery, useInfiniteQuery } from "@tanstack/react-query";
import { useInView } from "react-intersection-observer";
import { useDebounce } from "use-debounce";
import { IoMdSearch } from "react-icons/io";
import { Pecha } from "@/components/ui/shadimport";
import { useTranslate } from "@tolgee/react";
import { Button } from "@/components/ui/atoms/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/atoms/dialog";
import {
  fetchGroups,
  pickGroupTitle,
  type AuthorGroupListItem,
} from "@/components/routes/groups/api/groupsApi";
import {
  fetchTextDetails,
  searchSegments,
  searchTitles,
  type SegmentSearchResult,
} from "@/components/api/searchApi";
import { buildGroupLink, buildSegmentLink } from "@/lib/markdownLinks";
import { flattenSegments, getLastSegmentId } from "@/lib/utils";
import pechaIcon from "@/assets/icon/pecha_icon.png";

type LinkType = "group" | "text" | "segment";

export type MarkdownLinkSelection = {
  label: string;
  url: string;
};

type MarkdownLinkDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedText: string;
  onConfirm: (selection: MarkdownLinkSelection) => void;
};

type TextTitleItem = {
  id: string;
  title: string;
};

type SegmentItem = {
  segment_id: string;
  pecha_segment_id?: string;
  content: string;
};

const DEBOUNCE_MS = 500;

const MarkdownLinkDialog = ({
  open,
  onOpenChange,
  selectedText,
  onConfirm,
}: MarkdownLinkDialogProps) => {
  const { t } = useTranslate();
  const [linkType, setLinkType] = useState<LinkType>("group");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery] = useDebounce(searchQuery.trim(), DEBOUNCE_MS);
  const [selectedGroup, setSelectedGroup] =
    useState<AuthorGroupListItem | null>(null);
  const [selectedTextItem, setSelectedTextItem] =
    useState<TextTitleItem | null>(null);
  const [selectedSegment, setSelectedSegment] = useState<SegmentItem | null>(
    null,
  );
  const [selectedSearchSegment, setSelectedSearchSegment] =
    useState<SegmentSearchResult | null>(null);

  useEffect(() => {
    if (!open) {
      setLinkType("group");
      setSearchQuery("");
      setSelectedGroup(null);
      setSelectedTextItem(null);
      setSelectedSegment(null);
      setSelectedSearchSegment(null);
    }
  }, [open]);

  useEffect(() => {
    setSelectedGroup(null);
    setSelectedTextItem(null);
    setSelectedSegment(null);
    setSelectedSearchSegment(null);
  }, [linkType, debouncedQuery]);

  const { data: groupData, isLoading: isLoadingGroups } = useQuery({
    queryKey: ["markdown-link-groups", debouncedQuery],
    queryFn: () =>
      fetchGroups({
        page: 1,
        limit: 20,
        search: debouncedQuery || undefined,
      }),
    enabled: open && linkType === "group",
  });

  const groups = groupData?.groups ?? [];

  const { data: titleData, isLoading: isLoadingTitles } = useQuery({
    queryKey: ["markdown-link-text-titles", debouncedQuery],
    queryFn: () =>
      searchTitles({
        title: debouncedQuery,
        limit: 20,
        offset: 0,
      }),
    enabled: open && linkType === "text" && debouncedQuery.length > 0,
  });

  const { data: segmentSearchData, isLoading: isLoadingSegmentSearch } =
    useQuery({
      queryKey: ["markdown-link-segment-search", debouncedQuery],
      queryFn: () => searchSegments({ content: debouncedQuery }),
      enabled: open && linkType === "segment" && debouncedQuery.length > 0,
    });

  const textTitles: TextTitleItem[] = titleData ?? [];
  const searchedSegments: SegmentSearchResult[] =
    segmentSearchData?.segments ?? [];

  const {
    data: detailsData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ["markdown-link-text-details", selectedTextItem?.id],
    initialPageParam: undefined as
      | { segmentId: string; direction: "next" | "previous" }
      | undefined,
    queryFn: ({ pageParam }) => {
      if (!selectedTextItem) {
        throw new Error("Text item is required");
      }
      return fetchTextDetails({
        textId: selectedTextItem.id,
        segmentId: pageParam?.segmentId,
        direction: pageParam?.direction as "next" | "previous" | undefined,
        size: 20,
      });
    },
    getNextPageParam: (lastPage: any) => {
      if (lastPage?.current_segment_position >= lastPage?.total_segments) {
        return undefined;
      }
      const lastSegmentId = getLastSegmentId(lastPage.content.sections);
      if (!lastSegmentId) return undefined;
      return { segmentId: lastSegmentId, direction: "next" };
    },
    enabled: open && linkType === "text" && !!selectedTextItem?.id,
    refetchOnWindowFocus: false,
  });

  const { ref: bottomSentinelRef, inView: isBottomVisible } = useInView({
    threshold: 0.1,
    rootMargin: "50px",
  });

  useEffect(() => {
    if (isBottomVisible && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [isBottomVisible, hasNextPage, isFetchingNextPage, fetchNextPage]);

  const segments = useMemo(() => {
    if (!detailsData?.pages) return [];
    const allSegments = detailsData.pages.flatMap((page) =>
      flattenSegments(page.content.sections),
    );
    return Array.from(
      new Map(allSegments.map((s: SegmentItem) => [s.segment_id, s])).values(),
    );
  }, [detailsData?.pages]);

  const canConfirm =
    linkType === "group"
      ? !!selectedGroup
      : linkType === "segment"
        ? !!selectedSearchSegment
        : !!selectedTextItem && !!selectedSegment;

  const handleConfirm = () => {
    if (linkType === "group" && selectedGroup) {
      const label =
        selectedText.trim() || pickGroupTitle(selectedGroup.metadata);
      onConfirm({
        label,
        url: buildGroupLink(selectedGroup.id),
      });
      onOpenChange(false);
      return;
    }

    if (linkType === "text" && selectedTextItem && selectedSegment) {
      const label = selectedText.trim() || selectedTextItem.title;
      const segmentId =
        selectedSegment.pecha_segment_id || selectedSegment.segment_id;
      onConfirm({
        label,
        url: buildSegmentLink(segmentId),
      });
      onOpenChange(false);
      return;
    }

    if (linkType === "segment" && selectedSearchSegment) {
      const segmentId =
        selectedSearchSegment.pecha_segment_id || selectedSearchSegment.id;
      onConfirm({
        label: selectedText.trim() || selectedSearchSegment.content,
        url: buildSegmentLink(segmentId),
      });
      onOpenChange(false);
    }
  };

  const renderGroupResults = () => {
    if (isLoadingGroups) {
      return (
        <p className="px-3 py-4 text-sm text-muted-foreground">
          {t("studio.editor.link.searching_groups")}
        </p>
      );
    }

    if (groups.length === 0) {
      return (
        <p className="px-3 py-4 text-sm text-muted-foreground">
          {t("studio.editor.link.no_groups")}
        </p>
      );
    }

    return (
      <ul>
        {groups.map((group) => {
          const title = pickGroupTitle(group.metadata);
          const isSelected = selectedGroup?.id === group.id;
          return (
            <li key={group.id}>
              <button
                type="button"
                className={`w-full px-3 py-2 text-left text-sm hover:bg-muted/60 ${
                  isSelected ? "bg-muted font-medium" : ""
                }`}
                onClick={() => setSelectedGroup(group)}
              >
                {title}
              </button>
            </li>
          );
        })}
      </ul>
    );
  };

  const renderTextResults = () => {
    if (!debouncedQuery) {
      return (
        <p className="px-3 py-4 text-sm text-muted-foreground">
          {t("studio.editor.link.text_hint")}
        </p>
      );
    }

    if (isLoadingTitles) {
      return (
        <p className="px-3 py-4 text-sm text-muted-foreground">
          {t("studio.editor.link.searching_texts")}
        </p>
      );
    }

    if (textTitles.length === 0) {
      return (
        <p className="px-3 py-4 text-sm text-muted-foreground">
          {t("studio.editor.link.no_texts")}
        </p>
      );
    }

    return (
      <ul>
        {textTitles.map((text) => {
          const isSelected = selectedTextItem?.id === text.id;
          return (
            <li key={text.id}>
              <button
                type="button"
                className={`w-full px-3 py-2 text-left text-sm hover:bg-muted/60 flex items-center justify-between gap-2 ${
                  isSelected ? "bg-muted font-medium" : ""
                }`}
                onClick={() => {
                  setSelectedTextItem(text);
                  setSelectedSegment(null);
                }}
              >
                <span>{text.title}</span>
                <img src={pechaIcon} alt="" className="size-6 shrink-0" />
              </button>
            </li>
          );
        })}
      </ul>
    );
  };

  const renderDirectSegmentResults = () => {
    if (!debouncedQuery) {
      return (
        <p className="px-3 py-4 text-sm text-muted-foreground">
          {t("studio.editor.link.segment_hint")}
        </p>
      );
    }

    if (isLoadingSegmentSearch) {
      return (
        <p className="px-3 py-4 text-sm text-muted-foreground">
          {t("studio.editor.link.searching_segments")}
        </p>
      );
    }

    if (searchedSegments.length === 0) {
      return (
        <p className="px-3 py-4 text-sm text-muted-foreground">
          {t("studio.editor.link.no_segments")}
        </p>
      );
    }

    return (
      <ul>
        {searchedSegments.map((segment) => {
          const isSelected = selectedSearchSegment?.id === segment.id;
          return (
            <li key={segment.id}>
              <button
                type="button"
                className={`w-full rounded-md border p-2 text-left text-sm hover:bg-muted/40 ${
                  isSelected
                    ? "border-[#801A1E] bg-muted/40"
                    : "border-dashed border-gray-300 dark:border-[#313132]"
                }`}
                onClick={() => setSelectedSearchSegment(segment)}
              >
                <div
                  className="line-clamp-3"
                  dangerouslySetInnerHTML={{ __html: segment.content }}
                />
              </button>
            </li>
          );
        })}
      </ul>
    );
  };

  const renderSegmentResults = () => {
    if (!selectedTextItem) return null;

    if (segments.length === 0) {
      return (
        <p className="px-3 py-2 text-sm text-muted-foreground">
          {t("studio.source.loading_segments")}
        </p>
      );
    }

    return (
      <div className="space-y-2 border-t border-input px-3 py-3">
        <p className="text-xs font-medium text-muted-foreground">
          {t("studio.editor.link.select_segment_from", {
            title: selectedTextItem.title,
          })}
        </p>
        <div className="max-h-48 space-y-2 overflow-y-auto">
          {segments.map((segment, index) => {
            const isSelected =
              selectedSegment?.segment_id === segment.segment_id;
            return (
              <button
                key={segment.segment_id || index}
                type="button"
                className={`w-full rounded-md border p-2 text-left text-sm hover:bg-muted/40 ${
                  isSelected
                    ? "border-[#801A1E] bg-muted/40"
                    : "border-dashed border-gray-300 dark:border-[#313132]"
                }`}
                onClick={() => setSelectedSegment(segment)}
              >
                <div
                  className="line-clamp-3"
                  dangerouslySetInnerHTML={{ __html: segment.content }}
                />
              </button>
            );
          })}
          <div ref={bottomSentinelRef} className="h-1" />
          {isFetchingNextPage && (
            <p className="text-xs text-muted-foreground">
              {t("studio.editor.link.loading_more")}
            </p>
          )}
        </div>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg gap-0 p-0 sm:max-w-lg">
        <DialogHeader className="px-6 pt-6 pb-4">
          <DialogTitle>{t("studio.editor.link.insert")}</DialogTitle>
          <DialogDescription>
            {selectedText.trim()
              ? t("studio.editor.link.link_selected_text", {
                  text: selectedText.trim(),
                })
              : t("studio.editor.link.choose_target")}
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 pb-4 space-y-4">
          <div className="flex rounded-md border border-input p-1">
            <button
              type="button"
              className={`flex-1 rounded px-3 py-1.5 text-sm font-medium transition-colors ${
                linkType === "group"
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => setLinkType("group")}
            >
              {t("studio.editor.link.type_group")}
            </button>
            <button
              type="button"
              className={`flex-1 rounded px-3 py-1.5 text-sm font-medium transition-colors ${
                linkType === "text"
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => setLinkType("text")}
            >
              {t("studio.editor.link.type_text")}
            </button>
            <button
              type="button"
              className={`flex-1 rounded px-3 py-1.5 text-sm font-medium transition-colors ${
                linkType === "segment"
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => setLinkType("segment")}
            >
              {t("studio.editor.link.type_segment")}
            </button>
          </div>

          <div className="flex items-center rounded-md border border-input px-2">
            <IoMdSearch className="size-4 shrink-0 text-muted-foreground" />
            <Pecha.Input
              placeholder={
                linkType === "group"
                  ? t("studio.editor.link.search_groups")
                  : linkType === "text"
                    ? t("studio.editor.link.search_text_titles")
                    : t("studio.editor.link.search_segment_content")
              }
              className="border-0 shadow-none focus-visible:ring-0"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="max-h-52 overflow-y-auto rounded-md border border-input">
            {linkType === "group"
              ? renderGroupResults()
              : linkType === "text"
                ? renderTextResults()
                : renderDirectSegmentResults()}
          </div>

          {linkType === "text" && renderSegmentResults()}
        </div>

        <DialogFooter className="px-6 pb-6">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            {t("studio.common.cancel")}
          </Button>
          <Button type="button" disabled={!canConfirm} onClick={handleConfirm}>
            {t("studio.editor.link.insert")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export { MarkdownLinkDialog };
