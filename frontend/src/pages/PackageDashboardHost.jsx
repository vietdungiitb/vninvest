/**
 * PackageDashboardHost — DM-04
 *
 * Cầu nối giữa packages/web DashboardPage và các component legacy của frontend.
 * Nhận dữ liệu realtime từ hooks legacy, tạo render-prop và truyền vào DashboardPage.
 * Đây là bề mặt parity/canonical target cho cutover SaaS-native của dashboard;
 * `ModernDashboard` chỉ còn là bridge tạm thời cho route `/dashboard` hiện hành.
 *
 * Quy tắc:
 *  - File này thuộc frontend/src — được phép dùng JSX, React context legacy.
 *  - KHÔNG import apiClient (axios) trực tiếp; dữ liệu portfolio đến từ DashboardPage/useCoreDashboardData.
 *  - Component legacy được inject vào DashboardPage qua render props.
 */
import React, { Suspense, lazy, useMemo } from 'react';
import { DashboardPage, coreApiAdapter } from '@vninvest/web';
import { usePortfolio } from '../context/PortfolioContext';
import { useI18n } from '../context/LangContext';
import useRealtimeFeed from '../hooks/useRealtimeFeed';
import useAlertCenterFeed from '../hooks/useAlertCenterFeed';
import usePersistentAlertState from '../hooks/usePersistentAlertState';
import { buildLiveHoldingsOverlay } from '../utils/dashboardRealtimeSelectors';
import { buildModernDashboardSymbolUniverse, normalizeSymbol } from '../utils/modernDashboardSymbolUniverse';

import SmartStatsHeader from '../components/modern/SmartStatsHeader';
import FactsFirstModularPositionDeck from '../components/modern/FactsFirstModularPositionDeck';
import PortfolioHeatmap from '../components/PortfolioHeatmap';
import UnifiedAlertCenter from '../components/UnifiedAlertCenter';
const AIAdvisorAlertPanel = lazy(() => import('../components/modern/AIAdvisorAlertPanel'));

const DashboardPanelFallback = ({ minHeightClass = 'min-h-[220px]' }) => (
  <div className={`rounded-2xl border border-slate-800/50 bg-slate-900/40 ${minHeightClass} flex items-center justify-center px-4 text-xs font-medium text-slate-500`}>
    Đang tải…
  </div>
);

const EMPTY = [];

const EXCLUDED_MARKET_GROUPS = new Set([
  'VN100',
  'HOSE',
  'HNX',
  'UPCOM',
]);

