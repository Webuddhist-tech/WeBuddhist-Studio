import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

const originalUserAgent = navigator.userAgent;

/**
 * A fresh copy each test: whether the Studio was installed is kept at module
 * level, as the browser's event can fire before anything mounts.
 */
const renderButton = async () => {
  vi.resetModules();
  const { InstallAppButton } = await import("./InstallAppButton");
  render(<InstallAppButton />);
};

const setUserAgent = (value: string) =>
  Object.defineProperty(navigator, "userAgent", {
    value,
    configurable: true,
  });

/** What Chrome fires when the Studio may be installed. */
const fireInstallPrompt = (outcome: "accepted" | "dismissed" = "accepted") => {
  const event = new Event("beforeinstallprompt", { cancelable: true });
  const prompt = vi.fn().mockResolvedValue(undefined);
  Object.assign(event, { prompt, userChoice: Promise.resolve({ outcome }) });
  act(() => {
    window.dispatchEvent(event);
  });
  return { event, prompt };
};

describe("InstallAppButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130");
  });

  afterEach(() => setUserAgent(originalUserAgent));

  it("shows nothing until the browser offers to install", async () => {
    await renderButton();
    expect(screen.queryByRole("button", { name: /install app/i })).toBeNull();
  });

  it("opens the browser's install prompt", async () => {
    await renderButton();
    const { event, prompt } = fireInstallPrompt();
    expect(event.defaultPrevented).toBe(true);

    await userEvent.click(
      await screen.findByRole("button", { name: /install app/i }),
    );

    expect(prompt).toHaveBeenCalled();
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith("Studio installed"),
    );
    // A prompt is good for one use.
    expect(screen.queryByRole("button", { name: /install app/i })).toBeNull();
  });

  it("hides once the app is installed", async () => {
    await renderButton();
    fireInstallPrompt();
    await screen.findByRole("button", { name: /install app/i });

    act(() => {
      window.dispatchEvent(new Event("appinstalled"));
    });

    expect(screen.queryByRole("button", { name: /install app/i })).toBeNull();
  });

  it("explains Add to Home Screen on iPhone", async () => {
    setUserAgent(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1",
    );
    await renderButton();

    await userEvent.click(screen.getByRole("button", { name: /install app/i }));

    expect(await screen.findByText("Install Studio")).toBeTruthy();
    expect(screen.getByText("Add to Home Screen")).toBeTruthy();
  });
});
