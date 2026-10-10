import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useDebounce } from "use-debounce";
import { IoMdAdd, IoMdSearch } from "react-icons/io";
import { LuExternalLink, LuRefreshCw } from "react-icons/lu";
import { toast } from "sonner";
import { useTranslate } from "@tolgee/react";
import { Pecha } from "@/components/ui/shadimport";
import { Pagination } from "@/components/ui/molecules/pagination/Pagination";
import { createChantCollection } from "@/components/routes/groups/api/chantsApi";
import { getApiErrorMessage } from "@/lib/apiErrors";
import {
  LINKED_CONTENT_CREATE_PATHS,
  LINKED_CONTENT_I18N,
  fetchLinkedContent,
  supportsQuickCreate,
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
 *
 * Content that does not exist yet can be made from here: a chant collection
 * inline, the rest in their own form in a new tab, so the plan being edited
 * keeps its unsaved state. The list reloads when the window regains focus,
 * so whatever was created there is waiting on return.
 */
export const LinkedContentSelectorSheet = ({
  type,
  groupId,
  isOpen,
  onOpenChange,
  onSelect,
}: LinkedContentSelectorSheetProps) => {
  const { t } = useTranslate();
  const [search, setSearch] = useState("");
  const [debouncedSearch] = useDebounce(search, 400);
  const [page, setPage] = useState(1);
  const [quickCreateOpen, setQuickCreateOpen] = useState(false);
  const [quickCreateName, setQuickCreateName] = useState("");
  const queryClient = useQueryClient();

  // Start clean each time the sheet opens or switches type.
  useEffect(() => {
    setSearch("");
    setPage(1);
    setQuickCreateOpen(false);
    setQuickCreateName("");
  }, [type, isOpen]);

  const serverSearch = type ? supportsServerSearch(type) : false;

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
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
    // Coming back from a create form opened in another tab.
    refetchOnWindowFocus: true,
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
  const keys = type ? LINKED_CONTENT_I18N[type] : null;
  const tk = (key?: string) => (key ? t(key) : "");

  const handleSelect = (option: LinkedContentOption) => {
    if (!type) return;
    onSelect(type, option);
    onOpenChange(false);
  };

  const quickCreateMutation = useMutation({
    mutationFn: (name: string) => createChantCollection(groupId!, { name }),
    onSuccess: (collection) => {
      queryClient.invalidateQueries({ queryKey: ["linkedContent"] });
      queryClient.invalidateQueries({
        queryKey: ["cms-chant-collections", groupId],
      });
      toast.success(t("studio.content.linked.chant_collection.created"));
      handleSelect({
        id: collection.id,
        title: collection.name,
        subtitle: null,
        imageUrl: collection.img_url ?? null,
      });
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  const openCreateForm = () => {
    if (!type || !groupId) return;
    window.open(
      LINKED_CONTENT_CREATE_PATHS[type](groupId),
      "_blank",
      "noopener,noreferrer",
    );
  };

  const renderCreate = () => {
    if (!type || !groupId) return null;
    if (quickCreateOpen) {
      const name = quickCreateName.trim();
      return (
        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (name) quickCreateMutation.mutate(name);
          }}
        >
          <Pecha.Input
            autoFocus
            value={quickCreateName}
            onChange={(event) => setQuickCreateName(event.target.value)}
            placeholder={t(
              "studio.content.linked.chant_collection.quick_create_placeholder",
            )}
            maxLength={255}
            disabled={quickCreateMutation.isPending}
          />
          <Pecha.Button
            type="submit"
            disabled={!name || quickCreateMutation.isPending}
            className="bg-[#A51C21] text-white hover:bg-[#A51C21]/90"
          >
            {quickCreateMutation.isPending
              ? t("studio.common.creating")
              : t("studio.content.linked.create_and_link")}
          </Pecha.Button>
          <Pecha.Button
            type="button"
            variant="ghost"
            onClick={() => setQuickCreateOpen(false)}
            disabled={quickCreateMutation.isPending}
          >
            {t("studio.common.cancel")}
          </Pecha.Button>
        </form>
      );
    }
    return (
      <div className="flex flex-wrap items-center gap-2">
        {supportsQuickCreate(type) ? (
          <Pecha.Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setQuickCreateOpen(true)}
          >
            <IoMdAdd className="h-4 w-4" />
            {t("studio.content.linked.create_new")}
          </Pecha.Button>
        ) : null}
        <Pecha.Button
          type="button"
          variant="outline"
          size="sm"
          onClick={openCreateForm}
          title={t("studio.content.linked.open_form_hint")}
        >
          <LuExternalLink className="h-4 w-4" />
          {supportsQuickCreate(type)
            ? t("studio.content.linked.open_full_form")
            : t("studio.content.linked.create_new")}
        </Pecha.Button>
        <Pecha.Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
          aria-label={t("studio.content.linked.refresh")}
          title={t("studio.content.linked.refresh")}
        >
          <LuRefreshCw
            className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`}
          />
        </Pecha.Button>
      </div>
    );
  };

  const renderBody = () => {
    if (!groupId) {
      return (
        <p className="text-sm text-muted-foreground py-8 text-center">
          {t("studio.content.linked.no_group")}
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
          {(error as Error)?.message || tk(keys?.loadFailed)}
        </p>
      );
    }
    if (items.length === 0) {
      return (
        <div className="text-center py-12 space-y-1">
          <p className="text-sm">{tk(keys?.noneFound)}</p>
          <span className="text-sm text-muted-foreground">
            {search
              ? t("studio.content.linked.try_different_search")
              : tk(keys?.groupEmpty)}
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
          <Pecha.SheetTitle>{tk(keys?.sheetTitle)}</Pecha.SheetTitle>
          <Pecha.SheetDescription>
            {t("studio.content.linked.sheet_description")}
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
              placeholder={tk(keys?.searchPlaceholder)}
              className="pl-9"
            />
          </div>
          {!serverSearch && search.trim() && (
            <p className="text-xs text-muted-foreground mt-1">
              {t("studio.content.linked.filtering_page_only")}
            </p>
          )}
          <div className="mt-3">{renderCreate()}</div>
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
