import { useCallback, useEffect, useRef, useState } from "react";

export const AUTOSAVE_DELAY_MS = 800;

type UseAutosaveOptions<T> = {
  value: T;
  /**
   * Persists `value`. Resolve `false` when it was deliberately not saved (e.g.
   * invalid); reject when the request failed and is worth retrying.
   */
  save: (value: T) => Promise<boolean>;
  delayMs?: number;
  enabled?: boolean;
};

/**
 * Saves `value` once it has stopped changing for `delayMs`. Values are compared
 * by their JSON, so callers pass plain data. Saves run one at a time, in order.
 * A value that failed to save is not retried until it changes again or
 * `retry` is called. On unmount the latest value is saved after any running
 * save, unless it is already on the server.
 */
export const useAutosave = <T>({
  value,
  save,
  delayMs = AUTOSAVE_DELAY_MS,
  enabled = true,
}: UseAutosaveOptions<T>) => {
  const key = JSON.stringify(value);
  const [savedKey, setSavedKey] = useState(key);
  const [failed, setFailed] = useState<{ key: string; error: boolean } | null>(
    null,
  );
  const [isSaving, setIsSaving] = useState(false);
  const savedKeyRef = useRef(key);
  const inFlightRef = useRef<Promise<void> | null>(null);
  const saveRef = useRef(save);
  const latestRef = useRef({ key, value, enabled });

  useEffect(() => {
    saveRef.current = save;
    latestRef.current = { key, value, enabled };
  });

  /** Queues a save of `nextValue` behind any running one. */
  const run = useCallback((nextKey: string, nextValue: T) => {
    const attempt = async () => {
      // An earlier save may already have stored this value.
      if (nextKey === savedKeyRef.current) return;
      try {
        if (await saveRef.current(nextValue)) {
          savedKeyRef.current = nextKey;
          setSavedKey(nextKey);
          setFailed(null);
        } else {
          setFailed({ key: nextKey, error: false });
        }
      } catch {
        setFailed({ key: nextKey, error: true });
      }
    };
    const prior = inFlightRef.current;
    const task = prior ? prior.then(attempt) : attempt();
    inFlightRef.current = task;
    setIsSaving(true);
    void task.finally(() => {
      if (inFlightRef.current !== task) return;
      inFlightRef.current = null;
      setIsSaving(false);
    });
  }, []);

  useEffect(
    () => () => {
      const latest = latestRef.current;
      if (latest.enabled) run(latest.key, latest.value);
    },
    [run],
  );

  useEffect(() => {
    if (!enabled || isSaving) return;
    if (key === savedKey || key === failed?.key) return;
    const timer = setTimeout(() => run(key, value), delayMs);
    return () => clearTimeout(timer);
    // `value` is fully described by `key`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, savedKey, failed, isSaving, enabled, delayMs, run]);

  /** Records `next` as already saved, e.g. after loading it from the server. */
  const markSaved = useCallback((next: T) => {
    const nextKey = JSON.stringify(next);
    savedKeyRef.current = nextKey;
    setSavedKey(nextKey);
    setFailed(null);
  }, []);

  /** Saves the current value again, e.g. after a request failed. */
  const retry = useCallback(() => {
    const latest = latestRef.current;
    if (latest.enabled) run(latest.key, latest.value);
  }, [run]);

  return {
    isSaving,
    isDirty: key !== savedKey,
    hasError: !isSaving && failed?.error === true && failed.key === key,
    markSaved,
    retry,
  };
};
