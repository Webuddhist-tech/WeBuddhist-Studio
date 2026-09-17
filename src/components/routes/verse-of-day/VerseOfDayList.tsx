import { Pecha } from "@/components/ui/shadimport";
import { Button } from "@/components/ui/atoms/button";
import { type SortOrder, type VerseOfDayItem } from "./api/verseOfDayApi";
import { format } from "date-fns";
import { FaSortAmountDown, FaSortAmountUp } from "react-icons/fa";

interface VerseOfDayListProps {
  verses: VerseOfDayItem[];
  isLoading?: boolean;
  sortOrder: SortOrder;
  onToggleSort: () => void;
  onEdit: (item: VerseOfDayItem) => void;
  onDelete: (item: VerseOfDayItem) => void;
}

const VerseOfDayList = ({
  verses,
  isLoading,
  sortOrder,
  onToggleSort,
  onEdit,
  onDelete,
}: VerseOfDayListProps) => {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!verses.length) {
    return (
      <div className="flex items-center justify-center py-8">
        <p className="text-muted-foreground">No verses found</p>
      </div>
    );
  }

  return (
    <div className="rounded-md border bg-white dark:bg-[#1E1E1E]">
      <Pecha.Table>
        <Pecha.TableHeader>
          <Pecha.TableRow>
            <Pecha.TableHead className="w-[400px]">English</Pecha.TableHead>
            <Pecha.TableHead className="w-[100px]">Image</Pecha.TableHead>
            <Pecha.TableHead
              className="w-[120px]"
              aria-sort={sortOrder === "desc" ? "descending" : "ascending"}
            >
              <button
                type="button"
                onClick={onToggleSort}
                aria-label={`Sort by date, currently ${
                  sortOrder === "desc" ? "newest first" : "oldest first"
                }`}
                className="flex items-center gap-1 hover:text-foreground"
              >
                Date
                {sortOrder === "desc" ? (
                  <FaSortAmountDown className="h-3 w-3" />
                ) : (
                  <FaSortAmountUp className="h-3 w-3" />
                )}
              </button>
            </Pecha.TableHead>
            <Pecha.TableHead className="w-[150px]">Group</Pecha.TableHead>
            <Pecha.TableHead className="w-[180px] text-right">
              Actions
            </Pecha.TableHead>
          </Pecha.TableRow>
        </Pecha.TableHeader>
        <Pecha.TableBody>
          {verses.map((verse) => (
            <Pecha.TableRow key={verse.id}>
              <Pecha.TableCell className="max-w-[400px]">
                <p className="text-sm line-clamp-2">
                  {verse.verses.en || (
                    <span className="text-muted-foreground">—</span>
                  )}
                </p>
                {verse.source ? (
                  <p className="mt-1 text-xs text-muted-foreground line-clamp-1">
                    {verse.source}
                  </p>
                ) : null}
              </Pecha.TableCell>
              <Pecha.TableCell>
                {verse.image_url ? (
                  <img
                    src={verse.image_url}
                    alt="Verse"
                    className="h-12 w-12 rounded object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                      (
                        e.target as HTMLImageElement
                      ).nextElementSibling?.classList.remove("hidden");
                    }}
                  />
                ) : null}
                <div
                  className={`h-12 w-12 rounded bg-muted ${verse.image_url ? "hidden" : ""}`}
                />
              </Pecha.TableCell>
              <Pecha.TableCell className="whitespace-nowrap">
                {format(new Date(verse.date), "MMM dd, yyyy")}
              </Pecha.TableCell>
              <Pecha.TableCell>
                <p className="truncate text-sm">
                  {verse.group_info?.[0]?.title || "—"}
                </p>
              </Pecha.TableCell>
              <Pecha.TableCell className="text-right">
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => onEdit(verse)}
                  >
                    Edit
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => onDelete(verse)}
                    className="text-red-600 hover:text-red-700"
                  >
                    Delete
                  </Button>
                </div>
              </Pecha.TableCell>
            </Pecha.TableRow>
          ))}
        </Pecha.TableBody>
      </Pecha.Table>
    </div>
  );
};

export default VerseOfDayList;
