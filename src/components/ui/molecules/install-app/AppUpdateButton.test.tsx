import type { ComponentProps } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppUpdateButton } from "./AppUpdateButton";
import { AppUpdateContext, type AppUpdate } from "./appUpdateContext";

const reload = vi.fn();

const renderButton = (
  update: Partial<AppUpdate> = {},
  props: ComponentProps<typeof AppUpdateButton> = {},
) =>
  render(
    <AppUpdateContext
      value={{
        ready: true,
        promptClosed: true,
        closePrompt: vi.fn(),
        reload,
        hasUpdateButton: true,
        hostUpdateButton: () => () => {},
        ...update,
      }}
    >
      <AppUpdateButton {...props} />
    </AppUpdateContext>,
  );

describe("AppUpdateButton", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows nothing while there is no update", () => {
    renderButton({ ready: false });
    expect(
      screen.queryByRole("button", { name: "studio.pwa.update" }),
    ).toBeNull();
  });

  it("shows nothing while the toast is still up", () => {
    renderButton({ promptClosed: false });
    expect(
      screen.queryByRole("button", { name: "studio.pwa.update" }),
    ).toBeNull();
  });

  it("asks before reloading", async () => {
    renderButton();

    await userEvent.click(
      screen.getByRole("button", { name: "studio.pwa.update" }),
    );

    expect(
      screen.getByText("studio.pwa.new_version_title"),
    ).toBeInTheDocument();
    expect(screen.getByText("studio.pwa.unsaved_warning")).toBeInTheDocument();
    expect(reload).not.toHaveBeenCalled();

    await userEvent.click(
      screen.getByRole("button", { name: "studio.pwa.reload_now" }),
    );
    expect(reload).toHaveBeenCalled();
  });

  it("puts the question away on Later", async () => {
    renderButton();

    await userEvent.click(
      screen.getByRole("button", { name: "studio.pwa.update" }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "studio.pwa.later" }),
    );

    await waitFor(() =>
      expect(screen.queryByText("studio.pwa.new_version_title")).toBeNull(),
    );
    expect(reload).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: "studio.pwa.update" }),
    ).toBeInTheDocument();
  });

  it("says what a reload costs on the screen it is on", async () => {
    renderButton({}, { showLabel: true, description: "Tap Live afterwards." });

    await userEvent.click(
      screen.getByRole("button", { name: "studio.pwa.update" }),
    );

    expect(screen.getByText("Tap Live afterwards.")).toBeInTheDocument();
  });
});
