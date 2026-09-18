import {
  Link,
  useNavigate,
  useOutletContext,
  useParams,
} from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { CSS } from "@dnd-kit/utilities";
import { IoMdArrowBack, IoMdTrash, IoMdAdd, IoMdClose } from "react-icons/io";
import { PiDotsSixVertical } from "react-icons/pi";
import { toast } from "sonner";
import { Pecha } from "@/components/ui/shadimport";
import { Button } from "@/components/ui/atoms/button";
import { getApiErrorMessage } from "@/lib/apiErrors";
import { ROUTES } from "@/routes/paths";
import { useLanguages } from "@/hooks/useLanguages";
import type { GroupOutletContext } from "./GroupLayout";
import { canWriteEvents } from "./lib/eventPermissions";
import {
  addChantItems,
  deleteChantItem,
  fetchChantCollection,
  searchRecitations,
  type ChantCollectionItemDTO,
} from "./api/chantsApi";
import FkMultiSearchSelector from "./components/FkMultiSearchSelector";
import type { FkOption } from "./components/FkMultiSearchSelector";
import ChantItemAudioCell from "./components/chants/ChantItemAudioCell";
import ChantItemAudioDialog from "./components/chants/ChantItemAudioDialog";
import { useChantItemReorder } from "./hooks/useChantItemReorder";

function SortableChantItemRow({
  item,
  index,
  canWrite,
  canReorder,
  onRemove,
  onManageAudio,
}: {
  readonly item: ChantCollectionItemDTO;
  readonly index: number;
  readonly canWrite: boolean;
  readonly canReorder: boolean;
  readonly onRemove: (item: ChantCollectionItemDTO) => void;
  readonly onManageAudio: (item: ChantCollectionItemDTO) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id, disabled: !canReorder });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <Pecha.TableRow ref={setNodeRef} style={style} {...attributes}>
      {canWrite ? (
        <Pecha.TableCell className="w-10">
          <button
            type="button"
            className="shrink-0 rounded p-1 text-muted-foreground hover:text-foreground touch-none disabled:cursor-not-allowed disabled:opacity-30"
            aria-label={`Reorder ${item.title}`}
            disabled={!canReorder}
            {...listeners}
          >
            <PiDotsSixVertical className="h-4 w-4" />
          </button>
        </Pecha.TableCell>
      ) : null}
      <Pecha.TableCell className="text-muted-foreground">
        {index + 1}
      </Pecha.TableCell>
      <Pecha.TableCell className="max-w-xs font-medium">
        <p className="truncate" title={item.title}>
          {item.title}
        </p>
      </Pecha.TableCell>
      <Pecha.TableCell>{item.language ?? "—"}</Pecha.TableCell>
      <Pecha.TableCell>{item.type ?? "—"}</Pecha.TableCell>
      <Pecha.TableCell className="w-56 max-w-56">
        <ChantItemAudioCell
          audio={item.audio ?? []}
          itemTitle={item.title}
          canWrite={canWrite}
          onManage={() => onManageAudio(item)}
        />
      </Pecha.TableCell>
      {canWrite ? (
        <Pecha.TableCell className="text-right">
          <Pecha.Button
            variant="outline"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={() => onRemove(item)}
            aria-label={`Remove ${item.title}`}
          >
            <IoMdTrash className="h-4 w-4" />
          </Pecha.Button>
        </Pecha.TableCell>
      ) : null}
    </Pecha.TableRow>
  );
}

