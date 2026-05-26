import React, { Suspense, lazy, useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { usePortfolio } from '../../context/PortfolioContext';
import { getSummary, getHoldings, getAnalytics, getPortfolioTechnicals, getPortfolioNewsDigest, getTrackedSymbols, getWatchlistGroups, getBulkTechnicalsBySymbols } from '../../api/client';
import { useI18n } from '../../context/LangContext';
import useRealtimeFeed from '../../hooks/useRealtimeFeed';
import { buildLiveHoldingsOverlay } from '../../utils/dashboardRealtimeSelectors';
import { buildModernDashboardSymbolUniverse } from '../../utils/modernDashboardSymbolUniverse';

import SmartStatsHeader from '../../components/modern/SmartStatsHeader';
import FactsFirstModularPositionDeck from '../../components/modern/FactsFirstModularPositionDeck';
import PortfolioHeatmap from '../../components/PortfolioHeatmap';
import UnifiedAlertCenter from '../../components/UnifiedAlertCenter';
import useAlertCenterFeed from '../../hooks/useAlertCenterFeed';
import usePersistentAlertState from '../../hooks/usePersistentAlertState';

const AIAdvisorAlertPanel = lazy(() => import('../../components/modern/AIAdvisorAlertPanel'));

function normalizeSymbol(value) {
  return String(value || '').trim().toUpperCase();
}

function SidebarPanelFallback({ minHeightClass = 'min-h-[220px]', label = 'Đang tải bảng phụ...' }) {
  return (
    <div className={`rounded-2xl border border-slate-800/50 bg-slate-900/40 ${minHeightClass} flex items-center justify-center px-4 text-xs font-medium text-slate-500`}>
      {label}
    </div>
  );
}

export default function ModernDashboard() {
  const { activePortfolioId, isAuthenticated } = usePortfolio();
  const { t } = useI18n();
  const fetchRequestTokenRef = useRef(0);
  const deferredAuxTimerRef = useRef(0);
  const deferredAuxIdleRef = useRef(0);
  const digestFetchInFlightRef = useRef(false);

  const [summary, setSummary] = useState(null);
  const [holdings, setHoldings] = useState([]);
  const [trackedSymbols, setTrackedSymbols] = useState([]);
  const [watchlistGroups, setWatchlistGroups] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [technicals, setTechnicals] = useState(null);
  const [digest, setDigest] = useState(null);
  const [loading, setLoading] = useState(false);
  const [sourceFilter, setSourceFilter] = useState('all');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [audienceFilter, setAudienceFilter] = useState('all');
  const [unifiedPageSize, setUnifiedPageSize] = useState(5);

  const baseSymbolUniverse = useMemo(
    () => buildModernDashboardSymbolUniverse({ holdings, trackedSymbols, watchlistGroups }),
    [holdings, trackedSymbols, watchlistGroups],
  );

  const monitoredSymbols = useMemo(
    () => baseSymbolUniverse.map((item) => item.symbol).filter(Boolean),
    [baseSymbolUniverse],
  );

  const {
    quotesBySymbol,
    alerts,
    lastEventAt,
    darkFlowAlerts,
    realtimeStatus
  } = useRealtimeFeed({ symbols: monitoredSymbols, maxAlerts: 20 });

  const {
    readAlertIds,
    criticalSoundEnabled,
    markAlertAsRead,
    isMutedSymbol,
    muteSymbolFor30m,
    toggleCriticalSound,
  } = usePersistentAlertState();

  const liveHoldings = buildLiveHoldingsOverlay(holdings, quotesBySymbol);

  const trackedSymbolNames = useMemo(
    () => trackedSymbols.map((item) => normalizeSymbol(item.symbol)).filter(Boolean),
    [trackedSymbols],
  );

  const symbolUniverse = useMemo(
    () => buildModernDashboardSymbolUniverse({
      holdings: liveHoldings,
      trackedSymbols,
      watchlistGroups,
      quotesBySymbol,
    }),
    [liveHoldings, trackedSymbols, watchlistGroups, quotesBySymbol],
  );

  const heatmapData = useMemo(() => {
    if (!monitoredSymbols.length) return [];

    const holdingsMap = new Map(liveHoldings.map((h) => [normalizeSymbol(h.symbol), h]));
    const trackedMap = new Map(trackedSymbols.map((t) => [normalizeSymbol(t.symbol), t]));

    const totalHeldValue = liveHoldings.reduce(
      (sum, h) => sum + Number(h.live_market_value || h.market_value || 0),
      0,
    );
    const avgPositionSize = liveHoldings.length > 0 ? totalHeldValue / liveHoldings.length : 10000;
    const nominalSize = Math.max(avgPositionSize * 0.4, 2000);

    const buildFallbackSparkline = (quote, held, tracked) => {
      const current = Number(quote?.current_price || held?.live_current_price || held?.current_price || tracked?.current_price || 0);
      const prev = Number(quote?.prev_price || held?.prev_close || tracked?.prev_price || current || 0);
      if (!(current > 0) || !(prev > 0)) return [];
      const delta = current - prev;
      const base = prev;
      return [base, base + delta * 0.12, base + delta * 0.28, base + delta * 0.22,
              base + delta * 0.41, base + delta * 0.58, base + delta * 0.76, current]
        .map((v) => Number(v.toFixed(2)));
    };

    return monitoredSymbols.map((symbol) => {
      const held = holdingsMap.get(symbol);
      const quote = quotesBySymbol[symbol] || {};
      const trackedInfo = trackedMap.get(symbol);
      // Fallback chain: WS quote → live holding → tracked API response → 0
      const changePct = quote.change_pct ?? held?.live_change_pct ?? trackedInfo?.change_pct ?? 0;
      const sparkline24 = buildFallbackSparkline(quote, held, trackedInfo);
      const industry = String(held?.industry || trackedInfo?.industry || 'Khác').trim() || 'Khác';

      if (held) {
        return {
          ...held,
          symbol,
          industry,
          company_name: held.company_name || held.name || symbol,
          market_cap_bn: held.market_cap_bn ?? trackedInfo?.market_cap_bn ?? null,
          live_current_price: Number(quote.current_price || held.live_current_price || held.current_price || trackedInfo?.current_price || 0),
          live_market_cap: Number(quote.market_cap || held.live_market_cap || held.market_cap || 0),
          live_volume: Number(quote.volume || held.live_volume || held.volume || 0),
          live_market_value: Number(held.live_market_value || held.market_value || 0),
          live_change_pct: changePct,
          sparkline24,
          is_holding: true,
        };
      }
      return {
        symbol,
        industry,
        company_name: trackedInfo?.name || trackedInfo?.company_name || symbol,
        market_cap_bn: trackedInfo?.market_cap_bn ?? null,
        live_current_price: Number(quote.current_price || trackedInfo?.current_price || 0),
        live_market_cap: Number(quote.market_cap || 0),
        live_volume: Number(quote.volume || 0),
        live_market_value: Number(quote.market_cap || 0) || nominalSize,
        live_change_pct: changePct,
        sparkline24,
        is_holding: false,
      };
    });
  }, [liveHoldings, monitoredSymbols, quotesBySymbol, trackedSymbols]);

  const realtimeMarketBreadth = useMemo(() => {
    return monitoredSymbols.reduce((acc, symbol) => {
      const quote = quotesBySymbol[symbol];
      if (!quote) return acc;
      const cp = quote.change_pct ?? 0;
      if (cp > 0) acc.up++;
      else if (cp < 0) acc.down++;
      else acc.flat++;
      return acc;
    }, { up: 0, down: 0, flat: 0 });
  }, [monitoredSymbols, quotesBySymbol]);

  const {
    filteredUnifiedAlerts,
    alertSummary,
    currentUnifiedPage,
    hasPreviousUnifiedPage,
    backendUnifiedHasMore,
    loadingMoreUnified,
    goToFirstUnifiedPage,
    goToPreviousUnifiedPage,
    goToNextUnifiedPage,
    goToLastUnifiedPage,
    hasLastUnifiedPage,
  } = useAlertCenterFeed({
    alerts,
    darkFlowAlerts,
    monitoredSymbols,
    quotesBySymbol,
    holdings,
    trackedSymbolNames,
    enableSnapshot: isAuthenticated,
    lastEventAt,
    sourceFilter,
    severityFilter,
    audienceFilter,
    pageSize: unifiedPageSize,
    isMutedSymbol,
    formatNumber: (value) => Number(value || 0).toLocaleString('vi-VN'),
    t,
  });

  const unreadUnifiedCount = useMemo(
    () => filteredUnifiedAlerts.filter((item) => !readAlertIds.has(item.id)).length,
    [filteredUnifiedAlerts, readAlertIds],
  );

  const toggleSeverityFilterFromSummary = useCallback((targetFilter) => {
    setSeverityFilter((prev) => (prev === targetFilter ? 'all' : targetFilter));
  }, []);

  const clearDeferredAuxFetch = useCallback(() => {
    if (deferredAuxTimerRef.current) {
      window.clearTimeout(deferredAuxTimerRef.current);
      deferredAuxTimerRef.current = 0;
    }
    if (deferredAuxIdleRef.current && typeof window.cancelIdleCallback === 'function') {
      window.cancelIdleCallback(deferredAuxIdleRef.current);
      deferredAuxIdleRef.current = 0;
    }
  }, []);

  const requestPortfolioDigest = useCallback(async () => {
    const requestToken = fetchRequestTokenRef.current;
    if (!isAuthenticated) return;
    if (digest !== null || digestFetchInFlightRef.current) return;

    digestFetchInFlightRef.current = true;
    try {
      const digestResp = await getPortfolioNewsDigest();
      if (fetchRequestTokenRef.current !== requestToken) {
        return;
      }
      setDigest(digestResp.data);
    } catch (error) {
      console.warn('Portfolio news digest deferred fetch failed:', error);
      if (fetchRequestTokenRef.current !== requestToken) {
        return;
      }
      setDigest(null);
    } finally {
      digestFetchInFlightRef.current = false;
    }
  }, [activePortfolioId, digest, isAuthenticated]);

  const loadAuxiliaryDashboardData = useCallback(async ({
    portfolioId,
    nextHoldings,
    nextTracked,
    nextWatchlistGroups,
    requestToken,
  }) => {
    const symbolSet = new Set();
    nextHoldings.forEach((item) => {
      const symbol = normalizeSymbol(item?.symbol);
      if (symbol) symbolSet.add(symbol);
    });
    nextTracked.forEach((item) => {
      const symbol = normalizeSymbol(item?.symbol);
      if (symbol) symbolSet.add(symbol);
    });
    nextWatchlistGroups.forEach((group) => {
      (group?.items || []).forEach((item) => {
        const symbol = normalizeSymbol(item?.symbol);
        if (symbol) symbolSet.add(symbol);
      });
    });

    const bulkSymbols = Array.from(symbolSet);

    const analyticsResult = portfolioId
      ? await Promise.allSettled([getAnalytics(portfolioId)])
      : [{ status: 'fulfilled', value: { data: null } }];

    if (fetchRequestTokenRef.current !== requestToken) {
      return;
    }

    if (analyticsResult[0].status === 'fulfilled') {
      setAnalytics(analyticsResult[0].value.data);
    }

    if (!bulkSymbols.length) {
      setTechnicals([]);
      return;
    }

    try {
      const bulkResp = await getBulkTechnicalsBySymbols(bulkSymbols);
      if (fetchRequestTokenRef.current !== requestToken) {
        return;
      }
      setTechnicals(bulkResp.data?.technicals || []);
    } catch (bulkErr) {
      console.warn('Bulk technicals fallback to portfolio endpoint:', bulkErr);
      if (!portfolioId) {
        if (fetchRequestTokenRef.current !== requestToken) {
          return;
        }
        setTechnicals([]);
        return;
      }
      try {
        const fallbackResp = await getPortfolioTechnicals(portfolioId);
        if (fetchRequestTokenRef.current !== requestToken) {
          return;
        }
        setTechnicals(fallbackResp.data?.technicals || []);
      } catch (fallbackErr) {
        console.warn('Portfolio technicals fallback failed:', fallbackErr);
        if (fetchRequestTokenRef.current !== requestToken) {
          return;
        }
        setTechnicals([]);
      }
    }
  }, []);

  const fetchData = useCallback(async () => {
    if (!isAuthenticated) return;
    const requestToken = fetchRequestTokenRef.current + 1;
    fetchRequestTokenRef.current = requestToken;
    clearDeferredAuxFetch();
    setLoading(true);
    setAnalytics(null);
    setDigest(null);
    setTechnicals(null);
    digestFetchInFlightRef.current = false;

    try {
      const summaryRequest = activePortfolioId
        ? getSummary(activePortfolioId)
        : Promise.resolve({ data: null });
      const holdingsRequest = activePortfolioId
        ? getHoldings(activePortfolioId)
        : Promise.resolve({ data: [] });
      const results = await Promise.allSettled([
        summaryRequest,
        holdingsRequest,
        getTrackedSymbols(),
        getWatchlistGroups(),
      ]);

      if (fetchRequestTokenRef.current !== requestToken) {
        return;
      }

      if (results[0].status === 'fulfilled') setSummary(results[0].value.data);
      if (results[1].status === 'fulfilled') setHoldings(Array.isArray(results[1].value.data) ? results[1].value.data : (results[1].value.data?.results ?? []));
      if (results[2].status === 'fulfilled') setTrackedSymbols(Array.isArray(results[2].value.data) ? results[2].value.data : []);
      if (results[3].status === 'fulfilled') setWatchlistGroups(Array.isArray(results[3].value.data) ? results[3].value.data : []);

      const toArr = (d) => (Array.isArray(d) ? d : (d?.results ?? []));
      const nextHoldings = results[1].status === 'fulfilled' ? toArr(results[1].value.data) : [];
      const nextTracked = results[2].status === 'fulfilled' ? toArr(results[2].value.data) : [];
      const nextWatchlistGroups = results[3].status === 'fulfilled' ? toArr(results[3].value.data) : [];

      const scheduleAuxFetch = () => {
        loadAuxiliaryDashboardData({
          portfolioId: activePortfolioId,
          nextHoldings,
          nextTracked,
          nextWatchlistGroups,
          requestToken,
        });
      };

      deferredAuxTimerRef.current = window.setTimeout(() => {
        if (typeof window.requestIdleCallback === 'function') {
          deferredAuxIdleRef.current = window.requestIdleCallback(() => {
            deferredAuxIdleRef.current = 0;
            scheduleAuxFetch();
          }, { timeout: 900 });
          return;
        }
        scheduleAuxFetch();
      }, 120);
    } catch (err) {
      console.error('ModernDashboard data fetch error:', err);
    } finally {
      if (fetchRequestTokenRef.current === requestToken) {
        setLoading(false);
      }
    }
  }, [isAuthenticated, activePortfolioId, clearDeferredAuxFetch, loadAuxiliaryDashboardData]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => () => {
    clearDeferredAuxFetch();
  }, [clearDeferredAuxFetch]);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-slate-950 text-slate-200">
      {/* 1. Global High-Density Header */}
      <SmartStatsHeader
        summary={summary}
        loading={loading}
        realtimeBreadth={realtimeMarketBreadth}
        analytics={analytics}
        onRefresh={fetchData}
      />

      {/* 2. Main Workspace Layout */}
      <div className="relative flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-6 py-4">
        <div className="mx-auto w-full max-w-[1800px]">
          <div className="space-y-6">
            <div className="dashboard-triad-grid min-h-full items-start">
              <div className="dashboard-triad-lane dashboard-triad-lane--side core-dashboard-slot core-dashboard-slot--alert-lane h-[526px] min-w-0 overflow-hidden">
                <UnifiedAlertCenter
                  alerts={filteredUnifiedAlerts}
                  alertSummary={alertSummary}
                  readAlertIds={readAlertIds}
                  markAlertAsRead={markAlertAsRead}
                  muteSymbolFor30m={muteSymbolFor30m}
                  severityFilter={severityFilter}
                  setSeverityFilter={setSeverityFilter}
                  onSeverityFilterChange={toggleSeverityFilterFromSummary}
                  criticalSoundEnabled={criticalSoundEnabled}
                  toggleCriticalSound={toggleCriticalSound}
                  currentUnifiedPage={currentUnifiedPage}
                  hasPreviousUnifiedPage={hasPreviousUnifiedPage}
                  backendUnifiedHasMore={backendUnifiedHasMore}
                  loadingMoreUnified={loadingMoreUnified}
                  goToFirstUnifiedPage={goToFirstUnifiedPage}
                  goToPreviousUnifiedPage={goToPreviousUnifiedPage}
                  goToNextUnifiedPage={goToNextUnifiedPage}
                  goToLastUnifiedPage={goToLastUnifiedPage}
                  hasLastUnifiedPage={hasLastUnifiedPage}
                  pageSize={unifiedPageSize}
                  setPageSize={setUnifiedPageSize}
                  sourceFilter={sourceFilter}
                  setSourceFilter={setSourceFilter}
                  audienceFilter={audienceFilter}
                  setAudienceFilter={setAudienceFilter}
                  unreadCount={unreadUnifiedCount}
                  showSummaryChips={true}
                  minHeightClass="h-full"
                  className="h-full overflow-hidden"
                />
              </div>

              <div className="dashboard-triad-lane dashboard-triad-lane--center core-dashboard-slot core-dashboard-slot--heatmap h-[526px] min-w-0 bg-slate-900/30 border border-slate-800/50 rounded-xl overflow-hidden p-1">
                <PortfolioHeatmap
                  holdings={heatmapData}
                  title="Theo dõi Dòng tiền"
                  compact={true}
                />
              </div>

              <div className="dashboard-triad-lane dashboard-triad-lane--side core-dashboard-slot core-dashboard-slot--ai h-[526px] min-w-0 overflow-hidden">
                <Suspense fallback={<SidebarPanelFallback minHeightClass="min-h-[420px]" label="Đang tải bảng AI phụ trợ..." />}>
                  <AIAdvisorAlertPanel
                    holdings={holdings}
                    watchlist={trackedSymbols}
                    technicals={technicals}
                    alerts={alerts}
                    newsDigest={digest}
                    onRequestDigest={requestPortfolioDigest}
                    criticalSoundEnabled={criticalSoundEnabled}
                    expandedClassName="h-full"
                  />
                </Suspense>
              </div>
            </div>

            <div className="dashboard-full-width-deck min-h-[420px] min-w-0 overflow-hidden">
              <FactsFirstModularPositionDeck
                holdings={heatmapData.filter((h) => h.is_holding)}
                symbolUniverse={symbolUniverse}
                loading={loading}
                quotesBySymbol={quotesBySymbol}
                technicals={technicals}
                alerts={alerts}
                analytics={analytics}
                digest={digest}
                onRequestDigest={requestPortfolioDigest}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
