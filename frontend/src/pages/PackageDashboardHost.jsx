/**
 * PackageDashboardHost — DM-04
 *
 * Cầu nối giữa packages/web DashboardPage và các component legacy của frontend.
 * Nhận dữ liệu realtime từ hooks legacy, tạo render-prop và truyền vào DashboardPage.
 *
 * Quy tắc:
 *  - File này thuộc frontend/src — được phép dùng JSX, React context legacy.
 *  - KHÔNG import apiClient (axios) trực tiếp; dữ liệu portfolio đến từ DashboardPage/useCoreDashboardData.
 *  - Component legacy được inject vào DashboardPage qua render props.
 */
import React, { Suspense, lazy, useMemo } from 'react';
import { DashboardPage } from '@vninvest/web';
import { usePortfolio } from '../context/PortfolioContext';
import { useI18n } from '../context/LangContext';
import useRealtimeFeed from '../hooks/useRealtimeFeed';
import useAlertCenterFeed from '../hooks/useAlertCenterFeed';
import usePersistentAlertState from '../hooks/usePersistentAlertState';
import { buildLiveHoldingsOverlay } from '../utils/dashboardRealtimeSelectors';
import { buildModernDashboardSymbolUniverse } from '../utils/modernDashboardSymbolUniverse';

import SmartStatsHeader from '../components/modern/SmartStatsHeader';
import FactsFirstModularPositionDeck from '../components/modern/FactsFirstModularPositionDeck';
import PortfolioHeatmap from '../components/PortfolioHeatmap';
import UnifiedAlertCenter from '../components/UnifiedAlertCenter';

const DashboardPanelFallback = ({ minHeightClass = 'min-h-[220px]' }) => (
  <div className={`rounded-2xl border border-slate-800/50 bg-slate-900/40 ${minHeightClass} flex items-center justify-center px-4 text-xs font-medium text-slate-500`}>
    Đang tải…
  </div>
);

const EMPTY = [];

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

  // ── Render props ───────────────────────────────────────────────────────

  const renderStats = React.useCallback(
    ({ summary, onRefresh }) => (
      <SmartStatsHeader
        summary={summary}
        loading={false}
        realtimeBreadth={realtimeBreadth}
        onRefresh={onRefresh}
      />
    ),
    [realtimeBreadth],
  );

  const renderDeck = React.useCallback(
    ({ holdings: h, technicals, analytics, loading }) => (
      <Suspense fallback={<DashboardPanelFallback minHeightClass="min-h-[420px]" />}>
        <FactsFirstModularPositionDeck
          holdings={liveHoldings.length ? liveHoldings : h}
          quotesBySymbol={quotesBySymbol}
          technicals={technicals}
          analytics={analytics}
          alerts={alerts}
          loading={loading}
        />
      </Suspense>
    ),
    [liveHoldings, quotesBySymbol, alerts],
  );

  const renderAlerts = React.useCallback(
    () => (
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
    ({ holdings: h, loading }) => (
      <Suspense fallback={<DashboardPanelFallback minHeightClass="min-h-[320px]" />}>
        <PortfolioHeatmap
          data={liveHoldings.length ? liveHoldings : h}
          quotesBySymbol={quotesBySymbol}
          loading={loading}
        />
      </Suspense>
    ),
    [liveHoldings, quotesBySymbol],
  );

  // Bubble slot: minimal fallback (no dedicated legacy bubble component yet)
  const renderBubble = React.useCallback(() => null, []);

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
      renderAlerts={renderAlerts}
      renderHeatmap={renderHeatmap}
      renderBubble={renderBubble}
      onDataReady={handleDataReady}
      className="min-h-screen bg-slate-950 text-slate-100"
    />
  );
}
