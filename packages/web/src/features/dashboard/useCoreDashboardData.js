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
import { SYSTEM_GROUP_IDS } from "../../constants/marketGroups";

const EMPTY_ARRAY = [];

function normalizeSymbol(value) {
  const normalized = String(value || "").trim().toUpperCase();
  return normalized || null;
}

function safeResults(res) {
  if (!res) return EMPTY_ARRAY;
  if (Array.isArray(res)) return res;
  if (Array.isArray(res.results)) return res.results;
  return EMPTY_ARRAY;
}

function extractTechnicalsResponse(res) {
  if (!res) return EMPTY_ARRAY;
  if (Array.isArray(res)) return res;
  if (Array.isArray(res.technicals)) return res.technicals;
  if (Array.isArray(res.results)) return res.results;
  return EMPTY_ARRAY;
}

function collectDashboardSymbols({ holdings, trackedSymbols, watchlists, watchlistGroups }) {
  const symbolSet = new Set();
  const addSymbol = (value) => {
    const symbol = normalizeSymbol(value);
    if (symbol) {
      symbolSet.add(symbol);
    }
  };

  holdings.forEach((item) => addSymbol(item?.symbol));
  trackedSymbols.forEach((item) => addSymbol(item?.symbol));
  watchlists.forEach((watchlist) => {
    addSymbol(watchlist?.symbol);
    (Array.isArray(watchlist?.items) ? watchlist.items : EMPTY_ARRAY).forEach((item) => addSymbol(item?.symbol));
  });
  watchlistGroups.forEach((group) => {
    (Array.isArray(group?.items) ? group.items : EMPTY_ARRAY).forEach((item) => addSymbol(item?.symbol));
  });

  return Array.from(symbolSet);
}

const wrapWithErrorCode = (promise, errorCode) => {
  return promise.catch((err) => {
    err.errorCode = errorCode;
    throw err;
  });
};

/**
 * @param {{ portfolioId: string|number|null, enabled?: boolean }} options
 * @returns {{
 *   loading: boolean,
 *   error: string|null,
 *   errorCode: string|null,
 *   holdings: object[],
 *   summary: object|null,
 *   analytics: object|null,
 *   technicals: object[],
 *   technicalsStatus: { status: string, errorCode: string|null },
 *   trackedSymbols: object[],
 *   watchlistGroups: object[],
 *   watchlists: object[],
 *   hasHydrated: boolean,
 *   refresh: () => void,
 * }}
 */
export function useCoreDashboardData({ portfolioId, enabled = true } = {}) {
  const [state, setState] = useState({
    loading: false,
    error: null,
    errorCode: null,
    holdings: EMPTY_ARRAY,
    summary: null,
    analytics: null,
    technicals: EMPTY_ARRAY,
    technicalsStatus: { status: 'idle', errorCode: null },
    trackedSymbols: EMPTY_ARRAY,
    watchlistGroups: EMPTY_ARRAY,
    watchlists: EMPTY_ARRAY,
  });

  const [hasHydrated, setHasHydrated] = useState(false);
  const [refreshToken, setRefreshToken] = useState(0);
  const abortRef = useRef(null);

  const refresh = useCallback(() => setRefreshToken((n) => n + 1), []);

  useEffect(() => {
    if (!enabled || !portfolioId) {
      setState((s) => ({ ...s, loading: false, error: null, errorCode: null }));
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
      setState((s) => ({ ...s, loading: true, error: null, errorCode: null }));

      try {
        // Phase 1 — parallel fetches wrapped with standard error codes
        const [
          holdingsRes,
          summaryRes,
          analyticsRes,
          watchlistsRes,
          trackedRes,
          groupsRes,
        ] = await Promise.all([
          wrapWithErrorCode(coreApiAdapter.getPortfolioHoldings(portfolioId), '[ERR_CORE_PORTFOLIO_HOLDINGS_02]'),
          wrapWithErrorCode(coreApiAdapter.getPortfolioSummary(portfolioId), '[ERR_CORE_PORTFOLIO_SUMMARY_01]'),
          coreApiAdapter.getPortfolioAnalytics(portfolioId, 30),
          coreApiAdapter.getWatchlists(),
          coreApiAdapter.getTrackedSymbols(),
          coreApiAdapter.getLegacyWatchlistGroups(),
        ]);

        if (cancelled) return;

        const holdings = safeResults(holdingsRes);
        const rawWatchlists = safeResults(watchlistsRes);
        const trackedSymbols = safeResults(trackedRes);
        const rawWatchlistGroups = safeResults(groupsRes);

        const watchlists = rawWatchlists.filter(wl => {
          const slug = String(wl?.id || wl?.name || "").toLowerCase().replace(/\s+/g, "-");
          return !SYSTEM_GROUP_IDS.includes(slug);
        });

        // Keep ALL watchlistGroups (market groups) unfiltered
        // so the heatmap can include symbols from all sectors/groups the user follows
        const watchlistGroups = rawWatchlistGroups;

        // Phase 2 — bulk technicals once the monitored symbol universe is known
        const symbols = collectDashboardSymbols({
          holdings,
          trackedSymbols,
          watchlists,
          watchlistGroups: [],
        });

        let technicals = EMPTY_ARRAY;
        let technicalsStatus = { status: 'idle', errorCode: null };

        if (symbols.length > 0) {
          try {
            const techRes = await coreApiAdapter.getBulkTechnicalsBySymbols(symbols);
            if (!cancelled) {
              technicals = extractTechnicalsResponse(techRes);
              technicalsStatus = { status: 'success', errorCode: null };
            }
          } catch (techErr) {
            if (!cancelled) {
              technicals = EMPTY_ARRAY;
              technicalsStatus = {
                status: 'failed',
                errorCode: '[ERR_CORE_BULK_TECHNICAL_03]',
              };
            }
          }
        }

        if (cancelled) return;

        setState({
          loading: false,
          error: null,
          errorCode: null,
          holdings,
          summary: summaryRes ?? null,
          analytics: analyticsRes ?? null,
          technicals,
          technicalsStatus,
          watchlists,
          trackedSymbols,
          watchlistGroups,
        });
        setHasHydrated(true);
      } catch (err) {
        if (cancelled) return;
        if (err?.name === "AbortError") return;
        setHasHydrated(true);
        setState((s) => ({
          ...s,
          loading: false,
          error: err?.message || "Không thể tải dữ liệu tổng quan.",
          errorCode: err?.errorCode || null,
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

  return { ...state, hasHydrated, refresh };
}
