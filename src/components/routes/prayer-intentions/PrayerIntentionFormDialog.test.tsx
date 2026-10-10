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

    await userEvent.type(
      screen.getByLabelText("studio.prayer_intentions.table.slug"),
      "Healing",
    );
    await userEvent.type(
      screen.getByLabelText("studio.prayer_intentions.table.label"),
      "Healing",
    );
    await userEvent.clear(
      screen.getByLabelText("studio.prayer_intentions.table.color"),
    );
    await userEvent.type(
      screen.getByLabelText("studio.prayer_intentions.table.color"),
      "#4A78C2",
    );
    await userEvent.type(
      screen.getByLabelText("studio.common.description"),
      "Recovery",
    );
    await userEvent.click(
      screen.getByRole("button", { name: "studio.common.create" }),
    );

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

    await userEvent.clear(
      screen.getByLabelText("studio.prayer_intentions.table.label"),
    );
    await userEvent.type(
      screen.getByLabelText("studio.prayer_intentions.table.label"),
      "Recovery",
    );
    await userEvent.click(
      screen.getByRole("button", {
        name: "studio.prayer_intentions.form.save_changes",
      }),
    );

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

    await userEvent.type(
      screen.getByLabelText("studio.prayer_intentions.table.slug"),
      "healing",
    );
    await userEvent.type(
      screen.getByLabelText("studio.common.description"),
      "Recovery",
    );
    await userEvent.click(
      screen.getByRole("button", { name: "studio.common.create" }),
    );

    expect(onSubmit).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith(
      "studio.prayer_intentions.validation.label_required",
    );
  });

  it("does not submit when display order is cleared", async () => {
    const onSubmit = renderDialog(null);

    await userEvent.type(
      screen.getByLabelText("studio.prayer_intentions.table.slug"),
      "healing",
    );
    await userEvent.type(
      screen.getByLabelText("studio.prayer_intentions.table.label"),
      "Healing",
    );
    await userEvent.type(
      screen.getByLabelText("studio.common.description"),
      "Recovery",
    );
    await userEvent.clear(
      screen.getByLabelText("studio.prayer_intentions.form.display_order"),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "studio.common.create" }),
    );

    expect(onSubmit).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith(
      "studio.prayer_intentions.validation.order_required",
    );
  });
});
