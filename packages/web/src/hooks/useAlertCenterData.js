import React from "react";
import { coreApiAdapter } from "../adapters/coreApiAdapter.js";

const { useEffect, useRef, useState } = React;

export function useAlertCenterData({ env = DEFAULT_ENV, lane = "main", symbol = "", sessionDate = "", timeframe = "", refreshToken = 0 } = {}) {
  const mountedRef = useRef(null);
  const [state, setState] = useState({
    loading: true,
    error: "",
    payload: { results: [], next: null, previous: null },
    summary: { total: 0, unseen: 0, by_severity: { critical: 0, high: 0, medium: 0, low: 0 } },
    symbolStats: { symbols: [], total_alerts_in_scope: 0, pagination: { page: 1, page_size: 200, total_pages: 1, total_symbols: 0 } },
  });

  useEffect(() => {
    mountedRef.current = true;

    async function load() {
      try {
        setState((currentState) => ({ ...currentState, loading: currentState.payload.results.length === 0, error: "" }));
        const adapter = coreApiAdapter;
        const query = { 
          symbol: symbol || undefined,
          session_date: sessionDate || undefined,
          timeframe: timeframe || undefined
        };
        
        const [payload, summary, symbolStats] = await Promise.all([
          lane === "ai" ? adapter.getAIAlertsFeed(query) : adapter.getAlertCenterFeed(query),
          lane === "ai" ? adapter.getAIAlertsSummary(query) : adapter.getAlertCenterSummary(query),
          lane === "ai"
            ? adapter.getAIAlertsSymbolStats({ ...query, page: 1, page_size: 200 })
            : adapter.getAlertCenterSymbolStats({ ...query, page: 1, page_size: 200 }),
        ]);

        if (!mountedRef.current) {
          return;
        }

        setState({
          loading: false,
          error: "",
          payload: {
            results: payload?.results ?? payload ?? [],
            next: payload?.next ?? null,
            previous: payload?.previous ?? null,
          },
          summary: {
            total: Number(summary?.total || 0),
            unseen: Number(summary?.unseen || 0),
            by_severity: {
              critical: Number(summary?.by_severity?.critical || 0),
              high: Number(summary?.by_severity?.high || 0),
              medium: Number(summary?.by_severity?.medium || 0),
              low: Number(summary?.by_severity?.low || 0),
            },
          },
          symbolStats: {
            symbols: Array.isArray(symbolStats?.symbols) ? symbolStats.symbols : [],
            total_alerts_in_scope: Number(symbolStats?.total_alerts_in_scope || 0),
            pagination: {
              page: Number(symbolStats?.pagination?.page || 1),
              page_size: Number(symbolStats?.pagination?.page_size || 200),
              total_pages: Number(symbolStats?.pagination?.total_pages || 1),
              total_symbols: Number(symbolStats?.pagination?.total_symbols || 0),
            },
          },
        });
      } catch (error) {
        if (!mountedRef.current) {
          return;
        }

        setState({
          loading: false,
          error: error?.message || "Không thể tải alert center từ core API.",
          payload: { results: [], next: null, previous: null },
          summary: { total: 0, unseen: 0, by_severity: { critical: 0, high: 0, medium: 0, low: 0 } },
          symbolStats: { symbols: [], total_alerts_in_scope: 0, pagination: { page: 1, page_size: 200, total_pages: 1, total_symbols: 0 } },
        });
      }
    }

    load();
    return () => {
      mountedRef.current = false;
    };
  }, [env, lane, symbol, sessionDate, timeframe, refreshToken]);

  return state;
}
