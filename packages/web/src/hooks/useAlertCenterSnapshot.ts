import { useState, useCallback, useEffect, useRef } from 'react';
import { coreApiAdapter } from '../adapters/coreApiAdapter.js';

export interface AlertFeedParams {
  symbol?: string;
  severity?: string;
  alert_family?: string;
  session_date?: string;
  timeframe?: string;
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

const POLL_INTERVAL = 15000;

/**
 * BE trả `next` là URL đầy đủ (?cursor=...), nhưng query feed chỉ nhận token
 * cursor trần — gửi nguyên URL gây 404 "Invalid cursor" khi bấm Trang sau.
 * (AlertCenterPage.extractFeedCursor làm việc tương tự.)
 */
export function extractFeedCursor(next: unknown): string | null {
  if (typeof next !== "string" || !next) return null;
  if (next.indexOf("cursor=") < 0) return next;
  try {
    const base = typeof window !== "undefined" ? window.location.origin : "http://localhost";
    return new URL(next, base).searchParams.get("cursor");
  } catch {
    return next;
  }
}

export function useAlertCenterSnapshot(initialParams: AlertFeedParams = {}) {
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [cursorHistory, setCursorHistory] = useState<string[]>([]);
  const mountedRef = useRef(true);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Deconstruct primitive values from initialParams to avoid callback dependency invalidation
  const { symbol, severity, alert_family, session_date, timeframe, page_size } = initialParams;

  const fetchFeed = useCallback(async (params: AlertFeedParams, silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const data = await (coreApiAdapter as any).getAlertCenterFeed(params) as AlertFeedResponse;
      if (mountedRef.current) {
        setAlerts(data.results || []);
        setNextCursor(extractFeedCursor(data.next));
      }
      return data;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Không thể tải dữ liệu cảnh báo.';
      if (mountedRef.current) {
        setError(msg);
        setAlerts([]);
      }
      return null;
    } finally {
      if (!silent && mountedRef.current) setLoading(false);
    }
  }, []);

  const loadInitial = useCallback(() => {
    setCursorHistory([]);
    fetchFeed({ symbol, severity, alert_family, session_date, timeframe, page_size });
  }, [fetchFeed, symbol, severity, alert_family, session_date, timeframe, page_size]);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(() => {
      if (mountedRef.current) {
        // Poll đúng trang user đang xem — trước đây luôn fetch trang 1 nên vừa
        // ghi đè nội dung trang 2+ vừa làm cursor history lệch.
        const currentCursor = cursorHistory.length > 0 ? cursorHistory[cursorHistory.length - 1] : undefined;
        fetchFeed({ symbol, severity, alert_family, session_date, timeframe, page_size, cursor: currentCursor }, true);
      }
    }, POLL_INTERVAL);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [fetchFeed, symbol, severity, alert_family, session_date, timeframe, page_size, cursorHistory]);

  const goToNextPage = useCallback(() => {
    if (nextCursor) {
      setCursorHistory(prev => [...prev, nextCursor]);
      fetchFeed({ symbol, severity, alert_family, session_date, timeframe, page_size, cursor: nextCursor });
    }
  }, [nextCursor, fetchFeed, symbol, severity, alert_family, session_date, timeframe, page_size]);

  const goToPrevPage = useCallback(() => {
    if (cursorHistory.length === 0) return;
    const prevCursors = [...cursorHistory];
    prevCursors.pop();
    setCursorHistory(prevCursors);
    const prevCursor = prevCursors.length > 0 ? prevCursors[prevCursors.length - 1] : undefined;
    fetchFeed({ symbol, severity, alert_family, session_date, timeframe, page_size, cursor: prevCursor });
  }, [cursorHistory, fetchFeed, symbol, severity, alert_family, session_date, timeframe, page_size]);

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
