import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useTranslate } from "@tolgee/react";
import { Pecha } from "@/components/ui/shadimport";
import { Button } from "@/components/ui/atoms/button";
import { Textarea } from "@/components/ui/atoms/textarea";
import type {
  CreatePrayerIntentionPayload,
  PatchPrayerIntentionPayload,
  PrayerIntention,
} from "./api/prayerIntentionsApi";

interface PrayerIntentionFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  intention: PrayerIntention | null;
  isSubmitting: boolean;
  onSubmit: (
    payload: CreatePrayerIntentionPayload | PatchPrayerIntentionPayload,
  ) => void;
}

const PrayerIntentionFormDialog = ({
  open,
  onOpenChange,
  intention,
  isSubmitting,
  onSubmit,
}: PrayerIntentionFormDialogProps) => {
  const { t } = useTranslate();
  const isEdit = !!intention;
  const [slug, setSlug] = useState("");
  const [label, setLabel] = useState("");
  const [color, setColor] = useState("#4A78C2");
  const [description, setDescription] = useState("");
  const [displayOrder, setDisplayOrder] = useState("0");

  useEffect(() => {
    if (!open) return;
    setSlug(intention?.slug ?? "");
    setLabel(intention?.label ?? "");
    setColor(intention?.color ?? "#4A78C2");
    setDescription(intention?.description ?? "");
    setDisplayOrder(intention != null ? String(intention.display_order) : "0");
  }, [open, intention]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedLabel = label.trim();
    const trimmedDescription = description.trim();
    const trimmedColor = color.trim();
    const trimmedOrder = displayOrder.trim();

    if (!trimmedLabel) {
      toast.error(t("studio.prayer_intentions.validation.label_required"));
      return;
    }
    if (!trimmedDescription) {
      toast.error(
        t("studio.prayer_intentions.validation.description_required"),
      );
      return;
    }
    if (!trimmedColor) {
      toast.error(t("studio.prayer_intentions.validation.color_required"));
      return;
    }
    if (!trimmedOrder) {
      toast.error(t("studio.prayer_intentions.validation.order_required"));
      return;
    }
    const parsedOrder = Number(trimmedOrder);
    if (!Number.isFinite(parsedOrder)) {
      toast.error(t("studio.prayer_intentions.validation.order_number"));
      return;
    }

    if (isEdit) {
      onSubmit({
        label: trimmedLabel,
        color: trimmedColor,
        description: trimmedDescription,
        display_order: parsedOrder,
      });
      return;
    }

    const trimmedSlug = slug.trim().toLowerCase();
    if (!trimmedSlug) {
      toast.error(t("studio.prayer_intentions.validation.slug_required"));
      return;
    }
    onSubmit({
      slug: trimmedSlug,
      label: trimmedLabel,
      color: trimmedColor,
      description: trimmedDescription,
      display_order: parsedOrder,
    });
  };

  return (
    <Pecha.Dialog open={open} onOpenChange={onOpenChange}>
      <Pecha.DialogContent className="max-w-lg">
        <Pecha.DialogHeader>
          <Pecha.DialogTitle>
            {isEdit
              ? t("studio.prayer_intentions.form.edit_title")
              : t("studio.prayer_intentions.form.create_title")}
          </Pecha.DialogTitle>
        </Pecha.DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {!isEdit ? (
            <div className="space-y-2">
              <label htmlFor="intention-slug" className="text-sm font-bold">
                {t("studio.prayer_intentions.table.slug")}
              </label>
              <Pecha.Input
                id="intention-slug"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder={t(
                  "studio.prayer_intentions.form.slug_placeholder",
                )}
                maxLength={32}
              />
              <p className="text-xs text-muted-foreground">
                {t("studio.prayer_intentions.form.slug_help")}
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              <span className="text-sm font-bold">
                {t("studio.prayer_intentions.table.slug")}
              </span>
              <code className="text-sm">{intention?.slug}</code>
            </div>
          )}
          <div className="space-y-2">
            <label htmlFor="intention-label" className="text-sm font-bold">
              {t("studio.prayer_intentions.table.label")}
            </label>
            <Pecha.Input
              id="intention-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="intention-color" className="text-sm font-bold">
              {t("studio.prayer_intentions.table.color")}
            </label>
            <div className="flex items-center gap-2">
              <Pecha.Input
                id="intention-color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="font-mono"
              />
              <span
                className="h-8 w-8 shrink-0 rounded border border-input"
                style={{ backgroundColor: color }}
                aria-hidden
              />
            </div>
          </div>
          <div className="space-y-2">
            <label htmlFor="intention-order" className="text-sm font-bold">
              {t("studio.prayer_intentions.form.display_order")}
            </label>
            <Pecha.Input
              id="intention-order"
              type="number"
              value={displayOrder}
              onChange={(e) => setDisplayOrder(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <label
              htmlFor="intention-description"
              className="text-sm font-bold"
            >
              {t("studio.common.description")}
            </label>
            <Textarea
              id="intention-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              {t("studio.common.cancel")}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting
                ? t("studio.common.saving")
                : isEdit
                  ? t("studio.prayer_intentions.form.save_changes")
                  : t("studio.common.create")}
            </Button>
          </div>
        </form>
      </Pecha.DialogContent>
    </Pecha.Dialog>
  );
};

export default PrayerIntentionFormDialog;
