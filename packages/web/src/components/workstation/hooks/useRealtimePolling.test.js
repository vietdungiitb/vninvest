/**
 * useRealtimePolling.test.js
 * Unit tests for the useRealtimePolling hook
 * 
 * Critical test: verifies stale closure fix when dedupeKey (symbol) changes
 */
import { jest } from '@jest/globals';
import { renderHook, act } from '@testing-library/react';
import { useRealtimePolling } from './useRealtimePolling.js';

describe('useRealtimePolling', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('starts and stops polling', async () => {
    const fetchFn = jest.fn().mockResolvedValue({ data: 'test' });
    const onData = jest.fn();
    const onError = jest.fn();

    const { result } = renderHook(() =>
      useRealtimePolling({
        intervalMs: 5000,
        fetchFn,
        onData,
        onError,
        enabled: true,
      })
    );

    expect(result.current.isPolling).toBe(true);
    expect(fetchFn).toHaveBeenCalledTimes(1); // Initial poll

    // Advance timer by interval
    await act(async () => {
      jest.advanceTimersByTime(5000);
    });

    expect(fetchFn).toHaveBeenCalledTimes(2); // Initial + 1 interval

    // Stop polling
    result.current.stop();
    expect(result.current.isPolling).toBe(false);

    // Advance timer again - should not poll
    await act(async () => {
      jest.advanceTimersByTime(5000);
    });

    expect(fetchFn).toHaveBeenCalledTimes(2); // No additional calls
  });

  test('ignores stale response when dedupeKey changes during fetch', async () => {
    let resolveFetch;
    const fetchPromise = new Promise((resolve) => {
      resolveFetch = resolve;
    });
    
    const fetchFn = jest.fn().mockReturnValue(fetchPromise);
    const onData = jest.fn();
    const onError = jest.fn();

    const { result, rerender } = renderHook(
      ({ dedupeKey }) =>
        useRealtimePolling({
          intervalMs: 5000,
          fetchFn,
          onData,
          onError,
          enabled: true,
          dedupeKey,
        }),
      { initialProps: { dedupeKey: 'ACB' } }
    );

    // Initial poll started
    expect(fetchFn).toHaveBeenCalledTimes(1);

    // Change dedupeKey (simulate symbol switch) WHILE fetch is in flight
    rerender({ dedupeKey: 'GVR' });

    // Resolve the OLD fetch (for ACB)
    await act(async () => {
      resolveFetch({ data: 'stale-data-for-ACB' });
      await Promise.resolve(); // Let microtasks run
    });

    // onData should NOT be called because dedupeKey changed
    expect(onData).not.toHaveBeenCalled();

    // Now trigger a new poll for GVR
    await act(async () => {
      jest.advanceTimersByTime(5000);
    });

    // New fetch for GVR should be in flight
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  test('calls onData when dedupeKey matches after fetch completes', async () => {
    let resolveFetch;
    const fetchPromise = new Promise((resolve) => {
      resolveFetch = resolve;
    });
    
    const fetchFn = jest.fn().mockReturnValue(fetchPromise);
    const onData = jest.fn();
    const onError = jest.fn();

    const { result } = renderHook(() =>
      useRealtimePolling({
        intervalMs: 5000,
        fetchFn,
        onData,
        onError,
        enabled: true,
        dedupeKey: 'FPT',
      })
    );

    // Resolve fetch with matching dedupeKey
    await act(async () => {
      resolveFetch({ data: 'fresh-data-for-FPT' });
      await Promise.resolve();
    });

    // onData SHOULD be called because dedupeKey still matches
    expect(onData).toHaveBeenCalledWith({ data: 'fresh-data-for-FPT' });
  });

  test('retries with exponential backoff on error', async () => {
    const fetchFn = jest
      .fn()
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce({ data: 'success-after-retry' });
    const onData = jest.fn();
    const onError = jest.fn();

    const { result } = renderHook(() =>
      useRealtimePolling({
        intervalMs: 5000,
        fetchFn,
        onData,
        onError,
        enabled: true,
      })
    );

    // Wait for first fetch to fail and retry
    await act(async () => {
      await Promise.resolve(); // Let first fetch fail
      jest.advanceTimersByTime(1000); // First backoff: 1s
      await Promise.resolve(); // Let retry execute
    });

    expect(onError).toHaveBeenCalledTimes(1);
    expect(fetchFn).toHaveBeenCalledTimes(2); // Initial + 1 retry

    // Wait for retry to succeed
    await act(async () => {
      await Promise.resolve();
    });

    expect(onData).toHaveBeenCalledWith({ data: 'success-after-retry' });
  });

  test('aborts in-flight fetch on stop', async () => {
    let abortSignal;
    const fetchFn = jest.fn().mockImplementation((signal) => {
      abortSignal = signal;
      return new Promise((resolve) => {
        signal.addEventListener('abort', () => {
          resolve({ data: 'aborted' });
        });
      });
    });
    const onData = jest.fn();
    const onError = jest.fn();

    const { result } = renderHook(() =>
      useRealtimePolling({
        intervalMs: 5000,
        fetchFn,
        onData,
        onError,
        enabled: true,
      })
    );

    // Stop polling - should abort in-flight fetch
    result.current.stop();

    expect(abortSignal.aborted).toBe(true);
    expect(result.current.isPolling).toBe(false);
  });

  test('restarts polling when dedupeKey changes', async () => {
    const fetchFn = jest.fn().mockResolvedValue({ data: 'test' });
    const onData = jest.fn();
    const onError = jest.fn();

    const { result, rerender } = renderHook(
      ({ dedupeKey }) =>
        useRealtimePolling({
          intervalMs: 5000,
          fetchFn,
          onData,
          onError,
          enabled: true,
          dedupeKey,
        }),
      { initialProps: { dedupeKey: 'ACB' } }
    );

    expect(fetchFn).toHaveBeenCalledTimes(1);

    // Change dedupeKey
    rerender({ dedupeKey: 'GVR' });

    // Should restart polling (stop + start)
    await act(async () => {
      await Promise.resolve();
    });

    // New initial poll for GVR
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  test('does not poll when enabled is false', () => {
    const fetchFn = jest.fn().mockResolvedValue({ data: 'test' });
    const onData = jest.fn();
    const onError = jest.fn();

    const { result } = renderHook(() =>
      useRealtimePolling({
        intervalMs: 5000,
        fetchFn,
        onData,
        onError,
        enabled: false,
      })
    );

    expect(result.current.isPolling).toBe(false);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  test('cleans up on unmount', async () => {
    const fetchFn = jest.fn().mockResolvedValue({ data: 'test' });
    const onData = jest.fn();
    const onError = jest.fn();

    const { result, unmount } = renderHook(() =>
      useRealtimePolling({
        intervalMs: 5000,
        fetchFn,
        onData,
        onError,
        enabled: true,
      })
    );

    expect(result.current.isPolling).toBe(true);

    unmount();

    // Should not poll after unmount
    await act(async () => {
      jest.advanceTimersByTime(5000);
    });

    expect(fetchFn).toHaveBeenCalledTimes(1); // Only initial poll
  });
});