export default function PackageDashboardHost() {
  const { activePortfolioId, isAuthenticated } = usePortfolio();
  const { t, formatNumber } = useI18n();
  const [unifiedPageSize, setUnifiedPageSize] = React.useState(5);
  const [sourceFilter, setSourceFilter] = React.useState('all');
  const [severityFilter, setSeverityFilter] = React.useState('all');
  const [audienceFilter, setAudienceFilter] = React.useState('all');

  // ── Realtime feed ──────────────────────────────────────────────────────
  // monitoredSymbols is derived from holdings returned by useCoreDashboardData,
  // but we need it before that. Pass EMPTY initially; DashboardPage re-renders
  // once holdings are ready and the realtime feed will update.
  const [holdings, setHoldings] = React.useState(EMPTY);
  const [trackedSymbols, setTrackedSymbols] = React.useState(EMPTY);
  const [watchlistGroups, setWatchlistGroups] = React.useState(EMPTY);
  const [digest, setDigest] = React.useState(null);
  const digestFetchInFlightRef = React.useRef(false);

  const baseSymbolUniverse = useMemo(
    () => buildModernDashboardSymbolUniverse({ holdings, trackedSymbols, watchlistGroups }),
    [holdings, trackedSymbols, watchlistGroups],
  );

  const monitoredSymbols = useMemo(
    () => baseSymbolUniverse.map((item) => item.symbol).filter(Boolean),
    [baseSymbolUniverse],
  );

  const { quotesBySymbol, alerts, lastEventAt, darkFlowAlerts } = useRealtimeFeed({
    symbols: monitoredSymbols,
    maxAlerts: 20,
  });

  const liveHoldings = useMemo(
    () => buildLiveHoldingsOverlay(holdings, quotesBySymbol),
    [holdings, quotesBySymbol],
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

  const heatmapSymbols = useMemo(() => {
    const symbolsSet = new Set();

    // 1. Portfolio holdings
    liveHoldings.forEach((h) => {
      if (h?.symbol) {
        symbolsSet.add(normalizeSymbol(h.symbol));
      }
    });

    // 2. Tracked symbols
    trackedSymbols.forEach((t) => {
      if (t?.symbol) {
        symbolsSet.add(normalizeSymbol(t.symbol));
      }
    });

    // 3. Custom watchlists (excluding system defaults)
    watchlistGroups.forEach((group) => {
      const name = String(group?.name || '').trim().toUpperCase();
      if (name && !EXCLUDED_MARKET_GROUPS.has(name)) {
        (group.items || []).forEach((item) => {
          if (item?.symbol) {
            symbolsSet.add(normalizeSymbol(item.symbol));
          }
        });
      }
    });

    return Array.from(symbolsSet);
  }, [liveHoldings, trackedSymbols, watchlistGroups]);

  const heatmapData = useMemo(() => {
    if (!heatmapSymbols.length) return [];

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

    return heatmapSymbols.map((symbol) => {
      const held = holdingsMap.get(symbol);
      const quote = quotesBySymbol[symbol] || {};
      const trackedInfo = trackedMap.get(symbol);
      const changePct = quote.change_pct ?? held?.live_change_pct ?? trackedInfo?.change_pct ?? null;
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
  }, [liveHoldings, heatmapSymbols, quotesBySymbol, trackedSymbols]);

  const trackedSymbolNames = useMemo(
    () => trackedSymbols.map((s) => s?.symbol || s?.name || s).filter(Boolean),
    [trackedSymbols],
  );

  const { readAlertIds, criticalSoundEnabled, markAlertAsRead, isMutedSymbol, muteSymbolFor30m, toggleCriticalSound } =
    usePersistentAlertState();

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
    enableSnapshot: isAuthenticated && Boolean(activePortfolioId),
    lastEventAt,
    sourceFilter,
    severityFilter,
    audienceFilter,
    pageSize: unifiedPageSize,
    isMutedSymbol,
    formatNumber: (v) => Number(v || 0).toLocaleString('vi-VN'),
    t,
  });

  const unreadUnifiedCount = useMemo(
    () => filteredUnifiedAlerts.filter((item) => !readAlertIds.has(item.id)).length,
    [filteredUnifiedAlerts, readAlertIds],
  );

  const realtimeBreadth = useMemo(() => {
    return monitoredSymbols.reduce(
      (acc, symbol) => {
        const quote = quotesBySymbol[symbol];
        if (!quote) return acc;
        const cp = quote.change_pct ?? 0;
        if (cp > 0) acc.up++;
        else if (cp < 0) acc.down++;
        else acc.flat++;
        return acc;
      },
      { up: 0, down: 0, flat: 0 },
    );
  }, [monitoredSymbols, quotesBySymbol]);

  React.useEffect(() => {
    setDigest(null);
    digestFetchInFlightRef.current = false;
  }, [activePortfolioId, isAuthenticated]);

  const requestPortfolioDigest = React.useCallback(async () => {
    if (!isAuthenticated || digest !== null || digestFetchInFlightRef.current) {
      return;
    }

    digestFetchInFlightRef.current = true;
    try {
      const response = await coreApiAdapter.getPortfolioNewsDigest();
      setDigest(response?.data ?? response ?? null);
    } catch (error) {
      console.warn('Portfolio news digest fetch failed:', error);
      setDigest(null);
    } finally {
      digestFetchInFlightRef.current = false;
    }
  }, [digest, isAuthenticated]);

  // ── Render props ───────────────────────────────────────────────────────

  const renderStats = React.useCallback(
    ({ summary, analytics, onRefresh }) => (
      <SmartStatsHeader
        summary={summary}
        loading={false}
        realtimeBreadth={realtimeBreadth}
        analytics={analytics}
        onRefresh={onRefresh}
      />
    ),
    [realtimeBreadth],
  );

  const renderDeck = React.useCallback(
    ({ holdings: h, technicals, analytics, loading, selectedSession, onSelectSession, selectedSymbol, onSelectSymbol }) => (
      <Suspense fallback={<DashboardPanelFallback minHeightClass="min-h-[420px]" />}>
        <FactsFirstModularPositionDeck
          holdings={liveHoldings.length ? liveHoldings : h}
          symbolUniverse={symbolUniverse}
          quotesBySymbol={quotesBySymbol}
          technicals={technicals}
          analytics={analytics}
          alerts={alerts}
          digest={digest}
          onRequestDigest={requestPortfolioDigest}
          loading={loading}
          selectedSession={selectedSession}
          onSelectSession={onSelectSession}
          selectedSymbol={selectedSymbol}
          onSelectSymbol={onSelectSymbol}
        />
      </Suspense>
    ),
    [liveHoldings, symbolUniverse, quotesBySymbol, alerts, digest, requestPortfolioDigest],
  );

  const renderAlertLane = React.useCallback(
    ({ selectedSession, onSelectSession, selectedSymbol, onSelectSymbol }) => (
      <UnifiedAlertCenter
        alerts={filteredUnifiedAlerts}
        alertSummary={alertSummary}
        readAlertIds={readAlertIds}
        markAlertAsRead={markAlertAsRead}
        muteSymbolFor30m={muteSymbolFor30m}
        severityFilter={severityFilter}
        setSeverityFilter={setSeverityFilter}
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
        showSummaryChips
        minHeightClass="h-full"
        className="h-full overflow-hidden"
        selectedSession={selectedSession}
        onSelectSession={onSelectSession}
        selectedSymbol={selectedSymbol}
        onSelectSymbol={onSelectSymbol}
      />
    ),
    [
      filteredUnifiedAlerts, alertSummary, readAlertIds, markAlertAsRead, muteSymbolFor30m,
      severityFilter, criticalSoundEnabled, toggleCriticalSound,
      currentUnifiedPage, hasPreviousUnifiedPage, backendUnifiedHasMore, loadingMoreUnified,
      goToFirstUnifiedPage, goToPreviousUnifiedPage, goToNextUnifiedPage, goToLastUnifiedPage,
      hasLastUnifiedPage, unifiedPageSize, sourceFilter, audienceFilter, unreadUnifiedCount,
    ],
  );

  const renderHeatmap = React.useCallback(
    ({ loading, technicals }) => {
      const technicalChangeBySymbol = new Map(
        (Array.isArray(technicals) ? technicals : []).map((row) => [
          normalizeSymbol(row?.symbol),
          row?.price_change_pct,
        ]),
      );

      const mergedHeatmapData = heatmapData.map((item) => {
        if (item?.live_change_pct !== null && item?.live_change_pct !== undefined) {
          return item;
        }
        const fallbackChangePct = technicalChangeBySymbol.get(normalizeSymbol(item?.symbol));
        const numericFallback = Number(fallbackChangePct);
        if (Number.isNaN(numericFallback)) {
          return item;
        }
        return {
          ...item,
          live_change_pct: numericFallback,
        };
      });

      return (
        <Suspense fallback={<DashboardPanelFallback minHeightClass="min-h-[320px]" />}>
          <PortfolioHeatmap
            holdings={mergedHeatmapData}
            quotesBySymbol={quotesBySymbol}
            loading={loading}
            compact={true}
          />
        </Suspense>
      );
    },
    [heatmapData, quotesBySymbol],
  );

  const renderAiPanel = React.useCallback(
    ({ holdings: h, technicals, alerts: slotAlerts, selectedSession, onSelectSession, selectedSymbol, onSelectSymbol }) => (
      <Suspense fallback={<DashboardPanelFallback minHeightClass="min-h-[420px]" />}>
        <AIAdvisorAlertPanel
          holdings={liveHoldings.length ? liveHoldings : h}
          watchlist={trackedSymbols}
          technicals={technicals}
          alerts={slotAlerts}
          newsDigest={digest}
          onRequestDigest={requestPortfolioDigest}
          criticalSoundEnabled={criticalSoundEnabled}
          selectedSession={selectedSession}
          onSelectSession={onSelectSession}
          selectedSymbol={selectedSymbol}
          onSelectSymbol={onSelectSymbol}
          expandedClassName="h-full"
        />
      </Suspense>
    ),
    [liveHoldings, trackedSymbols, digest, requestPortfolioDigest, criticalSoundEnabled],
  );

  // ── Lift holdings/tracked from DashboardPage via onDataReady prop ─────
  // We pass a side-channel callback so PackageDashboardHost can update local
  // state for realtime feed once core data is loaded.
  const handleDataReady = React.useCallback(
    ({ holdings: h, trackedSymbols: ts, watchlistGroups: wg }) => {
      setHoldings(h || EMPTY);
      setTrackedSymbols(ts || EMPTY);
      setWatchlistGroups(wg || EMPTY);
    },
    [],
  );

  return (
    <DashboardPage
      portfolioId={activePortfolioId}
      enabled={isAuthenticated && Boolean(activePortfolioId)}
      quotesBySymbol={quotesBySymbol}
      alerts={alerts}
      darkFlowAlerts={darkFlowAlerts}
      realtimeBreadth={realtimeBreadth}
      renderStats={renderStats}
      renderDeck={renderDeck}
      renderAlertLane={renderAlertLane}
      renderHeatmap={renderHeatmap}
      renderAiPanel={renderAiPanel}
      onDataReady={handleDataReady}
      t={t}
      className="min-h-screen bg-slate-950 text-slate-100"
    />
  );
}
