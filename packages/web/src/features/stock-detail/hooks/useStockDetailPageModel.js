import { useCallback, useEffect, useRef, useState } from "react";
import { createCoreApiAdapter } from "../../../adapters/coreApiAdapter.js";
import { buildEffectiveOrderFlowData, normalizeWhaleFeedItem } from "../orderFlowFallback.js";
import { useRealtimeFeedFromManager } from "../../../context/RealtimeContext.js";

const DEFAULT_ENV = {};
const DEFAULT_ORDER_FLOW_WINDOW = "1h";

function getLookbackDays(timeframe) {
  const tf = String(timeframe || "").toLowerCase();
  if (tf.includes("m")) {
    return 30;
  }
  if (tf.includes("h")) {
    return 180;
  }
  return 730;
}

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
  const [activeTimeframe, setActiveTimeframe] = useState("1D");
  const [activePeriod, setActivePeriod] = useState("1M");
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
    advisoryFallbackFlags: null,
    whaleFeed: [],
    whaleFeedMeta: { next_cursor: null, has_more: false },
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
      setNews(null);
      setFinancials(null);
      setActiveTab("giao-dich");
      setModelState((s) => ({
        ...s,
        profile: null,
        snapshot: null,
        chartBars: [],
      }));
    }
  }, [initialSymbol]);

  // 1. Blocking Lane: Symbol metadata, quote snapshot, order flow summary.
  // Exposed as `loadBlocking` useCallback for ErrorBoundary retry (S1).
  const loadBlocking = useCallback(async () => {
    if (!symbol) return;

    const adapter = createCoreApiAdapter({ env, getToken: env.getToken });

    try {
      const [overviewRes, orderFlowRes, sessionFactsCvdRes, whaleSnapshotRes] = await Promise.allSettled([
        adapter.getStockOverview(symbol),
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
        snapshot: overviewRes.status === "fulfilled" ? overviewRes.value : null,
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
  }, [env, symbol]);

  // Trigger the blocking lane on symbol/timeframe change.
  useEffect(() => {
    if (!symbol) return;

    setModelState((s) => ({
      ...s,
      loadingBlocking: true,
      error: null,
    }));

    loadBlocking();
  }, [env, symbol, activeTimeframe, loadBlocking]);

  // 2. Deferred Lane: AI Advisory and Whale Feed matching the currently selected session date.
  // Dependencies: symbol, selectedSession. T1.2: session_date passed, limit 50, normalize items (T1.4).
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
        const params = { limit: 50 };
        if (sessionDate) params.session_date = sessionDate;
        // T1.1: song song whale feed + advisory latest khi mount (advisory 404 → null giữ nguyên)
        const [whaleFeedRes, advisoryRes] = await Promise.all([
          adapter.getWhaleFeedAggregate(symbol, params).catch(() => null),
          adapter.getAdvisoryLatest(symbol).catch(() => null),
        ]);

        if (!mountedRef.current) return;

        const rawResults = whaleFeedRes?.results ?? [];
        const normalized = Array.isArray(rawResults) ? rawResults.map(normalizeWhaleFeedItem) : [];

        setModelState((s) => ({
          ...s,
          loadingDeferred: false,
          advisory: advisoryRes || null,
          whaleFeed: normalized,
          whaleFeedMeta: {
            next_cursor: whaleFeedRes?.next_cursor ?? null,
            has_more: Boolean(whaleFeedRes?.has_more),
          },
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

  // T1.4 F-08: pagination — load more whale feed with cursor
  const loadMoreWhaleFeed = useCallback(async () => {
    const cursor = modelState.whaleFeedMeta?.next_cursor;
    if (!symbol || !cursor) return;
    const adapter = createCoreApiAdapter({ env, getToken: env.getToken });
    const sessionDate = selectedSession?.tradeDate ?? undefined;
    const params = { limit: 50, cursor };
    if (sessionDate) params.session_date = sessionDate;
    try {
      const res = await adapter.getWhaleFeedAggregate(symbol, params);
      if (!mountedRef.current) return;
      const rawResults = res?.results ?? [];
      const normalized = Array.isArray(rawResults) ? rawResults.map(normalizeWhaleFeedItem) : [];
      setModelState((s) => ({
        ...s,
        whaleFeed: [...(s.whaleFeed || []), ...normalized],
        whaleFeedMeta: {
          next_cursor: res?.next_cursor ?? null,
          has_more: Boolean(res?.has_more),
        },
      }));
    } catch {
      // keep current feed on error
    }
  }, [env, symbol, selectedSession, modelState.whaleFeedMeta?.next_cursor]);

  const [activeTab, setActiveTab] = useState("giao-dich");
  const [news, setNews] = useState(null);
  const [financials, setFinancials] = useState(null);
  const [loadingNews, setLoadingNews] = useState(false);
  const [loadingFinancials, setLoadingFinancials] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(false);

  // 3. Lazy loading lanes: fetch profile, news, financials based on activeTab
  useEffect(() => {
    if (!symbol) return;
    const adapter = createCoreApiAdapter({ env, getToken: env.getToken });

    // Fetch profile for Hồ sơ / Cổ đông / Vốn & Cổ tức / Lịch sử sự kiện tabs
    if (
      (activeTab === "ho-so" ||
        activeTab === "co-dong" ||
        activeTab === "von-co-tuc" ||
        activeTab === "su-kien") &&
      !modelState.profile &&
      !loadingProfile
    ) {
      setLoadingProfile(true);
      adapter
        .getStockProfile(symbol)
        .then((data) => {
          if (mountedRef.current) {
            setModelState((s) => ({ ...s, profile: data }));
          }
        })
        .catch(() => {})
        .finally(() => {
          if (mountedRef.current) setLoadingProfile(false);
        });
    }

    // Fetch news for Tin tức tab
    if (activeTab === "tin-tuc" && !news && !loadingNews) {
      setLoadingNews(true);
      adapter
        .getStockNews(symbol)
        .then((data) => {
          if (mountedRef.current) {
            setNews(data?.news ?? data?.results ?? data ?? []);
          }
        })
        .catch(() => {})
        .finally(() => {
          if (mountedRef.current) setLoadingNews(false);
        });
    }

    // Fetch financials for Tài chính / Thống kê / Vốn & Cổ tức tabs
    if (
      (activeTab === "tai-chinh" || activeTab === "thong-ke" || activeTab === "von-co-tuc") &&
      !financials &&
      !loadingFinancials
    ) {
      setLoadingFinancials(true);
      adapter
        .getStockFinancials(symbol)
        .then((data) => {
          if (mountedRef.current) {
            setFinancials(data?.financials ?? data ?? null);
          }
        })
        .catch(() => {})
        .finally(() => {
          if (mountedRef.current) setLoadingFinancials(false);
        });
    }
  }, [
    env,
    symbol,
    activeTab,
    modelState.profile,
    loadingProfile,
    news,
    loadingNews,
    financials,
    loadingFinancials,
  ]);

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

  // --- Real-time Feed Subscription & Forwarding ---
  const realtimeFeed = useRealtimeFeedFromManager({
    symbols: symbol ? [symbol] : [],
    pollInterval: 5000,
  });

  useEffect(() => {
    if (symbol && realtimeFeed?.quotesBySymbol?.[symbol]) {
      const quote = realtimeFeed.quotesBySymbol[symbol];
      handleRealtimeSnapshot(quote);
    }
  }, [realtimeFeed, realtimeFeed?.quotesBySymbol?.[symbol], symbol, handleRealtimeSnapshot]);
  // ------------------------------------------------

  const refreshAdvisoryData = useCallback(async (promptConfig) => {
    if (!symbol) return;
    const adapter = createCoreApiAdapter({ env, getToken: env.getToken });
    const startTime = Date.now();

    setModelState((s) => ({
      ...s,
      loadingDeferred: true,
      error: null,
    }));

    try {
      // Trigger the refresh request and capture response for fallback flags
      const refreshResponse = await adapter.refreshAdvisory(symbol, promptConfig);
      if (refreshResponse && mountedRef.current) {
        setModelState((s) => ({
          ...s,
          advisoryFallbackFlags: {
            personal_key_failed: refreshResponse.personal_key_failed,
            personal_key_error: refreshResponse.personal_key_error,
            using_system_fallback: refreshResponse.using_system_fallback,
            fallback_quota_remaining: refreshResponse.fallback_quota_remaining,
          },
        }));
      }

      // Now poll for the new advisory
      let attempts = 0;
      const maxAttempts = 15;
      const pollInterval = 2000; // 2 seconds

      const checkAdvisory = async () => {
        try {
          const latest = await adapter.getAdvisoryLatest(symbol);
          if (latest && latest.generated_at) {
            const genTime = new Date(latest.generated_at).getTime();
            if (genTime >= startTime) {
              if (mountedRef.current) {
                setModelState((s) => ({
                  ...s,
                  loadingDeferred: false,
                  advisory: latest,
                }));
              }
              return true;
            }
          }
        } catch (e) {
          // If 404 or other error, just continue polling
        }
        return false;
      };

      const runPolling = () => {
        setTimeout(async () => {
          if (!mountedRef.current) return;
          const success = await checkAdvisory();
          if (success) return;

          attempts++;
          if (attempts < maxAttempts) {
            runPolling();
          } else {
            // Timeout, stop loading and try to load whatever is latest
            if (mountedRef.current) {
              try {
                const latest = await adapter.getAdvisoryLatest(symbol);
                setModelState((s) => ({
                  ...s,
                  loadingDeferred: false,
                  advisory: latest,
                }));
              } catch (err) {
                setModelState((s) => ({
                  ...s,
                  loadingDeferred: false,
                }));
              }
            }
          }
        }, pollInterval);
      };

      // Start polling
      runPolling();

    } catch (err) {
      if (mountedRef.current) {
        setModelState((s) => ({
          ...s,
          loadingDeferred: false,
          error: err?.message || "Không thể yêu cầu làm mới AI Advisory.",
        }));
      }
    }
  }, [env, symbol]);

  const setChartBars = useCallback((bars) => {
    setModelState((s) => ({
      ...s,
      chartBars: bars,
    }));
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
    setChartBars,
    news,
    financials,
    loadingNews,
    loadingFinancials,
    activeTab,
    setActiveTab,
    loadingProfile,
    refreshAdvisoryData,
    loadBlocking,
    loadMoreWhaleFeed,
    ...modelState,
  };
}
