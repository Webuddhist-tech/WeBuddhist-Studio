import { useMemo, useState } from "react";
import { useTranslate } from "@tolgee/react";
import { Pecha } from "@/components/ui/shadimport";
import { cn } from "@/lib/utils";
import type { EditionLine } from "./editionHelpers";

/** Tap the line a return or a repeat belongs to, in this edition's own text. */
export const SegmentPickerDialog = ({
  open,
  title,
  lines,
  selectedId,
  onPick,
  onClose,
}: {
  open: boolean;
  title: string;
  lines: EditionLine[];
  selectedId?: string;
  onPick: (segmentId: string) => void;
  onClose: () => void;
}) => {
  const { t } = useTranslate();
  const [query, setQuery] = useState("");
  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return lines
      .map((line, index) => ({ ...line, number: index + 1 }))
      .filter(
        (line) =>
          !needle ||
          line.content.toLowerCase().includes(needle) ||
          String(line.number) === needle,
      );
  }, [lines, query]);

  return (
    <Pecha.Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <Pecha.DialogContent className="sm:max-w-2xl">
        <Pecha.DialogHeader>
          <Pecha.DialogTitle>{title}</Pecha.DialogTitle>
        </Pecha.DialogHeader>
        <Pecha.Input
          autoFocus
          value={query}
          placeholder={t("studio.live_settings.edition.find_line")}
          onChange={(e) => setQuery(e.target.value)}
        />
        <ol className="max-h-[60vh] space-y-1 overflow-auto pr-1">
          {shown.map((line) => (
            <li key={line.id}>
              <button
                type="button"
                onClick={() => {
                  onPick(line.id);
                  onClose();
                }}
                className={cn(
                  "flex w-full gap-3 rounded-md border px-3 py-2 text-left text-sm hover:border-[#A51C21]",
                  line.id === selectedId && "border-[#A51C21] bg-[#A51C21]/5",
                )}
              >
                <span className="w-8 shrink-0 text-right text-xs text-muted-foreground tabular-nums">
                  {line.number}
                </span>
                <span className="min-w-0 flex-1">{line.content}</span>
              </button>
            </li>
          ))}
        </ol>
      </Pecha.DialogContent>
    </Pecha.Dialog>
  );
};
