import { useCallback, useEffect, useRef, useState } from "react";
import { createCoreApiAdapter } from "../../../adapters/coreApiAdapter.js";
import { buildEffectiveOrderFlowData } from "../orderFlowFallback.js";

const DEFAULT_ENV = {};
const DEFAULT_ORDER_FLOW_WINDOW = "1h";

function normalizeChartBarsPayload(payload) {
  if (!payload) return [];

  // Native stock-management chart contract returns `points`.
  const candidates = payload.points
    ?? payload.results
    ?? payload.bars
    ?? payload.candles
    ?? payload.data?.points
    ?? payload.data?.results
    ?? payload.data?.bars
    ?? payload.data?.candles
    ?? payload;

  return Array.isArray(candidates) ? candidates : [];
}

/**
 * useStockDetailPageModel
 * Page-level SSOT model hook for the SaaS Native Stock Detail page.
 *
 * Coordinates state for:
 *   - symbol, activeTimeframe, activePeriod, selectedSession, visibleRange
 * Coordinates loading lanes:
 *   - Blocking Lane: profile, snapshot, chartBars, orderFlowData (triggered on symbol/timeframe change)
 *   - Deferred Lane: advisory, whaleFeed (triggered on symbol/session change)
 *
 * Implements a 250ms batch buffer for realtime snapshot updates.
 */
