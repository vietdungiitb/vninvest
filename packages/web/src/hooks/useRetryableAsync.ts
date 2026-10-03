import { useCallback, useRef, useState } from "react";

interface UseRetryableAsyncState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  retryCount: number;
}

interface UseRetryableAsyncResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  retryCount: number;
  execute: () => Promise<void>;
  retry: () => Promise<void>;
  reset: () => void;
}

/**
 * Wrap một async hàm với auto-retry (tối đa maxRetries lần) và manual retry.
 */
export function useRetryableAsync<T>(
  asyncFn: () => Promise<T>,
  maxRetries = 2,
): UseRetryableAsyncResult<T> {
  const [state, setState] = useState<UseRetryableAsyncState<T>>({
    data: null,
    loading: false,
    error: null,
    retryCount: 0,
  });

  const mountedRef = useRef(true);
  const inFlightRef = useRef(false);

  const run = useCallback(async (attempt: number) => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const result = await asyncFn();
      if (!mountedRef.current) return;
      setState({ data: result, loading: false, error: null, retryCount: attempt });
    } catch (err: unknown) {
      const message = err && typeof err === "object" && "message" in err ? (err as Error).message : "Lỗi không xác định.";
      if (attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, 400 * attempt));
        if (mountedRef.current) await run(attempt + 1);
      } else if (mountedRef.current) {
        setState((s) => ({ ...s, loading: false, error: message, retryCount: attempt }));
      }
    } finally {
      inFlightRef.current = false;
    }
  }, [asyncFn, maxRetries]);

  const execute = useCallback(() => run(0), [run]);
  const retry = useCallback(() => run(state.retryCount), [run, state.retryCount]);
  const reset = useCallback(() => {
    setState({ data: null, loading: false, error: null, retryCount: 0 });
  }, []);

  return { ...state, execute, retry, reset };
}
