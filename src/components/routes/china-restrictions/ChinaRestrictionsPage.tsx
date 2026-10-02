import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { IoMdAdd } from "react-icons/io";
import { toast } from "sonner";
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

const formatItemType = (type: RestrictedItemType) =>
  type.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());

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
}: {
  isLoading: boolean;
  items: RestrictionRow[];
  tableColumnCount: number;
  writeEnabled: boolean;
  isDeleting: boolean;
  onRemove: (id: string) => void;
}) => {
  if (isLoading) {
    return (
      <Pecha.TableRow>
        <Pecha.TableCell colSpan={tableColumnCount}>Loading…</Pecha.TableCell>
      </Pecha.TableRow>
    );
  }

  if (items.length === 0) {
    return (
      <Pecha.TableRow>
        <Pecha.TableCell colSpan={tableColumnCount}>
          No restricted items found.
        </Pecha.TableCell>
      </Pecha.TableRow>
    );
  }

  return items.map((item) => (
    <Pecha.TableRow key={item.id}>
      <Pecha.TableCell>{formatItemType(item.item_type)}</Pecha.TableCell>
      <Pecha.TableCell>
        <div className="min-w-[16rem]">
          <p className="font-medium">{item.title?.trim() || "Untitled item"}</p>
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
            Remove
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
}: {
  isLoading: boolean;
  candidates: ChinaRestrictionCandidateDTO[];
  onSelect: (candidate: ChinaRestrictionCandidateDTO) => void;
}) => {
  if (isLoading) {
    return (
      <Pecha.CommandItem disabled value="__loading__">
        Searching…
      </Pecha.CommandItem>
    );
  }

  if (candidates.length === 0) {
    return (
      <Pecha.CommandItem disabled value="__empty__">
        No matches found.
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
      toast.success("Item added to China restrictions");
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
      toast.success("Restriction removed");
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
      toast.error("Search and select an item to restrict");
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
          <h1 className="text-xl font-semibold">China restrictions</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Items listed here are hidden from users in Chinese timezones.
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
            Add item
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
          <option value="ALL">All types</option>
          {RESTRICTED_ITEM_TYPES.map((type) => (
            <option key={type} value={type}>
              {formatItemType(type)}
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
              <Pecha.TableHead>Type</Pecha.TableHead>
              <Pecha.TableHead>Item</Pecha.TableHead>
              <Pecha.TableHead>Added</Pecha.TableHead>
              {writeEnabled ? <Pecha.TableHead>Actions</Pecha.TableHead> : null}
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
            <Pecha.DialogTitle>Add China restriction</Pecha.DialogTitle>
            <DialogDescription>
              Choose a content type, search by name, and select the item to hide
              for users in Chinese timezones.
            </DialogDescription>
          </Pecha.DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Type</label>
              <select
                className="w-full rounded border bg-background px-3 py-2 text-sm"
                value={newItemType}
                onChange={(e) =>
                  setNewItemType(e.target.value as RestrictedItemType)
                }
              >
                {RESTRICTED_ITEM_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {formatItemType(type)}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Item</label>
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
                        : `Search ${formatItemType(newItemType).toLowerCase()}s…`}
                    </span>
                  </Button>
                </Pecha.PopoverTrigger>
                <Pecha.PopoverContent
                  className="w-[--radix-popover-trigger-width] p-0"
                  align="start"
                >
                  <Pecha.Command shouldFilter={false}>
                    <Pecha.CommandInput
                      placeholder={`Search ${formatItemType(newItemType).toLowerCase()}s…`}
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
              Cancel
            </Button>
            <Button
              onClick={handleAdd}
              disabled={createMutation.isPending || !selectedItem}
            >
              Add
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
            <Pecha.AlertDialogTitle>Remove restriction?</Pecha.AlertDialogTitle>
            <Pecha.AlertDialogDescription>
              This item will become visible again for users in Chinese
              timezones.
            </Pecha.AlertDialogDescription>
          </Pecha.AlertDialogHeader>
          <Pecha.AlertDialogFooter>
            <Pecha.AlertDialogCancel>Cancel</Pecha.AlertDialogCancel>
            <Pecha.AlertDialogAction
              onClick={() => {
                if (deleteTargetId) {
                  deleteMutation.mutate(deleteTargetId);
                }
              }}
            >
              Remove
            </Pecha.AlertDialogAction>
          </Pecha.AlertDialogFooter>
        </Pecha.AlertDialogContent>
      </Pecha.AlertDialog>
    </div>
  );
};

export default ChinaRestrictionsPage;
