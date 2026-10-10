import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { IoMdAdd } from "react-icons/io";
import { toast } from "sonner";
import { useTranslate } from "@tolgee/react";
import { format } from "date-fns";
import { Navigate } from "react-router-dom";
import { Pecha } from "@/components/ui/shadimport";
import { Button } from "@/components/ui/atoms/button";
import { DialogDescription, DialogFooter } from "@/components/ui/atoms/dialog";
import { Pagination } from "@/components/ui/molecules/pagination/Pagination";
import { getApiErrorMessage } from "@/lib/apiErrors";
import { useUserInfo } from "@/hooks/useUserInfo";
import { canAccessAdminAuthors, isSuperAdmin } from "@/lib/platformAccess";
import { ROUTES } from "@/routes/paths";
import {
  createChinaRestrictedItem,
  deleteChinaRestrictedItem,
  fetchChinaRestrictedItems,
  RESTRICTED_ITEM_TYPES,
  searchChinaRestrictionCandidates,
  type ChinaRestrictionCandidateDTO,
  type RestrictedItemType,
} from "./api/chinaRestrictionsApi";

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 400;

type TFn = ReturnType<typeof useTranslate>["t"];

const formatItemType = (type: RestrictedItemType, t: TFn) =>
  t(`studio.china_restrictions.item_type.${type.toLowerCase()}`);

type RestrictionRow = {
  id: string;
  item_type: RestrictedItemType;
  item_id: string;
  title?: string | null;
  subtitle?: string | null;
  created_at: string;
};

const renderTableBody = ({
  isLoading,
  items,
  tableColumnCount,
  writeEnabled,
  isDeleting,
  onRemove,
  t,
}: {
  isLoading: boolean;
  items: RestrictionRow[];
  tableColumnCount: number;
  writeEnabled: boolean;
  isDeleting: boolean;
  onRemove: (id: string) => void;
  t: TFn;
}) => {
  if (isLoading) {
    return (
      <Pecha.TableRow>
        <Pecha.TableCell colSpan={tableColumnCount}>
          {t("studio.common.loading")}
        </Pecha.TableCell>
      </Pecha.TableRow>
    );
  }

  if (items.length === 0) {
    return (
      <Pecha.TableRow>
        <Pecha.TableCell colSpan={tableColumnCount}>
          {t("studio.china_restrictions.empty")}
        </Pecha.TableCell>
      </Pecha.TableRow>
    );
  }

  return items.map((item) => (
    <Pecha.TableRow key={item.id}>
      <Pecha.TableCell>{formatItemType(item.item_type, t)}</Pecha.TableCell>
      <Pecha.TableCell>
        <div className="min-w-[16rem]">
          <p className="font-medium">
            {item.title?.trim() || t("studio.china_restrictions.untitled_item")}
          </p>
          {item.subtitle?.trim() ? (
            <p className="text-xs text-muted-foreground mt-0.5">
              {item.subtitle}
            </p>
          ) : null}
        </div>
      </Pecha.TableCell>
      <Pecha.TableCell>
        {item.created_at
          ? format(new Date(item.created_at), "MMM dd, yyyy HH:mm")
          : "—"}
      </Pecha.TableCell>
      {writeEnabled ? (
        <Pecha.TableCell>
          <Button
            size="sm"
            variant="outline"
            disabled={isDeleting}
            onClick={() => onRemove(item.id)}
          >
            {t("studio.common.remove")}
          </Button>
        </Pecha.TableCell>
      ) : null}
    </Pecha.TableRow>
  ));
};

const renderCandidateOptions = ({
  isLoading,
  candidates,
  onSelect,
  t,
}: {
  isLoading: boolean;
  candidates: ChinaRestrictionCandidateDTO[];
  onSelect: (candidate: ChinaRestrictionCandidateDTO) => void;
  t: TFn;
}) => {
  if (isLoading) {
    return (
      <Pecha.CommandItem disabled value="__loading__">
        {t("studio.china_restrictions.searching")}
      </Pecha.CommandItem>
    );
  }

  if (candidates.length === 0) {
    return (
      <Pecha.CommandItem disabled value="__empty__">
        {t("studio.china_restrictions.no_matches")}
      </Pecha.CommandItem>
    );
  }

  return candidates.map((candidate) => (
    <Pecha.CommandItem
      key={candidate.id}
      value={candidate.id}
      onSelect={() => onSelect(candidate)}
    >
      <div className="min-w-0">
        <p className="truncate">{candidate.title}</p>
        {candidate.subtitle?.trim() ? (
          <p className="text-xs text-muted-foreground truncate">
            {candidate.subtitle}
          </p>
        ) : null}
      </div>
    </Pecha.CommandItem>
  ));
};

