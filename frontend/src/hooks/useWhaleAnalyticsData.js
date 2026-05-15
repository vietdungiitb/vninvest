import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { getWhaleAnalyticsSnapshot } from '../api/client';
import { resolveWhaleTimeframeWindow } from '../utils/whaleTimeAdapter';
import { mergeWhaleAnalyticsSnapshots, normalizeWhaleAnalyticsSnapshot } from '../utils/whaleAnalyticsSnapshotAdapter';
import { isRequestCanceled } from '../utils/requestCancellation';

function createEmptyAnalyticsData() {
  return {
    bubbles: null,
    flow: null,
    meta: null,
  };
}

/**
 * useWhaleAnalyticsData Hook
 * 
 * Single source of truth for fetching Whale Bubbles and Dark Money Flow data.
 * Ensures synchronized parallel loading for both sub-charts.
 */
export default function useWhaleAnalyticsData(symbol, timeframe, tradeDate, options = {}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [data, setData] = useState(createEmptyAnalyticsData());
  const requestIdRef = useRef(0);
  const includeBaseline = options?.includeBaseline ?? false;
  const skip = options?.skip ?? false;
  const selectedTradeDate = options?.selectedTradeDate ? String(options.selectedTradeDate).slice(0, 10) : null;
  const requestedTradeDates = useMemo(() => Array.from(new Set(
    (Array.isArray(options?.tradeDates) ? options.tradeDates : [])
      .map((value) => (value ? String(value).slice(0, 10) : null))
      .filter(Boolean),
  )), [options?.tradeDates]);
  const requestedTradeDatesKey = requestedTradeDates.join('|');

  const fetchData = useCallback(async ({ silent = false } = {}) => {
    if (skip) {
      if (!silent) {
        setLoading(false);
        setError(null);
      }
      setData(createEmptyAnalyticsData());
      return;
    }

    if (!symbol) {
      setData(createEmptyAnalyticsData());
      return;
    }

    const requestId = ++requestIdRef.current;

    if (!silent) {
      setLoading(true);
      setError(null);
    }

    try {
      const normalizedTradeDate = tradeDate ? String(tradeDate).slice(0, 10) : null;
      if (requestedTradeDates.length > 0) {
        const snapshotResults = await Promise.allSettled(
          requestedTradeDates.map((requestedDate) => getWhaleAnalyticsSnapshot(symbol, {
            timeframe,
            compact: 0,
            tradeDate: requestedDate,
            includeBaseline,
          })),
        );

        if (requestId !== requestIdRef.current) {
          return;
        }

        const normalizedSnapshots = snapshotResults
          .filter((result) => result.status === 'fulfilled' && result.value?.data?.symbol)
          .map((result) => normalizeWhaleAnalyticsSnapshot(result.value.data, timeframe));

        if (!normalizedSnapshots.length) {
          const firstRejected = snapshotResults.find((result) => result.status === 'rejected');
          if (firstRejected?.reason) {
            throw firstRejected.reason;
          }
          setData(createEmptyAnalyticsData());
          return;
        }

        setData(mergeWhaleAnalyticsSnapshots(normalizedSnapshots, timeframe, selectedTradeDate || normalizedTradeDate));
        return;
      }

      const snapshotRes = await getWhaleAnalyticsSnapshot(symbol, {
        timeframe,
        compact: 0,
        tradeDate: normalizedTradeDate,
        includeBaseline,
      });
      const snapshot = snapshotRes?.data;

      if (requestId !== requestIdRef.current) {
        return;
      }

      if (!snapshot?.symbol) {
        if (snapshot?.error) {
          throw new Error(snapshot.error);
        }
        setData(createEmptyAnalyticsData());
        return;
      }

      setData(normalizeWhaleAnalyticsSnapshot(snapshot, timeframe));
    } catch (err) {
      if (isRequestCanceled(err)) {
        return;
      }
      console.error('[useWhaleAnalyticsData] Error:', err);
      if (requestId === requestIdRef.current && !silent) {
        setError(err.response?.data?.error || err.message || 'Unknown error fetching analytics');
      }
    } finally {
      if (requestId === requestIdRef.current && !silent) {
        setLoading(false);
      }
    }
  }, [includeBaseline, requestedTradeDatesKey, selectedTradeDate, skip, symbol, timeframe, tradeDate]);

  useEffect(() => {
    if (skip) {
      requestIdRef.current += 1;
      setLoading(false);
      setError(null);
      setData(createEmptyAnalyticsData());
      return;
    }

    fetchData({ silent: false });
  }, [fetchData, skip]);

  useEffect(() => {
    if (skip) {
      return undefined;
    }

    const timeframeWindow = resolveWhaleTimeframeWindow(timeframe);
    if (!timeframeWindow.isLive || tradeDate || requestedTradeDates.length > 0) {
      return undefined;
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchData({ silent: true });
      }
    };

    const handleWindowFocus = () => {
      if (document.visibilityState === 'visible') {
        fetchData({ silent: true });
      }
    };

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchData({ silent: true });
      }
    }, 30000);

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleWindowFocus);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleWindowFocus);
    };
  }, [fetchData, requestedTradeDatesKey, skip, timeframe, tradeDate]);

  return { 
    loading, 
    error, 
    data, 
    refetch: fetchData 
  };
}
