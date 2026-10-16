import { useCallback, useEffect, useRef, useState } from "react";

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
 *
 * R1.7: mỗi lượt chạy có AbortController + requestId riêng — lượt cũ bị abort
 * và kết quả cũ (về trễ) không được apply đè lên lượt mới nhất. Unmount dọn
 * timer + đánh dấu mounted=false nên không setState sau unmount.
 *
 * `asyncFn` NHẬN signal tùy chọn (tương thích ngược: fn cũ không tham số vẫn
 * chạy — khi đó abort chỉ có tác dụng logic qua requestId).
 */
export function useRetryableAsync<T>(
  asyncFn: (signal?: AbortSignal) => Promise<T>,
  maxRetries = 2,
): UseRetryableAsyncResult<T> {
  const [state, setState] = useState<UseRetryableAsyncState<T>>({
    data: null,
    loading: false,
    error: null,
    retryCount: 0,
  });

  const mountedRef = useRef(true);
  const requestIdRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const backoffTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
      if (backoffTimerRef.current) clearTimeout(backoffTimerRef.current);
    };
  }, []);

  const run = useCallback(async (attempt: number) => {
    // Lượt mới hủy lượt cũ (cả fetch vật lý qua signal lẫn kết quả logic qua id).
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    const isLatest = () => mountedRef.current && requestIdRef.current === requestId;

    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const result = await asyncFn(controller.signal);
      if (!isLatest()) return;
      setState({ data: result, loading: false, error: null, retryCount: attempt });
    } catch (err: unknown) {
      if (!isLatest()) return;
      if (controller.signal.aborted) {
        // Bị lượt mới hơn abort — im lặng, không báo lỗi giả.
        return;
      }
      const message = err && typeof err === "object" && "message" in err ? (err as Error).message : "Lỗi không xác định.";
      if (attempt < maxRetries) {
        await new Promise<void>((resolve) => {
          if (backoffTimerRef.current) clearTimeout(backoffTimerRef.current);
          backoffTimerRef.current = setTimeout(() => resolve(), 400 * attempt);
        });
        if (!isLatest()) return;
        await run(attempt + 1);
      } else if (mountedRef.current) {
        setState((s) => ({ ...s, loading: false, error: message, retryCount: attempt }));
      }
    } finally {
      if (isLatest()) {
        // Chỉ lượt mới nhất được tắt loading — lượt cũ về trễ không giật UI.
        setState((s) => (requestIdRef.current === requestId ? { ...s, loading: false } : s));
      }
    }
  }, [asyncFn, maxRetries]);

  const execute = useCallback(() => run(0), [run]);
  const retry = useCallback(() => run(state.retryCount), [run, state.retryCount]);
  const reset = useCallback(() => {
    requestIdRef.current += 1;
    abortRef.current?.abort();
    setState({ data: null, loading: false, error: null, retryCount: 0 });
  }, []);

  return { ...state, execute, retry, reset };
}
