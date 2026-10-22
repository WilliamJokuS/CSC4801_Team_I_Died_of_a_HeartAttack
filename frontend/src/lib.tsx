import { useCallback, useEffect, useState } from 'react';
import { ApiError } from './api/client';

/** "Python, sql ,  " -> ["Python", "sql"]. The server does the real normalization. */
export function parseSkills(text: string): string[] {
  return text
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) return `${err.status || ''} ${err.code}: ${err.message}`.trim();
  return err instanceof Error ? err.message : String(err);
}

/** Timestamps arrive as ISO 8601 UTC; shown in the browser's local timezone. */
export function formatTime(iso: string): string {
  return new Date(iso).toLocaleString();
}

/** Loads data on mount and exposes reload(). */
export function useLoad<T>(load: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setData(await load());
      setError(null);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
    // `load` is fixed for the component's lifetime; pages remount to load something else.
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { data, error, loading, reload, setData };
}

/** Runs an action, records its error/success message, then calls onDone. */
export function useAction() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  async function run(action: () => Promise<unknown>, okText?: string, onDone?: () => unknown) {
    setBusy(true);
    setMessage(null);
    try {
      await action();
      if (okText) setMessage({ kind: 'ok', text: okText });
      await onDone?.();
    } catch (err) {
      setMessage({ kind: 'error', text: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  return { busy, message, run };
}

export function Status({ error, loading }: { error?: string | null; loading?: boolean }) {
  if (loading) return <p className="muted">Loading…</p>;
  if (error) return <p className="error">{error}</p>;
  return null;
}

export function Message({ message }: { message: { kind: 'ok' | 'error'; text: string } | null }) {
  if (!message) return null;
  return <p className={message.kind === 'ok' ? 'ok' : 'error'}>{message.text}</p>;
}

export function Skills({ skills }: { skills: string[] }) {
  if (skills.length === 0) return <span className="muted">(none)</span>;
  return <span>{skills.join(', ')}</span>;
}
