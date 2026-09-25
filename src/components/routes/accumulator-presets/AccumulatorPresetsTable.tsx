import { Pecha } from "@/components/ui/shadimport";
import { IoMdCreate, IoMdTrash } from "react-icons/io";
import {
  type AccumulatorPreset,
  presetDisplayName,
} from "./api/accumulatorPresetsApi";
import { capitalizeFirstLetter } from "@/lib/textUtils";
import { useTextTitle } from "./useTextTitle";

/** Shows the linked text's name; falls back to the raw edition id while the
 * title is loading or when it cannot be resolved. */
const LinkedTextCell = ({ textId }: { textId: string | null }) => {
  const title = useTextTitle(textId);
  return (
    <Pecha.TableCell className="max-w-[180px] truncate text-sm text-muted-foreground">
      {title || textId || "—"}
    </Pecha.TableCell>
  );
};

interface AccumulatorPresetsTableProps {
  presets: AccumulatorPreset[];
  isLoading?: boolean;
  showActionsColumn?: boolean;
  onEdit: (preset: AccumulatorPreset) => void;
  onDelete: (preset: AccumulatorPreset) => void;
}

const AccumulatorPresetsTable = ({
  presets,
  isLoading,
  showActionsColumn = true,
  onEdit,
  onDelete,
}: AccumulatorPresetsTableProps) => {
  if (isLoading) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center">
        Loading presets...
      </p>
    );
  }

  return (
    <div className="w-full overflow-x-auto">
      <Pecha.Table>
        <Pecha.TableHeader>
          <Pecha.TableRow>
            <Pecha.TableHead>Name</Pecha.TableHead>
            <Pecha.TableHead>Mantra</Pecha.TableHead>
            <Pecha.TableHead>Text</Pecha.TableHead>
            <Pecha.TableHead className="w-28">Target</Pecha.TableHead>
            {showActionsColumn ? (
              <Pecha.TableHead className="w-28 text-right">
                Actions
              </Pecha.TableHead>
            ) : null}
          </Pecha.TableRow>
        </Pecha.TableHeader>
        <Pecha.TableBody>
          {presets.map((preset) => (
            <Pecha.TableRow key={preset.id}>
              <Pecha.TableCell>
                <div className="flex flex-col gap-1">
                  <span className="font-medium">
                    {presetDisplayName(preset)}
                  </span>
                  {preset.metadata?.length > 0 ? (
                    <div className="flex gap-1 flex-wrap">
                      {preset.metadata.map((meta) => (
                        <span
                          key={`${preset.id}-${meta.language}`}
                          className="text-xs px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400"
                        >
                          {meta.language}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
              </Pecha.TableCell>
              <Pecha.TableCell className="max-w-[220px] truncate text-sm text-muted-foreground">
                {capitalizeFirstLetter(
                  preset.mantra?.title?.trim() ||
                    preset.mantra?.mantra?.trim() ||
                    "—",
                )}
              </Pecha.TableCell>
              <LinkedTextCell textId={preset.text_id} />
              <Pecha.TableCell>
                {preset.target_count != null
                  ? preset.target_count.toLocaleString()
                  : "—"}
              </Pecha.TableCell>
              {showActionsColumn ? (
                <Pecha.TableCell>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => onEdit(preset)}
                      className="p-2 rounded-md border hover:bg-muted/50 transition-colors"
                      aria-label={`Edit ${presetDisplayName(preset)}`}
                    >
                      <IoMdCreate className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(preset)}
                      className="p-2 rounded-md border text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                      aria-label={`Delete ${presetDisplayName(preset)}`}
                    >
                      <IoMdTrash className="w-4 h-4" />
                    </button>
                  </div>
                </Pecha.TableCell>
              ) : null}
            </Pecha.TableRow>
          ))}
        </Pecha.TableBody>
      </Pecha.Table>
    </div>
  );
};

export default AccumulatorPresetsTable;
