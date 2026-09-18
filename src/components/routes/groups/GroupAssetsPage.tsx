import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import {
  IoMdCloudUpload,
  IoMdMusicalNote,
  IoMdSearch,
  IoMdTrash,
} from "react-icons/io";
import { toast } from "sonner";
import { Pecha } from "@/components/ui/shadimport";
import { Pagination } from "@/components/ui/molecules/pagination/Pagination";
import { getApiErrorMessage } from "@/lib/apiErrors";
import type { GroupOutletContext } from "./GroupLayout";
import { canWriteEvents } from "./lib/eventPermissions";
import {
  AUDIO_ACCEPT,
  FORMAT_HINT,
  TOOLTIP_CLASS,
  deleteGroupAsset,
  formatDuration,
  formatFileSize,
  getAssetDeleteConflict,
  renameGroupAsset,
  type GroupAssetDTO,
  type GroupAssetUsageDTO,
} from "./api/groupAssetsApi";
import {
  GROUP_ASSETS_PAGE_SIZE,
  useDebouncedValue,
  useGroupAudioAssets,
} from "./hooks/useGroupAudioAssets";

function AssetsEmptyState({ search }: { readonly search: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 text-center">
      <IoMdMusicalNote
        className="h-7 w-7 text-muted-foreground/40"
        aria-hidden
      />
      <p className="text-sm font-medium">
        {search ? "No matches" : "No audio yet"}
      </p>
      <p className="max-w-xs text-xs text-muted-foreground">
        {search
          ? "Try a different title or file name."
          : "Upload recordings here, then link them to chants from a collection."}
      </p>
    </div>
  );
}

type PendingDelete = {
  asset: GroupAssetDTO;
  usages: GroupAssetUsageDTO[];
  /** Set once the server has answered 409 and force is the only way through. */
  conflictMessage?: string;
};

/**
 * The group's audio library. Files live here whether or not any chant links
 * them, so an author can upload in advance and manage recordings without
 * opening a collection.
 */
