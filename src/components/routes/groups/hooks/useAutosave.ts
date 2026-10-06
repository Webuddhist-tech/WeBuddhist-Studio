import { useCallback, useEffect, useRef, useState } from "react";

export const AUTOSAVE_DELAY_MS = 800;

type UseAutosaveOptions<T> = {
  value: T;
  /** Persists `value`; resolve `false` when it was not saved (e.g. invalid). */
  save: (value: T) => Promise<boolean>;
  delayMs?: number;
  enabled?: boolean;
};

/**
 * Saves `value` once it has stopped changing for `delayMs`. Values are compared
 * by their JSON, so callers pass plain data. A value that failed to save is not
 * retried until it changes again, and a pending save is flushed on unmount.
 */
export const useAutosave = <T>({
  value,
  save,
  delayMs = AUTOSAVE_DELAY_MS,
  enabled = true,
}: UseAutosaveOptions<T>) => {
  const key = JSON.stringify(value);
  const [savedKey, setSavedKey] = useState(key);
  const [isSaving, setIsSaving] = useState(false);
  const attemptedKeyRef = useRef<string | null>(null);
  const pendingRef = useRef<{ key: string; value: T } | null>(null);
  const saveRef = useRef(save);

  useEffect(() => {
    saveRef.current = save;
  });

  const run = useCallback(async (nextKey: string, nextValue: T) => {
    attemptedKeyRef.current = nextKey;
    setIsSaving(true);
    try {
      if (await saveRef.current(nextValue)) setSavedKey(nextKey);
    } finally {
      setIsSaving(false);
    }
  }, []);

  // Declared before the timer effect so its cleanup runs first on unmount,
  // while the unsaved value is still recorded.
  useEffect(
    () => () => {
      const pending = pendingRef.current;
      if (pending) void saveRef.current(pending.value);
    },
    [],
  );

  useEffect(() => {
    if (!enabled) return;
    if (key === savedKey || key === attemptedKeyRef.current) return;
    pendingRef.current = { key, value };
    if (isSaving) {
      return () => {
        pendingRef.current = null;
      };
    }
    const timer = setTimeout(() => {
      pendingRef.current = null;
      void run(key, value);
    }, delayMs);
    return () => {
      clearTimeout(timer);
      pendingRef.current = null;
    };
    // `value` is fully described by `key`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, savedKey, isSaving, enabled, delayMs, run]);

  /** Records `next` as already saved, e.g. after loading it from the server. */
  const markSaved = useCallback((next: T) => {
    const nextKey = JSON.stringify(next);
    attemptedKeyRef.current = null;
    setSavedKey(nextKey);
  }, []);

  return { isSaving, isDirty: key !== savedKey, markSaved };
};