const GroupChantDetailPage = () => {
  const { groupId, collectionId } = useParams<{
    groupId: string;
    collectionId: string;
  }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { myRole, userInfo, readOnlyPlatform } =
    useOutletContext<GroupOutletContext>();

  const canWrite =
    !readOnlyPlatform && canWriteEvents(myRole, userInfo?.platform_role);

  const [pendingDeleteItem, setPendingDeleteItem] =
    useState<ChantCollectionItemDTO | null>(null);
  const [audioItemId, setAudioItemId] = useState<string | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedRecitations, setSelectedRecitations] = useState<FkOption[]>(
    [],
  );
  const [recitationLanguage, setRecitationLanguage] = useState("EN");
  const { languageOptions } = useLanguages({ recitationOnly: true });

  // Default selection may not exist in the recitation-only set (e.g. no
  // English chants); fall back to the first language that actually has some.
  useEffect(() => {
    if (
      languageOptions.length > 0 &&
      !languageOptions.some((lang) => lang.value === recitationLanguage)
    ) {
      setRecitationLanguage(languageOptions[0].value);
    }
  }, [languageOptions, recitationLanguage]);

  const recitationSearchFn = useCallback(
    (params: { search?: string; skip?: number; limit?: number }) =>
      searchRecitations({ ...params, language: recitationLanguage }),
    [recitationLanguage],
  );

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["cms-chant-collection", groupId, collectionId],
    queryFn: () => fetchChantCollection(groupId!, collectionId!),
    enabled: Boolean(groupId) && Boolean(collectionId),
    refetchOnWindowFocus: false,
  });

  const { displayItems, canReorder, handleReorder } = useChantItemReorder(
    groupId,
    collectionId,
    data?.items,
    canWrite,
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  const deleteItemMutation = useMutation({
    mutationFn: (itemId: string) =>
      deleteChantItem(groupId!, collectionId!, itemId),
    onSuccess: () => {
      toast.success("Item removed");
      setPendingDeleteItem(null);
      queryClient.invalidateQueries({
        queryKey: ["cms-chant-collection", groupId, collectionId],
      });
      queryClient.invalidateQueries({
        queryKey: ["cms-chant-collections", groupId],
      });
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  const addItemsMutation = useMutation({
    mutationFn: (textIds: string[]) =>
      addChantItems(groupId!, collectionId!, textIds),
    onSuccess: () => {
      toast.success("Items added successfully");
      setSelectedRecitations([]);
      setIsEditMode(false);
      queryClient.invalidateQueries({
        queryKey: ["cms-chant-collection", groupId, collectionId],
      });
      queryClient.invalidateQueries({
        queryKey: ["cms-chant-collections", groupId],
      });
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  const handleAddItems = () => {
    if (selectedRecitations.length === 0) {
      toast.error("Please select at least one recitation");
      return;
    }

    const existingTextIds = new Set(
      data?.items.map((item) => item.text_id) ?? [],
    );
    const duplicates = selectedRecitations.filter((r) =>
      existingTextIds.has(r.id),
    );

    if (duplicates.length > 0) {
      const duplicateMessage =
        duplicates.length === 1
          ? `"${duplicates[0].title}" is already in this collection`
          : `${duplicates.length} chants are already in this collection`;
      toast.error(duplicateMessage);
      return;
    }

    addItemsMutation.mutate(selectedRecitations.map((r) => r.id));
  };

  const handleCancelEdit = () => {
    setIsEditMode(false);
    setSelectedRecitations([]);
  };

  // Resolved from the live list rather than held in state, so the dialog
  // re-renders from the cache the PUT seeded instead of a stale snapshot.
  const audioItem =
    displayItems.find((item) => item.id === audioItemId) ?? null;

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      handleReorder(String(active.id), String(over.id));
    }
  };

  const addButtonLabel = (() => {
    if (addItemsMutation.isPending) return "Adding...";
    const count = selectedRecitations.length;
    return `Add ${count} ${count === 1 ? "Chant" : "Chants"}`;
  })();

  const chantsListPath = groupId ? ROUTES.groupChants(groupId) : ROUTES.groups;

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-muted-foreground">
        Loading collection…
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4">
        <p className="text-center text-destructive">
          {getApiErrorMessage(error, "Could not load this collection.")}
        </p>
        <Pecha.Button
          variant="outline"
          onClick={() => navigate(chantsListPath)}
        >
          Back to chants
        </Pecha.Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild>
            <Link to={chantsListPath}>
              <IoMdArrowBack className="h-4 w-4" />
            </Link>
          </Button>
          <h1 className="text-xl font-bold">{data.name}</h1>
        </div>
        {canWrite && !isEditMode && (
          <Button
            variant="default"
            size="sm"
            onClick={() => setIsEditMode(true)}
            className="bg-[#A51C21] text-white hover:bg-[#A51C21]/90"
          >
            <IoMdAdd className="w-4 h-4" /> Add Chants
          </Button>
        )}
        {canWrite && isEditMode && (
          <Button variant="outline" size="sm" onClick={handleCancelEdit}>
            <IoMdClose className="w-4 h-4" /> Cancel
          </Button>
        )}
      </div>

      {data.img_url ? (
        <img
          src={data.img_url}
          alt=""
          className="w-full max-h-48 object-cover rounded-lg border"
        />
      ) : null}

      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Items ({displayItems.length})</h2>

        {isEditMode && (
          <div className="rounded-lg border border-blue-900 bg-blue-900/5 p-4 space-y-4">
            <h3 className="text-sm font-bold">Add Recitations</h3>
            <div className="w-48 space-y-2">
              <label
                htmlFor="recitation-language"
                className="text-sm font-medium"
              >
                Language
              </label>
              <Pecha.Select
                value={recitationLanguage}
                onValueChange={setRecitationLanguage}
              >
                <Pecha.SelectTrigger
                  id="recitation-language"
                  className="w-full bg-white dark:bg-[#181818]"
                >
                  <Pecha.SelectValue placeholder="Language" />
                </Pecha.SelectTrigger>
                <Pecha.SelectContent>
                  {languageOptions.map((lang) => (
                    <Pecha.SelectItem key={lang.value} value={lang.value}>
                      {lang.label}
                    </Pecha.SelectItem>
                  ))}
                </Pecha.SelectContent>
              </Pecha.Select>
            </div>
            <FkMultiSearchSelector
              value={selectedRecitations}
              onChange={setSelectedRecitations}
              searchFn={recitationSearchFn}
              queryKeyPrefix={`recitation-search-${recitationLanguage}`}
              searchPlaceholder="Search recitations..."
              emptyMessage="No recitations selected — use search to add."
              hideLabel
            />
            <div className="flex justify-end gap-2">
              <Pecha.Button
                type="button"
                onClick={handleAddItems}
                disabled={
                  addItemsMutation.isPending || selectedRecitations.length === 0
                }
                className="bg-[#A51C21] text-white hover:bg-[#A51C21]/90"
              >
                {addButtonLabel}
              </Pecha.Button>
            </div>
          </div>
        )}

        {displayItems.length === 0 ? (
          <p className="text-muted-foreground">No items in this collection.</p>
        ) : (
          <div className="rounded-lg border">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
              modifiers={[restrictToVerticalAxis]}
            >
              <Pecha.Table containerClassName="show-scrollbar">
                <Pecha.TableHeader>
                  <Pecha.TableRow>
                    {canWrite ? <Pecha.TableHead className="w-10" /> : null}
                    <Pecha.TableHead className="w-12">#</Pecha.TableHead>
                    <Pecha.TableHead>Title</Pecha.TableHead>
                    <Pecha.TableHead>Language</Pecha.TableHead>
                    <Pecha.TableHead>Type</Pecha.TableHead>
                    <Pecha.TableHead className="w-56">Audio</Pecha.TableHead>
                    {canWrite ? (
                      <Pecha.TableHead className="text-right">
                        Actions
                      </Pecha.TableHead>
                    ) : null}
                  </Pecha.TableRow>
                </Pecha.TableHeader>
                <SortableContext
                  items={displayItems.map((item) => item.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <Pecha.TableBody>
                    {displayItems.map((item, index) => (
                      <SortableChantItemRow
                        key={item.id}
                        item={item}
                        index={index}
                        canWrite={canWrite}
                        canReorder={canReorder}
                        onRemove={setPendingDeleteItem}
                        onManageAudio={(target) => setAudioItemId(target.id)}
                      />
                    ))}
                  </Pecha.TableBody>
                </SortableContext>
              </Pecha.Table>
            </DndContext>
          </div>
        )}
      </div>

      {canWrite && audioItem && groupId && collectionId ? (
        <ChantItemAudioDialog
          open
          onOpenChange={(open) => {
            if (!open) setAudioItemId(null);
          }}
          groupId={groupId}
          collectionId={collectionId}
          item={audioItem}
        />
      ) : null}

      <Pecha.AlertDialog
        open={Boolean(pendingDeleteItem)}
        onOpenChange={(open) => {
          if (!open) setPendingDeleteItem(null);
        }}
      >
        <Pecha.AlertDialogContent>
          <Pecha.AlertDialogHeader>
            <Pecha.AlertDialogTitle>Remove item?</Pecha.AlertDialogTitle>
            <Pecha.AlertDialogDescription>
              This will remove &ldquo;{pendingDeleteItem?.title ?? ""}&rdquo;
              from this collection.
            </Pecha.AlertDialogDescription>
          </Pecha.AlertDialogHeader>
          <Pecha.AlertDialogFooter>
            <Pecha.AlertDialogCancel disabled={deleteItemMutation.isPending}>
              Cancel
            </Pecha.AlertDialogCancel>
            <Pecha.AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              disabled={deleteItemMutation.isPending}
              onClick={(e) => {
                e.preventDefault();
                if (pendingDeleteItem)
                  deleteItemMutation.mutate(pendingDeleteItem.id);
              }}
            >
              {deleteItemMutation.isPending ? "Removing…" : "Remove"}
            </Pecha.AlertDialogAction>
          </Pecha.AlertDialogFooter>
        </Pecha.AlertDialogContent>
      </Pecha.AlertDialog>
    </div>
  );
};

export default GroupChantDetailPage;
