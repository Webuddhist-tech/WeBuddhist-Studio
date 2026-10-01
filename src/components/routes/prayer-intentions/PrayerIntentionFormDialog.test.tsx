import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import PrayerIntentionFormDialog from "./PrayerIntentionFormDialog";
import type { PrayerIntention } from "./api/prayerIntentionsApi";

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

const existing: PrayerIntention = {
  id: "intention-1",
  slug: "healing",
  label: "Healing",
  color: "#4A78C2",
  description: "Recovery",
  display_order: 1,
  linked_event_count: 2,
};

const renderDialog = (
  intention: PrayerIntention | null,
  onSubmit = vi.fn(),
) => {
  render(
    <PrayerIntentionFormDialog
      open
      onOpenChange={vi.fn()}
      intention={intention}
      isSubmitting={false}
      onSubmit={onSubmit}
    />,
  );
  return onSubmit;
};

describe("PrayerIntentionFormDialog", () => {
  beforeEach(() => {
    vi.mocked(toast.error).mockReset();
  });

  it("creates an intention with a lowercased slug", async () => {
    const onSubmit = renderDialog(null);

    await userEvent.type(screen.getByLabelText("Slug"), "Healing");
    await userEvent.type(screen.getByLabelText("Label"), "Healing");
    await userEvent.clear(screen.getByLabelText("Color"));
    await userEvent.type(screen.getByLabelText("Color"), "#4A78C2");
    await userEvent.type(screen.getByLabelText("Description"), "Recovery");
    await userEvent.click(screen.getByRole("button", { name: "Create" }));

    expect(onSubmit).toHaveBeenCalledWith({
      slug: "healing",
      label: "Healing",
      color: "#4A78C2",
      description: "Recovery",
      display_order: 0,
    });
  });

  it("patches label and copy without sending the slug", async () => {
    const onSubmit = renderDialog(existing);

    await userEvent.clear(screen.getByLabelText("Label"));
    await userEvent.type(screen.getByLabelText("Label"), "Recovery");
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));

    expect(onSubmit).toHaveBeenCalledWith({
      label: "Recovery",
      color: "#4A78C2",
      description: "Recovery",
      display_order: 1,
    });
    expect(onSubmit.mock.calls[0][0]).not.toHaveProperty("slug");
  });

  it("does not submit when the label is blank", async () => {
    const onSubmit = renderDialog(null);

    await userEvent.type(screen.getByLabelText("Slug"), "healing");
    await userEvent.type(screen.getByLabelText("Description"), "Recovery");
    await userEvent.click(screen.getByRole("button", { name: "Create" }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith("Label is required");
  });

  it("does not submit when display order is cleared", async () => {
    const onSubmit = renderDialog(null);

    await userEvent.type(screen.getByLabelText("Slug"), "healing");
    await userEvent.type(screen.getByLabelText("Label"), "Healing");
    await userEvent.type(screen.getByLabelText("Description"), "Recovery");
    await userEvent.clear(screen.getByLabelText("Display order"));
    await userEvent.click(screen.getByRole("button", { name: "Create" }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith("Display order is required");
  });
});
