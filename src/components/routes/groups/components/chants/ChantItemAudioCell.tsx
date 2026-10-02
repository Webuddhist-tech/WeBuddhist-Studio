import { IoMdAdd, IoMdMusicalNote } from "react-icons/io";
import { Pecha } from "@/components/ui/shadimport";
import { formatDuration, type GroupAssetDTO } from "../../api/groupAssetsApi";

type ChantItemAudioCellProps = {
  readonly audio: GroupAssetDTO[];
  readonly itemTitle: string;
  readonly canWrite: boolean;
  readonly onManage: () => void;
};

/**
 * Row summary for a chant's linked audio. Playback is a click-triggered
 * popover, not a hover tooltip: a VIEWER gets no edit controls and still
 * needs to reach it on touch.
 */
const ChantItemAudioCell = ({
  audio,
  itemTitle,
  canWrite,
  onManage,
}: ChantItemAudioCellProps) => {
  const [first] = audio;
  const count = audio.length;

  if (count === 0) {
    return canWrite ? (
      <Pecha.Button
        variant="outline"
        size="sm"
        className="h-8 gap-1 text-xs"
        onClick={onManage}
        aria-label={`Add audio to ${itemTitle}`}
      >
        <IoMdAdd className="h-3.5 w-3.5" />
        Add audio
      </Pecha.Button>
    ) : (
      <span className="text-muted-foreground">—</span>
    );
  }

  return (
    <div className="flex min-w-0 items-center justify-between gap-2">
      <Pecha.Popover>
        <Pecha.PopoverTrigger asChild>
          <button
            type="button"
            className="flex min-w-0 flex-1 items-center gap-1.5 rounded px-1 py-0.5 text-left text-sm hover:bg-muted"
            aria-label={`Play audio for ${itemTitle}`}
          >
            <IoMdMusicalNote
              className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
              aria-hidden
            />
            <span className="truncate">{first.title}</span>
            {count > 1 ? (
              <span className="shrink-0 rounded-full bg-muted px-1.5 text-xs tabular-nums text-muted-foreground">
                +{count - 1}
              </span>
            ) : null}
          </button>
        </Pecha.PopoverTrigger>

        <Pecha.PopoverContent align="start" className="w-[22rem] p-0">
          <div className="border-b px-3 py-2">
            <p className="truncate text-sm font-medium" title={itemTitle}>
              {itemTitle}
            </p>
            <p className="text-xs text-muted-foreground">
              {count} recording{count === 1 ? "" : "s"}
            </p>
          </div>
          <ol className="max-h-72 space-y-2 overflow-y-auto p-3">
            {audio.map((asset, index) => (
              <li key={asset.id} className="space-y-1">
                <div className="flex items-baseline gap-1.5">
                  <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                    {index + 1}.
                  </span>
                  <span className="min-w-0 flex-1 truncate text-xs font-medium">
                    {asset.title}
                  </span>
                  <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                    {formatDuration(asset.duration_ms)}
                  </span>
                </div>
                {asset.asset_url ? (
                  <audio
                    controls
                    preload="none"
                    src={asset.asset_url}
                    className="h-9 w-full"
                    aria-label={`Play ${asset.title}`}
                  >
                    <track kind="captions" />
                  </audio>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Preview unavailable
                  </p>
                )}
              </li>
            ))}
          </ol>
        </Pecha.PopoverContent>
      </Pecha.Popover>

      {canWrite ? (
        <Pecha.Button
          variant="outline"
          size="sm"
          className="h-8 shrink-0 px-2 text-xs"
          onClick={onManage}
          aria-label={`Edit audio for ${itemTitle}`}
        >
          Edit
        </Pecha.Button>
      ) : null}
    </div>
  );
};

export default ChantItemAudioCell;
