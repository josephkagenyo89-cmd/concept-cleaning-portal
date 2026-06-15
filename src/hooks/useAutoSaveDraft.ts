import { useEffect, useRef, useState } from 'react';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'queued' | 'error';

interface Options<T> {
  value: T;
  onSave: (value: T) => Promise<void>;
  debounceMs?: number;
  enabled?: boolean;
}

/**
 * Generic debounced auto-saver. Tracks status (saving / saved / queued / error).
 * `queued` means the network is offline — saved locally to IndexedDB.
 */
export function useAutoSaveDraft<T>({ value, onSave, debounceMs = 800, enabled = true }: Options<T>) {
  const [status, setStatus] = useState<SaveStatus>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSerialized = useRef<string>('');
  const firstRun = useRef(true);

  useEffect(() => {
    if (!enabled) return;
    if (firstRun.current) {
      firstRun.current = false;
      lastSerialized.current = JSON.stringify(value);
      return;
    }
    const next = JSON.stringify(value);
    if (next === lastSerialized.current) return;
    lastSerialized.current = next;
    setStatus('saving');
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      try {
        await onSave(value);
        setStatus(navigator.onLine ? 'saved' : 'queued');
        setLastSavedAt(new Date());
      } catch (err) {
        console.warn('Auto-save failed', err);
        setStatus('error');
      }
    }, debounceMs);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, enabled]);

  return { status, lastSavedAt };
}
