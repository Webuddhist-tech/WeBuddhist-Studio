import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AUTOSAVE_DELAY_MS, useAutosave } from "./useAutosave";

const render = (save: (value: string) => Promise<boolean>) =>
  renderHook(({ value }) => useAutosave({ value, save }), {
    initialProps: { value: "a" },
  });

const wait = (ms: number) =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });

describe("useAutosave", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("does not save the initial value", async () => {
    const save = vi.fn().mockResolvedValue(true);
    render(save);
    await wait(AUTOSAVE_DELAY_MS * 2);
    expect(save).not.toHaveBeenCalled();
  });

  it("saves only the last value once edits pause", async () => {
    const save = vi.fn().mockResolvedValue(true);
    const { result, rerender } = render(save);

    rerender({ value: "ab" });
    await wait(AUTOSAVE_DELAY_MS / 2);
    rerender({ value: "abc" });
    expect(result.current.isDirty).toBe(true);
    await wait(AUTOSAVE_DELAY_MS);

    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith("abc");
    expect(result.current.isDirty).toBe(false);
  });

  it("does not retry a failed value until it changes", async () => {
    const save = vi.fn().mockResolvedValue(false);
    const { rerender } = render(save);

    rerender({ value: "bad" });
    await wait(AUTOSAVE_DELAY_MS * 3);
    expect(save).toHaveBeenCalledTimes(1);

    rerender({ value: "better" });
    await wait(AUTOSAVE_DELAY_MS);
    expect(save).toHaveBeenLastCalledWith("better");
  });

  it("skips values marked as already saved", async () => {
    const save = vi.fn().mockResolvedValue(true);
    const { result, rerender } = render(save);

    act(() => result.current.markSaved("loaded"));
    rerender({ value: "loaded" });
    await wait(AUTOSAVE_DELAY_MS * 2);
    expect(save).not.toHaveBeenCalled();
  });

  it("flushes a pending edit on unmount", async () => {
    const save = vi.fn().mockResolvedValue(true);
    const { rerender, unmount } = render(save);

    rerender({ value: "unsaved" });
    unmount();
    expect(save).toHaveBeenCalledWith("unsaved");
  });
});
