import React from "react";
import { coreApiAdapter } from "../adapters/coreApiAdapter.js";
import { useCoreQuery } from "./useCoreQuery.ts";

const { useEffect, useRef } = React;

const DEFAULT_ENV = {};

const INITIAL_STATE = {
  loading: true,
  error: "",
  payload: { results: [], next: null, previous: null },
  summary: { total: 0, unseen: 0, by_severity: { critical: 0, high: 0, medium: 0, low: 0 } },
  symbolStats: { symbols: [], total_alerts_in_scope: 0, pagination: { page: 1, page_size: 200, total_pages: 1, total_symbols: 0 } },
};

/**
 * Loads Alert Center feed / summary / symbol-stats via 3 tiered core-user
 * queries (C1/C2): feed polls every 5s, summary + symbol-stats every 30s.
 * Return shape is unchanged from the single-query version.
 *
 * @param {{ env?: object, lane?: string, symbol?: string, sessionDate?: string, timeframe?: string, severity?: string[], alertFamily?: string[], refreshToken?: number, autoRefresh?: boolean }} params
 */
export function useAlertCenterData({ _env = DEFAULT_ENV, lane = "main", symbol = "", sessionDate = "", timeframe = "", severity = [], alertFamily = [], refreshToken = 0, autoRefresh = false } = {}) {
  const mountedRef = useRef(null);

  const normalizedSeverity = Array.isArray(severity) ? severity : [];
  const normalizedFamily = Array.isArray(alertFamily) ? alertFamily : [];
  const severityKey = normalizedSeverity.join(',');
  const familyKey = normalizedFamily.join(',');

  const q = {
    symbol: symbol || undefined,
    session_date: sessionDate || undefined,
    timeframe: timeframe || undefined,
    ...(normalizedSeverity.length ? { severity: normalizedSeverity.join(',') } : {}),
    ...(normalizedFamily.length ? { alert_family: normalizedFamily.join(',') } : {}),
  };
  const refreshKey = String(refreshToken);

  const feedQ = useCoreQuery(
    ["alert-center-feed", lane, symbol, sessionDate, timeframe, severityKey, familyKey, refreshKey],
    {
      enabled: true,
      refetchInterval: autoRefresh ? 5000 : false,
      queryFn: async () => {
        if (lane === "ai") return coreApiAdapter.getAIAlertsFeed(q);
        return coreApiAdapter.getAlertCenterFeed(q);
      },
    },
  );

  const summaryQ = useCoreQuery(
    ["alert-center-summary", lane, symbol, sessionDate, timeframe, severityKey, familyKey, refreshKey],
    {
      enabled: true,
      refetchInterval: autoRefresh ? 30000 : false,
      queryFn: async () => {
        if (lane === "ai") return coreApiAdapter.getAIAlertsSummary(q);
        return coreApiAdapter.getAlertCenterSummary(q);
      },
    },
  );

  // S4: client paging 8/trang trên snapshot 200 — BE có page/page_size nhưng dataset
  // symbol <200 nên luôn fetch page 1 một lần, chia trang ở AlertCenterPage (đủ cho màn hình này).
  const statsQ = useCoreQuery(
    ["alert-center-stats", lane, symbol, sessionDate, timeframe, severityKey, familyKey, refreshKey],
    {
      enabled: true,
      refetchInterval: autoRefresh ? 30000 : false,
      queryFn: async () => {
        if (lane === "ai") return coreApiAdapter.getAIAlertsSymbolStats({ ...q, page: 1, page_size: 200 });
        return coreApiAdapter.getAlertCenterSymbolStats({ ...q, page: 1, page_size: 200 });
      },
    },
  );

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const feedData = feedQ.data;
  const payloadObj = (feedData && feedData.results)
    ? feedData
    : { results: Array.isArray(feedData) ? feedData : [], next: null, previous: null };
  const summaryObj = summaryQ.data || {};
  const statsObj = statsQ.data || {};

  // S1: tách skeleton lần đầu khỏi poll nền — TanStack v5 isLoading chỉ true ở
  // lần fetch đầu (isPending && isFetching); isFetching true ở mọi poll nền.
  const hasAnyData = Boolean(feedQ.data || summaryQ.data || statsQ.data);
  const isInitialLoading = (feedQ.isLoading || summaryQ.isLoading || statsQ.isLoading) && !hasAnyData;
  const isBackgroundFetching = (feedQ.isFetching || summaryQ.isFetching || statsQ.isFetching)
    && !isInitialLoading;
  const feedError = feedQ.error
    ? (feedQ.error.message ? feedQ.error.message : "Không thể tải bảng tin cảnh báo.") : "";
  const summaryError = summaryQ.error
    ? (summaryQ.error.message ? summaryQ.error.message : "Không thể tải tổng hợp cảnh báo.") : "";
  const statsError = statsQ.error
    ? (statsQ.error.message ? statsQ.error.message : "Không thể tải thống kê theo mã.") : "";
  const firstError = feedError || summaryError || statsError;
  const error = firstError;
  const isLoading = isInitialLoading || isBackgroundFetching;

  const data = feedQ.data || summaryQ.data || statsQ.data;
  const state = data
    ? {
        loading: isLoading,
        error: error,
        payload: {
          results: payloadObj.results || [],
          next: payloadObj.next || null,
          previous: payloadObj.previous || null,
        },
        summary: {
          total: Number(summaryObj.total || 0),
          unseen: Number(summaryObj.unseen || 0),
          by_severity: {
            critical: Number(summaryObj.by_severity ? summaryObj.by_severity.critical : 0),
            high: Number(summaryObj.by_severity ? summaryObj.by_severity.high : 0),
            medium: Number(summaryObj.by_severity ? summaryObj.by_severity.medium : 0),
            low: Number(summaryObj.by_severity ? summaryObj.by_severity.low : 0),
          },
        },
        symbolStats: {
          symbols: Array.isArray(statsObj.symbols) ? statsObj.symbols : [],
          total_alerts_in_scope: Number(statsObj.total_alerts_in_scope || 0),
          pagination: {
            page: Number(statsObj.pagination ? statsObj.pagination.page : 1),
            page_size: Number(statsObj.pagination ? statsObj.pagination.page_size : 200),
            total_pages: Number(statsObj.pagination ? statsObj.pagination.total_pages : 1),
            total_symbols: Number(statsObj.pagination ? statsObj.pagination.total_symbols : 0),
          },
        },
      }
    : { ...INITIAL_STATE, loading: isLoading, error: error };

  const refetch = () => {
    const out = [feedQ.refetch(), summaryQ.refetch(), statsQ.refetch()];
    return Promise.allSettled(out);
  };

  return {
    ...state, refetch,
    isInitialLoading, isBackgroundFetching,
    feedError, summaryError, statsError,
  };
}
