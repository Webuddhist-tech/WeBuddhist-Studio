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
    expect(screen.queryByRole("button", { name: /update/i })).toBeNull();
  });

  it("shows nothing while the toast is still up", () => {
    renderButton({ promptClosed: false });
    expect(screen.queryByRole("button", { name: /update/i })).toBeNull();
  });

  it("asks before reloading", async () => {
    renderButton();

    await userEvent.click(screen.getByRole("button", { name: "Update" }));

    expect(screen.getByText("New version of the Studio")).toBeInTheDocument();
    expect(
      screen.getByText(/changes you haven't saved on this page will be lost/i),
    ).toBeInTheDocument();
    expect(reload).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: "Reload now" }));
    expect(reload).toHaveBeenCalled();
  });

  it("puts the question away on Later", async () => {
    renderButton();

    await userEvent.click(screen.getByRole("button", { name: "Update" }));
    await userEvent.click(screen.getByRole("button", { name: "Later" }));

    await waitFor(() =>
      expect(screen.queryByText("New version of the Studio")).toBeNull(),
    );
    expect(reload).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Update" })).toBeInTheDocument();
  });

  it("says what a reload costs on the screen it is on", async () => {
    renderButton({}, { showLabel: true, description: "Tap Live afterwards." });

    await userEvent.click(screen.getByRole("button", { name: "Update" }));

    expect(screen.getByText("Tap Live afterwards.")).toBeInTheDocument();
  });
});