export function useStockDetailPageModel({ env = DEFAULT_ENV, initialSymbol } = {}) {
  const [symbol, setSymbol] = useState(initialSymbol || "");
  const [activeTimeframe, setActiveTimeframe] = useState("1H");
  const [activePeriod, setActivePeriod] = useState("3M");
  const [selectedSession, setSelectedSession] = useState(null);
  const [visibleRange, setVisibleRange] = useState(null);

  // Data lanes state
  const [modelState, setModelState] = useState({
    loadingBlocking: true,
    loadingDeferred: true,
    error: null,
    profile: null,
    snapshot: null,
    chartBars: [],
    orderFlowData: null,
    advisory: null,
    whaleFeed: [],
  });

  const mountedRef = useRef(true);
  const realtimeTimeoutRef = useRef(null);
  const pendingSnapshotRef = useRef(null);

  // Clean-up hooks
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (realtimeTimeoutRef.current) {
        clearTimeout(realtimeTimeoutRef.current);
      }
    };
  }, []);

  // Update symbol state if initialSymbol changes
  useEffect(() => {
    if (initialSymbol) {
      setSymbol(initialSymbol);
      setSelectedSession(null);
      setVisibleRange(null);
    }
  }, [initialSymbol]);

  // 1. Blocking Lane: Symbol metadata, quote snapshot, chart history, order flow summary.
  // Dependencies: symbol, activeTimeframe. (Does NOT re-fetch chart history on selectedSession change!)
  useEffect(() => {
    if (!symbol) return;

    setModelState((s) => ({
      ...s,
      loadingBlocking: true,
      error: null,
    }));

    const adapter = createCoreApiAdapter({ env, getToken: env.getToken });

    async function loadBlocking() {
      try {
        const [profileRes, snapshotRes, chartRes, orderFlowRes, sessionFactsCvdRes, whaleSnapshotRes] = await Promise.allSettled([
          adapter.getStockProfile(symbol),
          adapter.getSymbolSnapshot(symbol),
          adapter.getStockChartHistory(symbol, { timeframe: activeTimeframe, days: 180 }),
          adapter.getStockOrderFlow(symbol, { window: DEFAULT_ORDER_FLOW_WINDOW }),
          adapter.getSessionFactsCvd(symbol, { window: DEFAULT_ORDER_FLOW_WINDOW }),
          adapter.getWhaleAnalyticsSnapshot(symbol, {
            timeframe: DEFAULT_ORDER_FLOW_WINDOW,
            compact: 0,
            includeBaseline: false,
          }),
        ]);

        if (!mountedRef.current) return;

        setModelState((s) => ({
          ...s,
          loadingBlocking: false,
          profile: profileRes.status === "fulfilled" ? profileRes.value : null,
          snapshot: snapshotRes.status === "fulfilled" ? snapshotRes.value : null,
          chartBars:
            chartRes.status === "fulfilled"
              ? normalizeChartBarsPayload(chartRes.value)
              : [],
          orderFlowData: buildEffectiveOrderFlowData({
            orderFlowPayload: orderFlowRes.status === "fulfilled" ? orderFlowRes.value : null,
            sessionFactsCvdPayload: sessionFactsCvdRes.status === "fulfilled" ? sessionFactsCvdRes.value : null,
            whaleSnapshotPayload: whaleSnapshotRes.status === "fulfilled" ? whaleSnapshotRes.value : null,
            symbol,
            fallbackWindow: DEFAULT_ORDER_FLOW_WINDOW,
          }),
        }));
      } catch (err) {
        if (!mountedRef.current) return;
        setModelState((s) => ({
          ...s,
          loadingBlocking: false,
          error: err?.message || "Không thể tải thông tin cốt lõi của cổ phiếu.",
        }));
      }
    }

    loadBlocking();
  }, [env, symbol, activeTimeframe]);

  // 2. Deferred Lane: AI Advisory and Whale Feed matching the currently selected session date.
  // Dependencies: symbol, selectedSession.
  useEffect(() => {
    if (!symbol) return;

    setModelState((s) => ({
      ...s,
      loadingDeferred: true,
    }));

    const adapter = createCoreApiAdapter({ env, getToken: env.getToken });
    const sessionDate = selectedSession?.tradeDate ?? undefined;

    async function loadDeferred() {
      try {
        const [advisoryRes, whaleFeedRes] = await Promise.allSettled([
          adapter.getAdvisoryLatest(symbol, sessionDate),
          adapter.getWhaleFeedAggregate(symbol, sessionDate ? { session_date: sessionDate } : {}),
        ]);

        if (!mountedRef.current) return;

        setModelState((s) => ({
          ...s,
          loadingDeferred: false,
          advisory: advisoryRes.status === "fulfilled" ? advisoryRes.value : null,
          whaleFeed: whaleFeedRes.status === "fulfilled" ? (whaleFeedRes.value?.results ?? []) : [],
        }));
      } catch (err) {
        if (!mountedRef.current) return;
        setModelState((s) => ({
          ...s,
          loadingDeferred: false,
        }));
      }
    }

    loadDeferred();
  }, [env, symbol, selectedSession]);

  const [news, setNews] = useState(null);
  const [financials, setFinancials] = useState(null);
  const [loadingNews, setLoadingNews] = useState(false);
  const [loadingFinancials, setLoadingFinancials] = useState(false);

  // 3. Insight/Stubs Lane: news & financials
  useEffect(() => {
    if (!symbol) return;
    setLoadingNews(true);
    setLoadingFinancials(true);
    const adapter = createCoreApiAdapter({ env, getToken: env.getToken });

    async function loadInsights() {
      try {
        const [newsRes, finRes] = await Promise.allSettled([
          adapter.getStockNews(symbol),
          adapter.getStockFinancials(symbol),
        ]);

        if (!mountedRef.current) return;

        setNews(newsRes.status === "fulfilled" ? (newsRes.value?.results ?? newsRes.value ?? null) : null);
        setFinancials(finRes.status === "fulfilled" ? finRes.value || null : null);
      } catch (e) {
        // Gracefully ignore stub errors to avoid page crash
      } finally {
        if (mountedRef.current) {
          setLoadingNews(false);
          setLoadingFinancials(false);
        }
      }
    }
    loadInsights();
  }, [env, symbol]);

  // 4. 250ms Throttled Realtime Snapshot updates (WebSocket batching)
  const handleRealtimeSnapshot = useCallback((nextSnapshot) => {
    if (!mountedRef.current) return;
    pendingSnapshotRef.current = nextSnapshot;

    if (realtimeTimeoutRef.current) {
      return; // Already scheduled
    }

    realtimeTimeoutRef.current = setTimeout(() => {
      realtimeTimeoutRef.current = null;
      if (!mountedRef.current || !pendingSnapshotRef.current) return;

      setModelState((s) => ({
        ...s,
        snapshot: {
          ...s.snapshot,
          ...pendingSnapshotRef.current,
        },
      }));
      pendingSnapshotRef.current = null;
    }, 250);
  }, []);

  return {
    symbol,
    setSymbol,
    activeTimeframe,
    setActiveTimeframe,
    activePeriod,
    setActivePeriod,
    selectedSession,
    setSelectedSession,
    visibleRange,
    setVisibleRange,
    handleRealtimeSnapshot,
    news,
    financials,
    loadingNews,
    loadingFinancials,
    ...modelState,
  };
}