const ChinaRestrictionsPage = () => {
  const { t } = useTranslate();
  const { data: userInfo } = useUserInfo();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(0);
  const [typeFilter, setTypeFilter] = useState<RestrictedItemType | "ALL">(
    "ALL",
  );
  const [addOpen, setAddOpen] = useState(false);
  const [newItemType, setNewItemType] = useState<RestrictedItemType>("PLAN");
  const [selectedItem, setSelectedItem] =
    useState<ChinaRestrictionCandidateDTO | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  const canAccess = Boolean(
    userInfo && canAccessAdminAuthors(userInfo.platform_role),
  );
  const writeEnabled = isSuperAdmin(userInfo?.platform_role);

  useEffect(() => {
    const timer = setTimeout(
      () => setDebouncedSearch(searchQuery.trim()),
      SEARCH_DEBOUNCE_MS,
    );
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    setSelectedItem(null);
    setSearchQuery("");
    setDebouncedSearch("");
  }, [newItemType]);

  const { data, isLoading, error } = useQuery({
    queryKey: ["china-restrictions", page, typeFilter],
    queryFn: () =>
      fetchChinaRestrictedItems({
        skip: page * PAGE_SIZE,
        limit: PAGE_SIZE,
        ...(typeFilter !== "ALL" && { item_type: typeFilter }),
      }),
    enabled: canAccess,
  });

  const { data: candidatesData, isFetching: candidatesLoading } = useQuery({
    queryKey: ["china-restriction-candidates", newItemType, debouncedSearch],
    queryFn: () =>
      searchChinaRestrictionCandidates({
        item_type: newItemType,
        search: debouncedSearch || undefined,
        skip: 0,
        limit: 20,
      }),
    enabled: canAccess && addOpen && searchOpen,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["china-restrictions"] });
  };

  const createMutation = useMutation({
    mutationFn: createChinaRestrictedItem,
    onSuccess: () => {
      toast.success(t("studio.china_restrictions.toast.added"));
      setAddOpen(false);
      setSelectedItem(null);
      setSearchQuery("");
      invalidate();
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteChinaRestrictedItem,
    onSuccess: () => {
      toast.success(t("studio.china_restrictions.toast.removed"));
      setDeleteTargetId(null);
      invalidate();
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const tableColumnCount = writeEnabled ? 4 : 3;
  const candidates = candidatesData?.items ?? [];

  const handleAdd = () => {
    if (!selectedItem) {
      toast.error(t("studio.china_restrictions.validation.select_item"));
      return;
    }
    createMutation.mutate({
      item_type: newItemType,
      item_id: selectedItem.id,
    });
  };

  if (userInfo && !canAccess) {
    return <Navigate to={ROUTES.dashboard} replace />;
  }

  return (
    <div className="font-dynamic border h-[calc(100vh-40px)] overflow-auto bg-[#F5F5F5] dark:bg-[#181818] my-4 rounded-l-2xl max-md:my-0 max-md:h-full max-md:rounded-none max-md:border-0">
      <div className="px-4 pt-10 pb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">
            {t("studio.china_restrictions.title")}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t("studio.china_restrictions.subtitle")}
          </p>
        </div>
        {writeEnabled ? (
          <Button
            size="sm"
            onClick={() => {
              setSelectedItem(null);
              setSearchQuery("");
              setAddOpen(true);
            }}
          >
            <IoMdAdd className="mr-1 h-4 w-4" />
            {t("studio.china_restrictions.add_item")}
          </Button>
        ) : null}
      </div>

      <div className="px-4 pb-4">
        <select
          className="rounded border bg-background px-3 py-2 text-sm"
          value={typeFilter}
          onChange={(e) => {
            setTypeFilter(e.target.value as RestrictedItemType | "ALL");
            setPage(0);
          }}
        >
          <option value="ALL">
            {t("studio.china_restrictions.all_types")}
          </option>
          {RESTRICTED_ITEM_TYPES.map((type) => (
            <option key={type} value={type}>
              {formatItemType(type, t)}
            </option>
          ))}
        </select>
      </div>

      {error ? (
        <p className="px-4 text-destructive text-sm">
          {getApiErrorMessage(error)}
        </p>
      ) : null}

      <div className="px-4 pb-8 overflow-x-auto">
        <Pecha.Table>
          <Pecha.TableHeader>
            <Pecha.TableRow>
              <Pecha.TableHead>
                {t("studio.china_restrictions.table.type")}
              </Pecha.TableHead>
              <Pecha.TableHead>
                {t("studio.china_restrictions.table.item")}
              </Pecha.TableHead>
              <Pecha.TableHead>
                {t("studio.china_restrictions.table.added")}
              </Pecha.TableHead>
              {writeEnabled ? (
                <Pecha.TableHead>{t("studio.common.actions")}</Pecha.TableHead>
              ) : null}
            </Pecha.TableRow>
          </Pecha.TableHeader>
          <Pecha.TableBody>
            {renderTableBody({
              isLoading,
              items,
              tableColumnCount,
              writeEnabled,
              isDeleting: deleteMutation.isPending,
              onRemove: setDeleteTargetId,
              t,
            })}
          </Pecha.TableBody>
        </Pecha.Table>

        {totalPages > 1 ? (
          <div className="mt-4">
            <Pagination
              currentPage={page + 1}
              totalPages={totalPages}
              onPageChange={(p) => setPage(p - 1)}
            />
          </div>
        ) : null}
      </div>

      <Pecha.Dialog
        open={addOpen}
        onOpenChange={(open) => {
          setAddOpen(open);
          if (!open) {
            setSelectedItem(null);
            setSearchQuery("");
            setSearchOpen(false);
          }
        }}
      >
        <Pecha.DialogContent>
          <Pecha.DialogHeader>
            <Pecha.DialogTitle>
              {t("studio.china_restrictions.add_dialog.title")}
            </Pecha.DialogTitle>
            <DialogDescription>
              {t("studio.china_restrictions.add_dialog.description")}
            </DialogDescription>
          </Pecha.DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">
                {t("studio.china_restrictions.table.type")}
              </label>
              <select
                className="w-full rounded border bg-background px-3 py-2 text-sm"
                value={newItemType}
                onChange={(e) =>
                  setNewItemType(e.target.value as RestrictedItemType)
                }
              >
                {RESTRICTED_ITEM_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {formatItemType(type, t)}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">
                {t("studio.china_restrictions.table.item")}
              </label>
              <Pecha.Popover open={searchOpen} onOpenChange={setSearchOpen}>
                <Pecha.PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 w-full justify-between font-normal"
                  >
                    <span
                      className={
                        selectedItem
                          ? "text-foreground truncate"
                          : "text-muted-foreground"
                      }
                    >
                      {selectedItem
                        ? selectedItem.title
                        : t(
                            "studio.china_restrictions.add_dialog.search_type",
                            {
                              type: formatItemType(newItemType, t),
                            },
                          )}
                    </span>
                  </Button>
                </Pecha.PopoverTrigger>
                <Pecha.PopoverContent
                  className="w-[--radix-popover-trigger-width] p-0"
                  align="start"
                >
                  <Pecha.Command shouldFilter={false}>
                    <Pecha.CommandInput
                      placeholder={t(
                        "studio.china_restrictions.add_dialog.search_type",
                        { type: formatItemType(newItemType, t) },
                      )}
                      value={searchQuery}
                      onValueChange={setSearchQuery}
                    />
                    <Pecha.CommandList>
                      <Pecha.CommandGroup>
                        {renderCandidateOptions({
                          isLoading: candidatesLoading,
                          candidates,
                          onSelect: (candidate) => {
                            setSelectedItem(candidate);
                            setSearchOpen(false);
                          },
                          t,
                        })}
                      </Pecha.CommandGroup>
                    </Pecha.CommandList>
                  </Pecha.Command>
                </Pecha.PopoverContent>
              </Pecha.Popover>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>
              {t("studio.common.cancel")}
            </Button>
            <Button
              onClick={handleAdd}
              disabled={createMutation.isPending || !selectedItem}
            >
              {t("studio.common.add")}
            </Button>
          </DialogFooter>
        </Pecha.DialogContent>
      </Pecha.Dialog>

      <Pecha.AlertDialog
        open={deleteTargetId != null}
        onOpenChange={(open) => !open && setDeleteTargetId(null)}
      >
        <Pecha.AlertDialogContent>
          <Pecha.AlertDialogHeader>
            <Pecha.AlertDialogTitle>
              {t("studio.china_restrictions.remove_dialog.title")}
            </Pecha.AlertDialogTitle>
            <Pecha.AlertDialogDescription>
              {t("studio.china_restrictions.remove_dialog.description")}
            </Pecha.AlertDialogDescription>
          </Pecha.AlertDialogHeader>
          <Pecha.AlertDialogFooter>
            <Pecha.AlertDialogCancel>
              {t("studio.common.cancel")}
            </Pecha.AlertDialogCancel>
            <Pecha.AlertDialogAction
              onClick={() => {
                if (deleteTargetId) {
                  deleteMutation.mutate(deleteTargetId);
                }
              }}
            >
              {t("studio.common.remove")}
            </Pecha.AlertDialogAction>
          </Pecha.AlertDialogFooter>
        </Pecha.AlertDialogContent>
      </Pecha.AlertDialog>
    </div>
  );
};

export default ChinaRestrictionsPage;
