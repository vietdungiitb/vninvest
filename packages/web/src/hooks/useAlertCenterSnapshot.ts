import { useState, useCallback } from 'react';
import { coreApiAdapter } from '../adapters/coreApiAdapter.js';

export interface AlertFeedParams {
  symbol?: string;
  severity?: string;
  alert_family?: string;
  session_date?: string;
  page_size?: number;
  cursor?: string;
}

export interface AlertItem {
  id?: string;
  symbol?: string;
  ts?: string;
  timestamp?: string;
  severity?: string;
  title?: string;
  message?: string;
  [key: string]: unknown;
}

interface AlertFeedResponse {
  results: AlertItem[];
  next: string | null;
  previous: string | null;
}

export function useAlertCenterSnapshot(initialParams: AlertFeedParams = {}) {
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [cursorHistory, setCursorHistory] = useState<string[]>([]);

  const fetchFeed = useCallback(async (params: AlertFeedParams) => {
    setLoading(true);
    setError(null);
    try {
      const data = await (coreApiAdapter as any).getAlertCenterFeed(params) as AlertFeedResponse;
      setAlerts(data.results || []);
      setNextCursor(data.next);
      return data;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Không thể tải dữ liệu cảnh báo.';
      setError(msg);
      setAlerts([]);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const loadInitial = useCallback(() => {
    setCursorHistory([]);
    fetchFeed(initialParams);
  }, [fetchFeed, initialParams]);

  const goToNextPage = useCallback(() => {
    if (nextCursor) {
      setCursorHistory(prev => [...prev, nextCursor]);
      fetchFeed({ ...initialParams, cursor: nextCursor, page_size: initialParams.page_size || 20 });
    }
  }, [nextCursor, fetchFeed, initialParams]);

  const goToPrevPage = useCallback(() => {
    if (cursorHistory.length === 0) return;
    const prevCursors = [...cursorHistory];
    prevCursors.pop();
    setCursorHistory(prevCursors);
    const prevCursor = prevCursors.length > 0 ? prevCursors[prevCursors.length - 1] : undefined;
    fetchFeed(prevCursor ? { ...initialParams, cursor: prevCursor } : initialParams);
  }, [cursorHistory, fetchFeed, initialParams]);

  return {
    alerts,
    loading,
    error,
    hasNextPage: !!nextCursor,
    hasPrevPage: cursorHistory.length > 0,
    goToNextPage,
    goToPrevPage,
    loadInitial,
  };
}
