import { Pecha } from "@/components/ui/shadimport";
import { IoMdCreate } from "react-icons/io";
import type { PrayerIntention } from "./api/prayerIntentionsApi";

interface PrayerIntentionsTableProps {
  intentions: PrayerIntention[];
  isLoading?: boolean;
  showActionsColumn?: boolean;
  onEdit: (intention: PrayerIntention) => void;
}

const PrayerIntentionsTable = ({
  intentions,
  isLoading,
  showActionsColumn = true,
  onEdit,
}: PrayerIntentionsTableProps) => {
  if (isLoading) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center">
        Loading prayer intentions…
      </p>
    );
  }

  if (intentions.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center">
        No prayer intentions yet.
      </p>
    );
  }

  return (
    <div className="w-full overflow-x-auto">
      <Pecha.Table>
        <Pecha.TableHeader>
          <Pecha.TableRow>
            <Pecha.TableHead>Order</Pecha.TableHead>
            <Pecha.TableHead>Slug</Pecha.TableHead>
            <Pecha.TableHead>Label</Pecha.TableHead>
            <Pecha.TableHead>Color</Pecha.TableHead>
            <Pecha.TableHead>Events</Pecha.TableHead>
            {showActionsColumn ? (
              <Pecha.TableHead className="w-24 text-right">
                Actions
              </Pecha.TableHead>
            ) : null}
          </Pecha.TableRow>
        </Pecha.TableHeader>
        <Pecha.TableBody>
          {intentions.map((intention) => (
            <Pecha.TableRow key={intention.id}>
              <Pecha.TableCell>{intention.display_order}</Pecha.TableCell>
              <Pecha.TableCell>
                <code className="text-sm">{intention.slug}</code>
              </Pecha.TableCell>
              <Pecha.TableCell>
                <span className="font-medium">{intention.label}</span>
              </Pecha.TableCell>
              <Pecha.TableCell>
                <div className="flex items-center gap-2">
                  <span
                    className="h-5 w-5 rounded border border-input"
                    style={{ backgroundColor: intention.color }}
                    aria-hidden
                  />
                  <code className="text-xs">{intention.color}</code>
                </div>
              </Pecha.TableCell>
              <Pecha.TableCell>{intention.linked_event_count}</Pecha.TableCell>
              {showActionsColumn ? (
                <Pecha.TableCell>
                  <div className="flex justify-end">
                    <Pecha.Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => onEdit(intention)}
                      aria-label={`Edit ${intention.label}`}
                    >
                      <IoMdCreate className="h-4 w-4" />
                    </Pecha.Button>
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

export default PrayerIntentionsTable;
