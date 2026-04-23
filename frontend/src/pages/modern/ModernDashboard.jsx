import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { usePortfolio } from '../../context/PortfolioContext';
import { getSummary, getHoldings, getAnalytics, getPortfolioTechnicals, getPortfolioNewsDigest, getTrackedSymbols, getWatchlistGroups, getBulkTechnicalsBySymbols } from '../../api/client';
import { useI18n } from '../../context/LangContext';
import useRealtimeFeed from '../../hooks/useRealtimeFeed';
import { buildLiveHoldingsOverlay } from '../../utils/dashboardRealtimeSelectors';
import { buildModernDashboardSymbolUniverse } from '../../utils/modernDashboardSymbolUniverse';

import SmartStatsHeader from '../../components/modern/SmartStatsHeader';
import ModularPositionDeck from '../../components/modern/ModularPositionDeck';
import ModernSidebar from '../../components/modern/ModernSidebar';
import PortfolioHeatmap from '../../components/PortfolioHeatmap';
import UnifiedAlertCenter from '../../components/UnifiedAlertCenter';
import useUnifiedAlerts from '../../hooks/useUnifiedAlerts';
import usePersistentAlertState from '../../hooks/usePersistentAlertState';
import AIAdvisorAlertPanel from '../../components/modern/AIAdvisorAlertPanel';

function normalizeSymbol(value) {
  return String(value || '').trim().toUpperCase();
}

export default function ModernDashboard() {
  const { activePortfolioId, isAuthenticated } = usePortfolio();
  const { t } = useI18n();

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

    const buildFallbackSparkline = (quote, held) => {
      const current = Number(quote?.current_price || held?.live_current_price || held?.current_price || 0);
      const prev = Number(quote?.prev_price || held?.prev_close || current || 0);
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
      const changePct = quote.change_pct ?? held?.live_change_pct ?? 0;
      const sparkline24 = buildFallbackSparkline(quote, held);
      const trackedInfo = trackedMap.get(symbol);
      const industry = String(held?.industry || trackedInfo?.industry || 'Khác').trim() || 'Khác';

      if (held) {
        return {
          ...held,
          symbol,
          industry,
          company_name: held.company_name || held.name || symbol,
          market_cap_bn: held.market_cap_bn ?? trackedInfo?.market_cap_bn ?? null,
          live_current_price: Number(quote.current_price || held.live_current_price || held.current_price || 0),
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
        live_current_price: Number(quote.current_price || 0),
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
  } = useUnifiedAlerts({
    alerts,
    darkFlowAlerts,
    monitoredSymbols,
    quotesBySymbol,
    holdings,
    trackedSymbolNames,
    enableSnapshot: isAuthenticated && Boolean(activePortfolioId),
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

  const fetchData = useCallback(async () => {
    if (!isAuthenticated || !activePortfolioId) return;
    setLoading(true);
    try {
      const results = await Promise.allSettled([
        getSummary(activePortfolioId),
        getHoldings(activePortfolioId),
        getAnalytics(activePortfolioId),
        getPortfolioTechnicals(activePortfolioId),
        getPortfolioNewsDigest(),
        getTrackedSymbols(),
        getWatchlistGroups(),
      ]);

      if (results[0].status === 'fulfilled') setSummary(results[0].value.data);
      if (results[1].status === 'fulfilled') setHoldings(results[1].value.data);
      if (results[2].status === 'fulfilled') setAnalytics(results[2].value.data);
      if (results[4].status === 'fulfilled') setDigest(results[4].value.data);
      if (results[5].status === 'fulfilled') setTrackedSymbols(results[5].value.data || []);
      if (results[6].status === 'fulfilled') setWatchlistGroups(results[6].value.data || []);

      const fallbackTechnicals = results[3].status === 'fulfilled'
        ? (results[3].value.data?.technicals || [])
        : [];

      const nextHoldings = results[1].status === 'fulfilled' ? (results[1].value.data || []) : [];
      const nextTracked = results[5].status === 'fulfilled' ? (results[5].value.data || []) : [];
      const nextWatchlistGroups = results[6].status === 'fulfilled' ? (results[6].value.data || []) : [];

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
      if (!bulkSymbols.length) {
        setTechnicals([]);
      } else {
        try {
          const bulkResp = await getBulkTechnicalsBySymbols(bulkSymbols);
          setTechnicals(bulkResp.data?.technicals || []);
        } catch (bulkErr) {
          console.warn('Bulk technicals fallback to portfolio endpoint:', bulkErr);
          setTechnicals(fallbackTechnicals);
        }
      }
    } catch (err) {
      console.error('ModernDashboard data fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, activePortfolioId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (!activePortfolioId) {
    return (
      <div className="flex h-full items-center justify-center text-slate-500 italic">
        Vui lòng chọn hoặc tạo danh mục để bắt đầu.
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-slate-950 text-slate-200">
      {/* 1. Global High-Density Header */}
      <SmartStatsHeader
        summary={summary}
        loading={loading}
        realtimeBreadth={realtimeMarketBreadth}
        onRefresh={fetchData}
      />

      {/* 2. Main Workspace Layout */}
      <div className="relative flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-4">
        <div className="grid min-h-full grid-cols-1 items-start gap-4 xl:grid-cols-3">
          <div className="min-w-0 xl:col-span-2">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:h-[526px]">
              <div className="h-[526px] min-w-0 bg-slate-900/30 border border-slate-800/50 rounded-xl overflow-hidden p-1 lg:h-full">
                <PortfolioHeatmap
                  holdings={heatmapData}
                  title="Theo dõi Dòng tiền"
                  compact={true}
                />
              </div>

              <div className="h-[526px] min-w-0 overflow-hidden lg:h-full">
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
            </div>

            <div className="mt-4 min-h-[420px] min-w-0 overflow-hidden">
              <ModularPositionDeck
                holdings={heatmapData.filter((h) => h.is_holding)}
                symbolUniverse={symbolUniverse}
                loading={loading}
                quotesBySymbol={quotesBySymbol}
                technicals={technicals}
                alerts={alerts}
                analytics={analytics}
                digest={digest}
              />
            </div>
          </div>

          <div className="h-full min-h-[460px] min-w-0 self-start xl:col-span-1 space-y-4">
            <AIAdvisorAlertPanel 
              holdings={holdings}
              watchlist={trackedSymbols}
              technicals={technicals}
              alerts={alerts}
              newsDigest={digest}
              criticalSoundEnabled={criticalSoundEnabled}
            />
            <ModernSidebar
              portfolioId={activePortfolioId}
              alerts={alerts}
              breadth={realtimeMarketBreadth}
              analytics={analytics}
              digest={digest}
              loading={loading}
              portfolioSymbols={monitoredSymbols}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
