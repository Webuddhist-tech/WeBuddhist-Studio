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

  it("saves a value reverted mid-save after the running save, on unmount", async () => {
    let finish!: (ok: boolean) => void;
    const save = vi
      .fn()
      .mockImplementationOnce(
        () => new Promise<boolean>((resolve) => (finish = resolve)),
      )
      .mockResolvedValue(true);
    const { rerender, unmount } = render(save);

    rerender({ value: "b" });
    await wait(AUTOSAVE_DELAY_MS);
    expect(save).toHaveBeenCalledWith("b");

    rerender({ value: "a" });
    unmount();
    expect(save).toHaveBeenCalledTimes(1);

    await act(async () => finish(true));
    expect(save).toHaveBeenCalledTimes(2);
    expect(save).toHaveBeenLastCalledWith("a");
  });

  it("saves a value reverted mid-save once the running save finishes", async () => {
    let finish!: (ok: boolean) => void;
    const save = vi
      .fn()
      .mockImplementationOnce(
        () => new Promise<boolean>((resolve) => (finish = resolve)),
      )
      .mockResolvedValue(true);
    const { result, rerender } = render(save);

    rerender({ value: "b" });
    await wait(AUTOSAVE_DELAY_MS);
    rerender({ value: "a" });
    await act(async () => finish(true));
    await wait(AUTOSAVE_DELAY_MS);

    expect(save).toHaveBeenLastCalledWith("a");
    expect(result.current.isDirty).toBe(false);
  });

  it("reports a failed request and saves it again on retry", async () => {
    const save = vi
      .fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValue(true);
    const { result, rerender } = render(save);

    rerender({ value: "b" });
    await wait(AUTOSAVE_DELAY_MS * 3);
    expect(save).toHaveBeenCalledTimes(1);
    expect(result.current.hasError).toBe(true);

    await act(async () => result.current.retry());
    expect(save).toHaveBeenCalledTimes(2);
    expect(result.current.hasError).toBe(false);
    expect(result.current.isDirty).toBe(false);
  });

  it("does not report an error for a value it declined to save", async () => {
    const save = vi.fn().mockResolvedValue(false);
    const { result, rerender } = render(save);

    rerender({ value: "invalid" });
    await wait(AUTOSAVE_DELAY_MS);
    expect(result.current.hasError).toBe(false);
    expect(result.current.isDirty).toBe(true);
  });
});
