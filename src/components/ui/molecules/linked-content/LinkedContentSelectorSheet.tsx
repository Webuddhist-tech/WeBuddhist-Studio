import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useDebounce } from "use-debounce";
import { IoMdSearch } from "react-icons/io";
import { Pecha } from "@/components/ui/shadimport";
import { Pagination } from "@/components/ui/molecules/pagination/Pagination";
import {
  LINKED_CONTENT_LABELS,
  fetchLinkedContent,
  supportsServerSearch,
  type LinkedContentOption,
  type LinkedContentType,
} from "./linkedContent";

const PAGE_SIZE = 10;

interface LinkedContentSelectorSheetProps {
  type: LinkedContentType | null;
  groupId?: string | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (type: LinkedContentType, option: LinkedContentOption) => void;
}

/**
 * Picks a group accumulation, chant collection, event or post to link from a
 * plan subtask. Only content from the plan's own group is listed, which is
 * also what the backend enforces on save.
 */
export const LinkedContentSelectorSheet = ({
  type,
  groupId,
  isOpen,
  onOpenChange,
  onSelect,
}: LinkedContentSelectorSheetProps) => {
  const [search, setSearch] = useState("");
  const [debouncedSearch] = useDebounce(search, 400);
  const [page, setPage] = useState(1);

  // Start clean each time the sheet opens or switches type.
  useEffect(() => {
    setSearch("");
    setPage(1);
  }, [type, isOpen]);

  const serverSearch = type ? supportsServerSearch(type) : false;

  const { data, isLoading, isError, error } = useQuery({
    queryKey: [
      "linkedContent",
      type,
      groupId,
      page,
      serverSearch ? debouncedSearch : "",
    ],
    queryFn: () =>
      fetchLinkedContent(type!, {
        groupId: groupId!,
        skip: (page - 1) * PAGE_SIZE,
        limit: PAGE_SIZE,
        ...(serverSearch && debouncedSearch ? { search: debouncedSearch } : {}),
      }),
    enabled: isOpen && !!type && !!groupId,
    refetchOnWindowFocus: false,
  });

  const items = useMemo(() => {
    const rows = data?.items ?? [];
    if (serverSearch || !search.trim()) return rows;
    const needle = search.trim().toLowerCase();
    return rows.filter((item) =>
      `${item.title} ${item.subtitle ?? ""}`.toLowerCase().includes(needle),
    );
  }, [data?.items, search, serverSearch]);

  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / PAGE_SIZE));
  const label = type ? LINKED_CONTENT_LABELS[type] : "";

  const handleSelect = (option: LinkedContentOption) => {
    if (!type) return;
    onSelect(type, option);
    onOpenChange(false);
  };

  const renderBody = () => {
    if (!groupId) {
      return (
        <p className="text-sm text-muted-foreground py-8 text-center">
          This plan has no group, so there is nothing to link.
        </p>
      );
    }
    if (isLoading) {
      return (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <Pecha.Skeleton key={index} className="h-16 w-full rounded-md" />
          ))}
        </div>
      );
    }
    if (isError) {
      return (
        <p className="text-sm text-red-500 py-8 text-center">
          {(error as Error)?.message ||
            `Failed to load ${label.toLowerCase()}s`}
        </p>
      );
    }
    if (items.length === 0) {
      return (
        <div className="text-center py-12 space-y-1">
          <p className="text-sm">No {label.toLowerCase()} found</p>
          <span className="text-sm text-muted-foreground">
            {search
              ? "Try a different search term"
              : `This group has no ${label.toLowerCase()} yet`}
          </span>
        </div>
      );
    }
    return (
      <div className="space-y-2">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => handleSelect(item)}
            className="w-full flex items-center gap-3 border border-gray-300 dark:border-[#313132] rounded-md p-3 text-left cursor-pointer hover:bg-gray-50 dark:hover:bg-input/50"
          >
            {item.imageUrl ? (
              <img
                src={item.imageUrl}
                alt=""
                className="w-12 h-12 rounded-md object-cover shrink-0 border"
              />
            ) : (
              <div className="w-12 h-12 rounded-md shrink-0 border border-dashed bg-[#FAFAFA] dark:bg-sidebar-secondary" />
            )}
            <div className="min-w-0 flex-1">
              <p className="font-medium truncate">{item.title}</p>
              {item.subtitle && (
                <p className="text-sm text-muted-foreground truncate">
                  {item.subtitle}
                </p>
              )}
            </div>
          </button>
        ))}
      </div>
    );
  };

  return (
    <Pecha.Sheet open={isOpen} onOpenChange={onOpenChange}>
      <Pecha.SheetContent
        side="right"
        className="w-full sm:max-w-xl flex flex-col gap-0"
      >
        <Pecha.SheetHeader>
          <Pecha.SheetTitle>Link {label.toLowerCase()}</Pecha.SheetTitle>
          <Pecha.SheetDescription>
            Choose from this plan&apos;s group.
          </Pecha.SheetDescription>
        </Pecha.SheetHeader>

        <div className="px-4 pb-3">
          <div className="relative">
            <IoMdSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Pecha.Input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                if (serverSearch) setPage(1);
              }}
              placeholder={`Search ${label.toLowerCase()}`}
              className="pl-9"
            />
          </div>
          {!serverSearch && search.trim() && (
            <p className="text-xs text-muted-foreground mt-1">
              Filtering this page only — use the pages below to see more.
            </p>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-4">{renderBody()}</div>

        {totalPages > 1 && (
          <div className="border-t px-4 py-3">
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              onPageChange={setPage}
            />
          </div>
        )}
      </Pecha.SheetContent>
    </Pecha.Sheet>
  );
};
