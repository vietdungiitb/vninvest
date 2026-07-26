import React from "react";
import { coreApiAdapter } from "../adapters/coreApiAdapter.js";
import { useTenantAdminQuery } from "../pages/tenant-admin/useTenantAdminQuery.ts";

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
 * Loads Alert Center feed / summary / symbol-stats via React Query cache
 * (tenant-scoped, window-focus refetch). Replaces the previous manual
 * setInterval(5000) polling (Slice C5 of the Alert Center plan).
 *
 * @param {{ env?: object, lane?: string, symbol?: string, sessionDate?: string, timeframe?: string, severity?: string[], alertFamily?: string[], refreshToken?: number, autoRefresh?: boolean }} params
 */
export function useAlertCenterData({ _env = DEFAULT_ENV, lane = "main", symbol = "", sessionDate = "", timeframe = "", severity = [], alertFamily = [], refreshToken = 0, autoRefresh = false } = {}) {
  const mountedRef = useRef(null);

  const normalizedSeverity = Array.isArray(severity) ? severity : [];
  const normalizedFamily = Array.isArray(alertFamily) ? alertFamily : [];
  const severityKey = normalizedSeverity.join(',');
  const familyKey = normalizedFamily.join(',');

  const queryKey = ["alert-center", lane, symbol, sessionDate, timeframe, severityKey, familyKey, String(refreshToken)];

  const query = useTenantAdminQuery(
    queryKey,
    "",
    {
      enabled: true,
      refetchInterval: autoRefresh ? 5000 : false,
      queryFn: async () => {
        const q = {
          symbol: symbol || undefined,
          session_date: sessionDate || undefined,
          timeframe: timeframe || undefined,
          ...(normalizedSeverity.length ? { severity: normalizedSeverity.join(',') } : {}),
          ...(normalizedFamily.length ? { alert_family: normalizedFamily.join(',') } : {}),
        };

        const [payload, summary, symbolStats] = await Promise.all([
          lane === "ai" ? coreApiAdapter.getAIAlertsFeed(q) : coreApiAdapter.getAlertCenterFeed(q),
          lane === "ai" ? coreApiAdapter.getAIAlertsSummary(q) : coreApiAdapter.getAlertCenterSummary(q),
          lane === "ai"
            ? coreApiAdapter.getAIAlertsSymbolStats({ ...q, page: 1, page_size: 200 })
            : coreApiAdapter.getAlertCenterSymbolStats({ ...q, page: 1, page_size: 200 }),
        ]);

        const payloadObj = (payload && payload.results) ? payload : { results: Array.isArray(payload) ? payload : [], next: null, previous: null };
        const summaryObj = summary || {};
        const statsObj = symbolStats || {};

        return {
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
        };
      },
    },
  );

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const isLoading = query.isLoading || query.isFetching;
  const error = query.isError ? (query.error && query.error.message ? query.error.message : "Không thể tải alert center từ core API.") : "";

  const data = query.data;
  const state = data
    ? { loading: isLoading, error: error, payload: data.payload, summary: data.summary, symbolStats: data.symbolStats }
    : { ...INITIAL_STATE, loading: isLoading, error: error };

  return { ...state, refetch: query.refetch };
}
