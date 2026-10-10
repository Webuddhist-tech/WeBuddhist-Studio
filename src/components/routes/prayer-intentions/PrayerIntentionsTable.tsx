import { useTranslate } from "@tolgee/react";
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
  const { t } = useTranslate();
  if (isLoading) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center">
        {t("studio.prayer_intentions.loading")}
      </p>
    );
  }

  if (intentions.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center">
        {t("studio.prayer_intentions.empty")}
      </p>
    );
  }

  return (
    <div className="w-full overflow-x-auto">
      <Pecha.Table>
        <Pecha.TableHeader>
          <Pecha.TableRow>
            <Pecha.TableHead>
              {t("studio.prayer_intentions.table.order")}
            </Pecha.TableHead>
            <Pecha.TableHead>
              {t("studio.prayer_intentions.table.slug")}
            </Pecha.TableHead>
            <Pecha.TableHead>
              {t("studio.prayer_intentions.table.label")}
            </Pecha.TableHead>
            <Pecha.TableHead>
              {t("studio.prayer_intentions.table.color")}
            </Pecha.TableHead>
            <Pecha.TableHead>
              {t("studio.prayer_intentions.table.events")}
            </Pecha.TableHead>
            {showActionsColumn ? (
              <Pecha.TableHead className="w-24 text-right">
                {t("studio.common.actions")}
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
                      aria-label={t(
                        "studio.prayer_intentions.table.edit_aria",
                        {
                          label: intention.label,
                        },
                      )}
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
