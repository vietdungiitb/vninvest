/**
 * useCoreDashboardData — DM-02
 *
 * Trung tâm fetch dữ liệu cho DashboardPage.
 * Phase 1: Song song lấy holdings, summary, analytics, watchlists,
 *          trackedSymbols, watchlistGroups.
 * Phase 2: Sau khi holdings resolve, lấy bulk technicals.
 *
 * Không dùng JSX. Tuân theo convention packages/web.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { coreApiAdapter } from "../../adapters/coreApiAdapter.js";

const EMPTY_ARRAY = [];

function safeResults(res) {
  if (!res) return EMPTY_ARRAY;
  if (Array.isArray(res)) return res;
  if (Array.isArray(res.results)) return res.results;
  return EMPTY_ARRAY;
}

/**
 * @param {{ portfolioId: string|number|null, enabled?: boolean }} options
 * @returns {{
 *   loading: boolean,
 *   error: string|null,
 *   holdings: object[],
 *   summary: object|null,
 *   analytics: object|null,
 *   technicals: object[],
 *   trackedSymbols: object[],
 *   watchlistGroups: object[],
 *   watchlists: object[],
 *   refresh: () => void,
 * }}
 */
export function useCoreDashboardData({ portfolioId, enabled = true } = {}) {
  const [state, setState] = useState({
    loading: false,
    error: null,
    holdings: EMPTY_ARRAY,
    summary: null,
    analytics: null,
    technicals: EMPTY_ARRAY,
    trackedSymbols: EMPTY_ARRAY,
    watchlistGroups: EMPTY_ARRAY,
    watchlists: EMPTY_ARRAY,
  });

  const [refreshToken, setRefreshToken] = useState(0);
  const abortRef = useRef(null);

  const refresh = useCallback(() => setRefreshToken((n) => n + 1), []);

  useEffect(() => {
    if (!enabled || !portfolioId) {
      setState((s) => ({ ...s, loading: false, error: null }));
      return;
    }

    // Cancel any in-flight request
    if (abortRef.current) {
      abortRef.current.abort();
    }
    const controller = new AbortController();
    abortRef.current = controller;

    let cancelled = false;

    async function load() {
      setState((s) => ({ ...s, loading: true, error: null }));

      try {
        // Phase 1 — parallel fetches
        const [
          holdingsRes,
          summaryRes,
          analyticsRes,
          watchlistsRes,
          trackedRes,
          groupsRes,
        ] = await Promise.all([
          coreApiAdapter.getPortfolioHoldings(portfolioId),
          coreApiAdapter.getPortfolioSummary(portfolioId),
          coreApiAdapter.getPortfolioAnalytics(portfolioId, 30),
          coreApiAdapter.getWatchlists(),
          coreApiAdapter.getTrackedSymbols(),
          coreApiAdapter.getLegacyWatchlistGroups(),
        ]);

        if (cancelled) return;

        const holdings = safeResults(holdingsRes);

        // Phase 2 — bulk technicals once holdings are known
        const symbols = holdings
          .map((h) => String(h?.symbol || "").toUpperCase())
          .filter(Boolean);

        let technicals = EMPTY_ARRAY;
        if (symbols.length > 0) {
          const techRes = await coreApiAdapter.getBulkTechnicalsBySymbols(symbols);
          if (!cancelled) {
            technicals = Array.isArray(techRes) ? techRes : safeResults(techRes);
          }
        }

        if (cancelled) return;

        setState({
          loading: false,
          error: null,
          holdings,
          summary: summaryRes ?? null,
          analytics: analyticsRes ?? null,
          technicals,
          watchlists: safeResults(watchlistsRes),
          trackedSymbols: safeResults(trackedRes),
          watchlistGroups: safeResults(groupsRes),
        });
      } catch (err) {
        if (cancelled) return;
        if (err?.name === "AbortError") return;
        setState((s) => ({
          ...s,
          loading: false,
          error: err?.message || "Không thể tải dữ liệu tổng quan.",
        }));
      }
    }

    load();

    return () => {
      cancelled = true;
      controller.abort();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [portfolioId, enabled, refreshToken]);

  return { ...state, refresh };
}
