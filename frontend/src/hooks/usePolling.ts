import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from '../api/client';

interface PollingState<T> {
  data: T | undefined;
  error: ApiError | undefined;
  loading: boolean;
  /** Fetch again right now (e.g. after a button click). */
  refresh: () => Promise<void>;
}

/**
 * Calls `fetcher` now and then every `intervalMs`, so the page stays up to date
 * without a reload. Pass `enabled = false` to pause (e.g. no student ID yet).
 * The last good data is kept on screen if one refresh fails.
 */
export function usePolling<T>(fetcher: () => Promise<T>, intervalMs: number, deps: unknown[], enabled = true): PollingState<T> {
  const [data, setData] = useState<T>();
  const [error, setError] = useState<ApiError>();
  const [loading, setLoading] = useState(enabled);
  const generation = useRef(0);
  const latestRequest = useRef(0);

  // Always call the latest fetcher without restarting the timer on every render.
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const run = useCallback(async () => {
    const currentGeneration = generation.current;
    const requestNumber = ++latestRequest.current;
    try {
      const result = await fetcherRef.current();
      if (currentGeneration === generation.current && requestNumber === latestRequest.current) {
        setData(result);
        setError(undefined);
      }
    } catch (e) {
      if (currentGeneration === generation.current && requestNumber === latestRequest.current)
        setError(e instanceof ApiError ? e : new ApiError(0, 'UNKNOWN', 'Unexpected error.'));
    } finally {
      if (currentGeneration === generation.current && requestNumber === latestRequest.current)
        setLoading(false);
    }
  }, []);

  useEffect(() => {
    generation.current += 1;
    if (!enabled) {
      setData(undefined);
      setError(undefined);
      setLoading(false);
      return () => { generation.current += 1; };
    }
    setData(undefined);
    setError(undefined);
    setLoading(true);
    void run();
    const id = window.setInterval(() => void run(), intervalMs);
    return () => {
      generation.current += 1;
      window.clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, intervalMs, run, ...deps]);

  return { data, error, loading, refresh: run };
}
