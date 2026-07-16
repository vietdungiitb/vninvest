import { useCallback, useEffect, useRef, useState } from "react";

/**
 * useRealtimePolling - Generic polling hook with AbortController cleanup
 * 
 * Features:
 * - AbortController per poll cycle for clean cancellation
 * - Dedupe key support to ignore stale responses on symbol change
 * - Exponential backoff retry on error
 * - Automatic cleanup on unmount
 * - Configurable interval and enabled state
 * 
 * @template T
 * @param {Object} options
 * @param {number} options.intervalMs - Polling interval in ms (default: 5000)
 * @param {Function} options.fetchFn - Async function (signal: AbortSignal) => Promise<T>
 * @param {Function} options.onData - Callback when data received (data: T) => void
 * @param {Function} [options.onError] - Callback on error (error: Error) => void
 * @param {boolean} [options.enabled=true] - Enable/disable polling
 * @param {string} [options.dedupeKey] - Key to detect stale responses (e.g., symbol)
 * @returns {Object} { stop, start, isPolling }
 */
export function useRealtimePolling({
  intervalMs = 5000,
  fetchFn,
  onData,
  onError,
  enabled = true,
  dedupeKey,
} = {}) {
  const [isPolling, setIsPolling] = useState(false);
  const intervalRef = useRef(null);
  const abortControllerRef = useRef(null);
  const dedupeKeyRef = useRef(dedupeKey);
  const prevDedupeKeyRef = useRef(dedupeKey);
  const retryCountRef = useRef(0);
  const mountedRef = useRef(true);
  const fetchFnRef = useRef(fetchFn);
  const onDataRef = useRef(onData);
  const onErrorRef = useRef(onError);
  const enabledRef = useRef(enabled);

  // Keep refs updated
  useEffect(() => {
    fetchFnRef.current = fetchFn;
  }, [fetchFn]);

  useEffect(() => {
    onDataRef.current = onData;
  }, [onData]);

  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  useEffect(() => {
    dedupeKeyRef.current = dedupeKey;
  }, [dedupeKey]);



  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      stop();
    };
  }, [stop]);

  const stop = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsPolling(false);
    retryCountRef.current = 0;
  }, []);

  const executePoll = useCallback(async () => {
    if (!mountedRef.current || !enabledRef.current) return;

    const activeDedupeKey = dedupeKeyRef.current;

    // Create new AbortController for this poll cycle
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const data = await fetchFnRef.current(controller.signal);
      
      // Check if component still mounted and dedupe key matches
      if (!mountedRef.current) return;
      if (activeDedupeKey !== undefined && dedupeKeyRef.current !== activeDedupeKey) {
        // Stale response - symbol changed, ignore
        return;
      }
      
      onDataRef.current?.(data);
      retryCountRef.current = 0; // Reset retry count on success
    } catch (err) {
      if (!mountedRef.current) return;
      if (err.name === "AbortError") return; // Expected on cleanup
      
      onErrorRef.current?.(err);
      
      // Exponential backoff retry
      if (retryCountRef.current < 3) {
        retryCountRef.current++;
        const backoffMs = Math.min(1000 * Math.pow(2, retryCountRef.current - 1), 8000);
        setTimeout(() => {
          if (mountedRef.current && enabledRef.current) {
            executePoll();
          }
        }, backoffMs);
      }
    }
  }, []);

  const start = useCallback(() => {
    if (!enabledRef.current || intervalRef.current) return;
    
    setIsPolling(true);
    retryCountRef.current = 0;
    
    // Initial poll
    executePoll();
    
    // Schedule recurring polls
    intervalRef.current = setInterval(() => {
      if (mountedRef.current && enabledRef.current) {
        executePoll();
      }
    }, intervalMs);
  }, [executePoll, intervalMs]);

  // Auto-start/stop based on enabled
  useEffect(() => {
    if (enabled) {
      start();
    } else {
      stop();
    }
    return () => stop();
  }, [enabled, start, stop]);

  // Restart when dedupeKey actually changes (e.g., symbol switch)
  // Use prevDedupeKeyRef to avoid double-fetch on mount when isPolling changes
  useEffect(() => {
    if (enabled && isPolling && dedupeKey !== prevDedupeKeyRef.current) {
      stop();
      start();
    }
    prevDedupeKeyRef.current = dedupeKey;
  }, [dedupeKey, enabled, isPolling, start, stop]);

  return { stop, start, isPolling };
}