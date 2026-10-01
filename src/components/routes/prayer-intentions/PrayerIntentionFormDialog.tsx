import { useEffect, useState } from "react";
import { toast } from "sonner";
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
    const parsedOrder = Number(displayOrder.trim());

    if (!trimmedLabel) {
      toast.error("Label is required");
      return;
    }
    if (!trimmedDescription) {
      toast.error("Description is required");
      return;
    }
    if (!trimmedColor) {
      toast.error("Color is required");
      return;
    }
    if (!Number.isFinite(parsedOrder)) {
      toast.error("Display order must be a number");
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
      toast.error("Slug is required");
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
            {isEdit ? "Edit prayer intention" : "New prayer intention"}
          </Pecha.DialogTitle>
        </Pecha.DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {!isEdit ? (
            <div className="space-y-2">
              <label htmlFor="intention-slug" className="text-sm font-bold">
                Slug
              </label>
              <Pecha.Input
                id="intention-slug"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="healing"
                maxLength={32}
              />
              <p className="text-xs text-muted-foreground">
                Lowercase identifier stored on prayer messages; cannot be
                changed later.
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              <span className="text-sm font-bold">Slug</span>
              <code className="text-sm">{intention?.slug}</code>
            </div>
          )}
          <div className="space-y-2">
            <label htmlFor="intention-label" className="text-sm font-bold">
              Label
            </label>
            <Pecha.Input
              id="intention-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="intention-color" className="text-sm font-bold">
              Color
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
              Display order
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
              Description
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
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving…" : isEdit ? "Save changes" : "Create"}
            </Button>
          </div>
        </form>
      </Pecha.DialogContent>
    </Pecha.Dialog>
  );
};

export default PrayerIntentionFormDialog;