const GroupAssetsPage = () => {
  const { groupId, myRole, userInfo, readOnlyPlatform } =
    useOutletContext<GroupOutletContext>();

  const canWrite =
    !readOnlyPlatform && canWriteEvents(myRole, userInfo?.platform_role);

  const [searchInput, setSearchInput] = useState("");
  const [page, setPage] = useState(1);
  const [renaming, setRenaming] = useState<GroupAssetDTO | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(
    null,
  );

  const search = useDebouncedValue(searchInput, 300);

  useEffect(() => {
    setPage(1);
  }, [search]);

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
    invalidateAssets,
  } = useGroupAudioAssets({ groupId, search, page });

  const renameMutation = useMutation({
    mutationFn: ({ assetId, title }: { assetId: string; title: string }) =>
      renameGroupAsset(groupId, assetId, title),
    onSuccess: () => {
      toast.success("Audio renamed");
      setRenaming(null);
      invalidateAssets();
    },
    onError: (err) =>
      toast.error("Failed to rename audio", {
        description: getApiErrorMessage(err),
      }),
  });

  const deleteMutation = useMutation({
    mutationFn: ({ assetId, force }: { assetId: string; force: boolean }) =>
      deleteGroupAsset(groupId, assetId, force),
    onSuccess: () => {
      toast.success("Audio deleted");
      setPendingDelete(null);
      invalidateAssets();
    },
    onError: (err, variables) => {
      // A 409 names the collections that would change: show them, offer force.
      const conflict = getAssetDeleteConflict(err);
      if (conflict) {
        setPendingDelete((prev) =>
          prev?.asset.id === variables.assetId
            ? {
                ...prev,
                usages: conflict.usages,
                conflictMessage: conflict.message,
              }
            : prev,
        );
        return;
      }
      toast.error("Failed to delete audio", {
        description: getApiErrorMessage(err),
      });
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadAsset(file);
    resetFileInput();
  };

  const openRename = (asset: GroupAssetDTO) => {
    setRenaming(asset);
    setRenameValue(asset.title);
  };

  const totalPages = Math.max(1, Math.ceil(total / GROUP_ASSETS_PAGE_SIZE));
  const columnCount = canWrite ? 4 : 3;
  const isConflict = Boolean(pendingDelete?.conflictMessage);

  const body = (() => {
    if (isLoading) {
      return [0, 1, 2].map((row) => (
        <Pecha.TableRow key={row} className="hover:bg-transparent">
          <Pecha.TableCell colSpan={columnCount}>
            <Pecha.Skeleton className="h-8 w-full" />
          </Pecha.TableCell>
        </Pecha.TableRow>
      ));
    }
    if (isError) {
      return (
        <Pecha.TableRow>
          <Pecha.TableCell colSpan={columnCount} className="text-destructive">
            {getApiErrorMessage(error, "Could not load the audio library.")}
          </Pecha.TableCell>
        </Pecha.TableRow>
      );
    }
    if (assets.length === 0) {
      return (
        <Pecha.TableRow className="hover:bg-transparent">
          <Pecha.TableCell colSpan={columnCount} className="h-48">
            <AssetsEmptyState search={search} />
          </Pecha.TableCell>
        </Pecha.TableRow>
      );
    }
    return assets.map((asset) => (
      <Pecha.TableRow key={asset.id}>
        <Pecha.TableCell className="font-medium">
          <p className="truncate" title={asset.title}>
            {asset.title}
          </p>
        </Pecha.TableCell>
        <Pecha.TableCell className="whitespace-nowrap text-muted-foreground">
          {formatDuration(asset.duration_ms)} ·{" "}
          {formatFileSize(asset.file_size_bytes)}
        </Pecha.TableCell>
        {/* Wide: a native <audio> hides its seek bar below ~250px. */}
        <Pecha.TableCell className="w-[22rem]">
          {asset.asset_url ? (
            <audio
              controls
              preload="none"
              src={asset.asset_url}
              className="h-9 w-full min-w-[18rem]"
              aria-label={`Play ${asset.title}`}
            >
              <track kind="captions" />
            </audio>
          ) : (
            <span className="text-xs text-muted-foreground">
              Preview unavailable
            </span>
          )}
        </Pecha.TableCell>
        {canWrite ? (
          <Pecha.TableCell className="text-right">
            <div className="flex justify-end gap-2">
              <Pecha.Button
                variant="outline"
                size="sm"
                onClick={() => openRename(asset)}
              >
                Rename
              </Pecha.Button>
              <Pecha.Button
                variant="outline"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={() => setPendingDelete({ asset, usages: [] })}
                aria-label={`Delete ${asset.title}`}
              >
                <IoMdTrash className="h-4 w-4" />
              </Pecha.Button>
            </div>
          </Pecha.TableCell>
        ) : null}
      </Pecha.TableRow>
    ));
  })();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">
            {"Assets"}
            {total > 0 ? (
              <span className="ml-2 text-sm font-normal tabular-nums text-muted-foreground">
                {total}
              </span>
            ) : null}
          </h2>
          <p className="text-sm text-muted-foreground">
            Audio owned by this group, linked to chants from a collection.
          </p>
        </div>
        {canWrite ? (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept={AUDIO_ACCEPT}
              onChange={handleFileChange}
              className="hidden"
              id="group-asset-upload"
            />
            <Pecha.TooltipProvider delayDuration={200}>
              <Pecha.Tooltip>
                <Pecha.TooltipTrigger asChild>
                  <Pecha.Button
                    className="gap-1 bg-[#A51C21] text-white hover:bg-[#A51C21]/90"
                    disabled={isUploading}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <IoMdCloudUpload className="h-4 w-4" />
                    {isUploading ? "Uploading…" : "Upload"}
                  </Pecha.Button>
                </Pecha.TooltipTrigger>
                <Pecha.TooltipContent
                  side="left"
                  collisionPadding={12}
                  className={TOOLTIP_CLASS}
                >
                  {FORMAT_HINT}
                </Pecha.TooltipContent>
              </Pecha.Tooltip>
            </Pecha.TooltipProvider>
          </>
        ) : null}
      </div>

      <div className="relative max-w-sm">
        <IoMdSearch
          className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Pecha.Input
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search title or file name…"
          className="pl-8"
          aria-label="Search audio library"
        />
      </div>

      <div className="rounded-lg border">
        <Pecha.Table containerClassName="show-scrollbar">
          <Pecha.TableHeader>
            <Pecha.TableRow>
              <Pecha.TableHead>Title</Pecha.TableHead>
              <Pecha.TableHead>Details</Pecha.TableHead>
              <Pecha.TableHead>Preview</Pecha.TableHead>
              {canWrite ? (
                <Pecha.TableHead className="text-right">
                  Actions
                </Pecha.TableHead>
              ) : null}
            </Pecha.TableRow>
          </Pecha.TableHeader>
          <Pecha.TableBody>{body}</Pecha.TableBody>
        </Pecha.Table>

        {totalPages > 1 ? (
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            onPageChange={setPage}
          />
        ) : null}
      </div>

      <Pecha.Dialog
        open={Boolean(renaming)}
        onOpenChange={(open) => {
          if (!open) setRenaming(null);
        }}
      >
        <Pecha.DialogContent>
          <Pecha.DialogHeader>
            <Pecha.DialogTitle>Rename audio</Pecha.DialogTitle>
          </Pecha.DialogHeader>
          <div className="space-y-2">
            <label htmlFor="asset-rename" className="text-sm font-medium">
              Title
            </label>
            <Pecha.Input
              id="asset-rename"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              disabled={renameMutation.isPending}
            />
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Pecha.Button
              variant="outline"
              onClick={() => setRenaming(null)}
              disabled={renameMutation.isPending}
            >
              Cancel
            </Pecha.Button>
            <Pecha.Button
              className="bg-[#A51C21] text-white hover:bg-[#A51C21]/90"
              disabled={renameMutation.isPending || !renameValue.trim()}
              onClick={() => {
                if (!renaming || !renameValue.trim()) return;
                renameMutation.mutate({
                  assetId: renaming.id,
                  title: renameValue.trim(),
                });
              }}
            >
              {renameMutation.isPending ? "Saving…" : "Save"}
            </Pecha.Button>
          </div>
        </Pecha.DialogContent>
      </Pecha.Dialog>

      <Pecha.AlertDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
      >
        <Pecha.AlertDialogContent>
          <Pecha.AlertDialogHeader>
            <Pecha.AlertDialogTitle>
              {isConflict ? "This audio is in use" : "Delete audio?"}
            </Pecha.AlertDialogTitle>
            <Pecha.AlertDialogDescription>
              {isConflict
                ? `${pendingDelete?.conflictMessage} Deleting it anyway removes it from these chants.`
                : `This will permanently remove “${pendingDelete?.asset.title ?? ""}” from the group library.`}
            </Pecha.AlertDialogDescription>
          </Pecha.AlertDialogHeader>

          {isConflict && pendingDelete?.usages.length ? (
            <ul className="max-h-48 space-y-1 overflow-y-auto rounded-md border p-2 text-sm">
              {pendingDelete.usages.map((usage) => (
                <li key={usage.item_id} className="truncate">
                  <span className="font-medium">{usage.collection_name}</span>
                  <span className="text-muted-foreground">
                    {" — "}
                    {usage.text_title ?? "Untitled chant"}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}

          <Pecha.AlertDialogFooter>
            <Pecha.AlertDialogCancel disabled={deleteMutation.isPending}>
              Cancel
            </Pecha.AlertDialogCancel>
            <Pecha.AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              disabled={deleteMutation.isPending}
              onClick={(e) => {
                e.preventDefault();
                if (!pendingDelete) return;
                deleteMutation.mutate({
                  assetId: pendingDelete.asset.id,
                  force: isConflict,
                });
              }}
            >
              {deleteMutation.isPending ? "Deleting…" : null}
              {!deleteMutation.isPending && isConflict ? "Delete anyway" : null}
              {!deleteMutation.isPending && !isConflict ? "Delete" : null}
            </Pecha.AlertDialogAction>
          </Pecha.AlertDialogFooter>
        </Pecha.AlertDialogContent>
      </Pecha.AlertDialog>
    </div>
  );
};

export default GroupAssetsPage;
