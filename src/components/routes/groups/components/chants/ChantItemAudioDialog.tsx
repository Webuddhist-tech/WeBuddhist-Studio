import { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
import { IoMdClose, IoMdCloudUpload, IoMdSearch } from "react-icons/io";
import { PiDotsSixVertical } from "react-icons/pi";
import { toast } from "sonner";
import { Pecha } from "@/components/ui/shadimport";
import { Pagination } from "@/components/ui/molecules/pagination/Pagination";
import { getApiErrorMessage } from "@/lib/apiErrors";
import { reorderArray } from "@/lib/utils";
import {
  setChantItemAudio,
  type ChantCollectionDetailDTO,
  type ChantCollectionItemDTO,
} from "../../api/chantsApi";
import {
  AUDIO_ACCEPT,
  FORMAT_HINT,
  MAX_AUDIO_PER_ITEM,
  TOOLTIP_CLASS,
  formatDuration,
  formatFileSize,
  type GroupAssetDTO,
} from "../../api/groupAssetsApi";
import {
  GROUP_ASSETS_PAGE_SIZE,
  useDebouncedValue,
  useGroupAudioAssets,
} from "../../hooks/useGroupAudioAssets";

/** A selected recording, draggable into order. */
function SortableSelectedRow({
  asset,
  index,
  onRemove,
}: {
  readonly asset: GroupAssetDTO;
  readonly index: number;
  readonly onRemove: (assetId: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: asset.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 rounded-md border bg-background px-2 py-1.5"
      {...attributes}
    >
      <button
        type="button"
        className="shrink-0 cursor-grab rounded p-0.5 text-muted-foreground hover:text-foreground touch-none"
        aria-label={`Reorder ${asset.title}`}
        {...listeners}
      >
        <PiDotsSixVertical className="h-4 w-4" />
      </button>
      <span className="w-4 shrink-0 text-xs tabular-nums text-muted-foreground">
        {index + 1}
      </span>
      <span className="min-w-0 flex-1 truncate text-sm">{asset.title}</span>
      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
        {formatDuration(asset.duration_ms)}
      </span>
      <button
        type="button"
        className="shrink-0 rounded p-1 text-muted-foreground hover:text-destructive"
        onClick={() => onRemove(asset.id)}
        aria-label={`Remove ${asset.title} from selection`}
      >
        <IoMdClose className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

type ChantItemAudioDialogProps = {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly groupId: string;
  readonly collectionId: string;
  readonly item: ChantCollectionItemDTO;
};

/**
 * Audio picker for one chant row. Lists the group's library, which exists
 * independently of this row: uploading adds to it immediately, and only Save
 * links the selection, in a single PUT.
 */
const ChantItemAudioDialog = ({
  open,
  onOpenChange,
  groupId,
  collectionId,
  item,
}: ChantItemAudioDialogProps) => {
  const queryClient = useQueryClient();

  const [searchInput, setSearchInput] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<GroupAssetDTO[]>([]);

  const search = useDebouncedValue(searchInput, 300);

  useEffect(() => {
    if (open) {
      setSelected(item.audio ?? []);
      setSearchInput("");
      setPage(1);
    }
  }, [open, item.audio]);

  useEffect(() => {
    setPage(1);
  }, [search]);

  const handleUploaded = useCallback((asset: GroupAssetDTO) => {
    setSelected((prev) => {
      if (prev.some((a) => a.id === asset.id)) return prev;
      if (prev.length >= MAX_AUDIO_PER_ITEM) {
        toast.warning("Added to library, but not selected", {
          description: `A chant can have at most ${MAX_AUDIO_PER_ITEM} recordings.`,
        });
        return prev;
      }
      return [...prev, asset];
    });
    setSearchInput("");
    setPage(1);
  }, []);

  const {
    assets,
    total,
    isLoading,
    isError,
    error,
    isUploading,
    uploadAsset,
    fileInputRef,
    resetFileInput,
  } = useGroupAudioAssets({
    groupId,
    search,
    page,
    enabled: open,
    onUploaded: handleUploaded,
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  const selectedIds = useMemo(
    () => new Set(selected.map((asset) => asset.id)),
    [selected],
  );

  const saveMutation = useMutation({
    mutationFn: (assetIds: string[]) =>
      setChantItemAudio(groupId, collectionId, item.id, assetIds),
    onSuccess: (updated: ChantCollectionDetailDTO) => {
      // The PUT returns the whole collection, so seed the cache instead of refetching.
      queryClient.setQueryData(
        ["cms-chant-collection", groupId, collectionId],
        updated,
      );
      toast.success("Audio updated");
      onOpenChange(false);
    },
    onError: (err) =>
      toast.error("Couldn't save audio", {
        description: getApiErrorMessage(err),
      }),
  });

  const toggleAsset = (asset: GroupAssetDTO) => {
    setSelected((prev) => {
      if (prev.some((a) => a.id === asset.id)) {
        return prev.filter((a) => a.id !== asset.id);
      }
      if (prev.length >= MAX_AUDIO_PER_ITEM) {
        toast.error(`At most ${MAX_AUDIO_PER_ITEM} recordings per chant.`);
        return prev;
      }
      return [...prev, asset];
    });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const next = reorderArray(selected, String(active.id), String(over.id));
    if (next) setSelected(next);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadAsset(file);
    resetFileInput();
  };

  const totalPages = Math.max(1, Math.ceil(total / GROUP_ASSETS_PAGE_SIZE));
  const isEmptyLibrary = !isLoading && !isError && assets.length === 0;

  const libraryBody = (() => {
    if (isLoading) {
      return (
        <div className="space-y-2 p-3">
          {[0, 1, 2].map((row) => (
            <Pecha.Skeleton key={row} className="h-10 w-full" />
          ))}
        </div>
      );
    }
    if (isError) {
      return (
        <p className="px-3 py-8 text-center text-sm text-destructive">
          {getApiErrorMessage(error, "Couldn't load the library.")}
        </p>
      );
    }
    if (assets.length === 0) {
      return (
        <div className="px-3 py-8 text-center">
          <p className="text-sm text-muted-foreground">
            {search ? "No matches." : "No audio in this group yet."}
          </p>
          {!search ? (
            <p className="mt-0.5 text-xs text-muted-foreground">
              Upload one to get started.
            </p>
          ) : null}
        </div>
      );
    }
    return (
      <ul className="divide-y">
        {assets.map((asset) => {
          const checkboxId = `asset-${asset.id}`;
          const isSelected = selectedIds.has(asset.id);
          return (
            <li key={asset.id}>
              {/* Full width: a native <audio> drops its seek bar below ~250px. */}
              <div
                className={`space-y-1.5 px-3 py-2 ${
                  isSelected ? "bg-muted/50" : ""
                }`}
              >
                <div className="flex items-center gap-3">
                  <Pecha.Checkbox
                    id={checkboxId}
                    checked={isSelected}
                    onCheckedChange={() => toggleAsset(asset)}
                  />
                  <label
                    htmlFor={checkboxId}
                    className="min-w-0 flex-1 cursor-pointer"
                  >
                    <span className="block truncate text-sm font-medium">
                      {asset.title}
                    </span>
                  </label>
                  <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                    {formatDuration(asset.duration_ms)} ·{" "}
                    {formatFileSize(asset.file_size_bytes)}
                  </span>
                </div>
                {asset.asset_url ? (
                  <audio
                    controls
                    preload="none"
                    src={asset.asset_url}
                    className="h-8 w-full"
                  >
                    <track kind="captions" />
                  </audio>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    );
  })();

  return (
    <Pecha.Dialog open={open} onOpenChange={onOpenChange}>
      {/* `!` because the dialog atom hard-codes sm:max-w-lg at equal specificity. */}
      <Pecha.DialogContent className="max-h-[85vh] grid-rows-[auto_1fr_auto] gap-0 overflow-hidden p-0 sm:!max-w-2xl">
        <Pecha.DialogHeader className="border-b px-5 py-3">
          <Pecha.DialogTitle className="truncate pr-6 text-base">
            {"Audio"}
            <span className="ml-2 font-normal text-muted-foreground">
              {item.title}
            </span>
          </Pecha.DialogTitle>
        </Pecha.DialogHeader>

        <div className="min-h-0 space-y-5 overflow-y-auto px-5 py-4">
          <section className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <IoMdSearch
                  className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
                <Pecha.Input
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Search group library…"
                  className="h-9 pl-8"
                  aria-label="Search group audio library"
                />
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept={AUDIO_ACCEPT}
                onChange={handleFileChange}
                className="hidden"
                id="chant-audio-upload"
              />
              <Pecha.TooltipProvider delayDuration={200}>
                <Pecha.Tooltip>
                  <Pecha.TooltipTrigger asChild>
                    <Pecha.Button
                      type="button"
                      variant={isEmptyLibrary ? "default" : "outline"}
                      size="sm"
                      className={`h-9 shrink-0 ${
                        isEmptyLibrary
                          ? "bg-[#A51C21] text-white hover:bg-[#A51C21]/90"
                          : ""
                      }`}
                      disabled={isUploading}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <IoMdCloudUpload className="mr-1.5 h-4 w-4" />
                      {isUploading ? "Uploading…" : "Upload"}
                    </Pecha.Button>
                  </Pecha.TooltipTrigger>
                  <Pecha.TooltipContent
                    side="bottom"
                    align="end"
                    collisionPadding={12}
                    className={TOOLTIP_CLASS}
                  >
                    {FORMAT_HINT}
                  </Pecha.TooltipContent>
                </Pecha.Tooltip>
              </Pecha.TooltipProvider>
            </div>

            <div className="rounded-md border">
              <div className="show-scrollbar max-h-72 overflow-y-auto">
                {libraryBody}
              </div>
              {totalPages > 1 ? (
                <div className="border-t">
                  <Pagination
                    currentPage={page}
                    totalPages={totalPages}
                    onPageChange={setPage}
                  />
                </div>
              ) : null}
            </div>
          </section>

          <section className="space-y-2">
            <div className="flex items-baseline justify-between">
              <h3 className="text-sm font-medium">
                {"Selected"}
                <span className="ml-1.5 text-xs tabular-nums text-muted-foreground">
                  {selected.length}/{MAX_AUDIO_PER_ITEM}
                </span>
              </h3>
              {selected.length > 1 ? (
                <span className="text-xs text-muted-foreground">
                  Drag to reorder
                </span>
              ) : null}
            </div>

            {selected.length === 0 ? (
              <p className="rounded-md border border-dashed px-3 py-5 text-center text-sm text-muted-foreground">
                Pick from the library above
              </p>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
                modifiers={[restrictToVerticalAxis]}
              >
                <SortableContext
                  items={selected.map((asset) => asset.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-1.5">
                    {selected.map((asset, index) => (
                      <SortableSelectedRow
                        key={asset.id}
                        asset={asset}
                        index={index}
                        onRemove={(assetId) =>
                          setSelected((prev) =>
                            prev.filter((a) => a.id !== assetId),
                          )
                        }
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}
          </section>
        </div>

        <div className="flex items-center justify-between gap-3 border-t px-5 py-3">
          <p className="text-xs text-muted-foreground">
            Removing here unlinks only — files stay in the library.
          </p>
          <div className="flex shrink-0 gap-2">
            <Pecha.Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={saveMutation.isPending}
            >
              Cancel
            </Pecha.Button>
            <Pecha.Button
              type="button"
              size="sm"
              className="bg-[#A51C21] text-white hover:bg-[#A51C21]/90"
              disabled={saveMutation.isPending}
              onClick={() =>
                saveMutation.mutate(selected.map((asset) => asset.id))
              }
            >
              {saveMutation.isPending ? "Saving…" : "Save"}
            </Pecha.Button>
          </div>
        </div>
      </Pecha.DialogContent>
    </Pecha.Dialog>
  );
};

export default ChantItemAudioDialog;
