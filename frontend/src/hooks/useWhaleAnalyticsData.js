import { useState, useEffect, useCallback, useRef } from 'react';
import { getWhaleAnalyticsSnapshot } from '../api/client';
import { resolveWhaleTimeframeWindow } from '../utils/whaleTimeAdapter';
import { normalizeWhaleAnalyticsSnapshot } from '../utils/whaleAnalyticsSnapshotAdapter';

/**
 * useWhaleAnalyticsData Hook
 * 
 * Single source of truth for fetching Whale Bubbles and Dark Money Flow data.
 * Ensures synchronized parallel loading for both sub-charts.
 */
export default function useWhaleAnalyticsData(symbol, timeframe) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [data, setData] = useState({
    bubbles: null,
    flow: null,
    meta: null,
  });
  const requestIdRef = useRef(0);

  const fetchData = useCallback(async ({ silent = false } = {}) => {
    if (!symbol) {
      setData({ bubbles: null, flow: null, meta: null });
      return;
    }

    const requestId = ++requestIdRef.current;

    if (!silent) {
      setLoading(true);
      setError(null);
    }

    try {
      const snapshotRes = await getWhaleAnalyticsSnapshot(symbol, { timeframe, compact: 1 });
      const snapshot = snapshotRes?.data;

      if (requestId !== requestIdRef.current) {
        return;
      }

      if (!snapshot?.symbol) {
        throw new Error(snapshot?.error || 'Failed to fetch valid analytics snapshot');
      }

      setData(normalizeWhaleAnalyticsSnapshot(snapshot, timeframe));
    } catch (err) {
      console.error('[useWhaleAnalyticsData] Error:', err);
      if (requestId === requestIdRef.current && !silent) {
        setError(err.response?.data?.error || err.message || 'Unknown error fetching analytics');
      }
    } finally {
      if (requestId === requestIdRef.current && !silent) {
        setLoading(false);
      }
    }
  }, [symbol, timeframe]);

  useEffect(() => {
    fetchData({ silent: false });
  }, [fetchData]);

  useEffect(() => {
    const timeframeWindow = resolveWhaleTimeframeWindow(timeframe);
    if (!timeframeWindow.isLive) {
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
  }, [fetchData, timeframe]);

  return { 
    loading, 
    error, 
    data, 
    refetch: fetchData 
  };
}
